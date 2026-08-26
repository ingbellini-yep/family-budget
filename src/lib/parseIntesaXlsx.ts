import * as XLSX from 'xlsx'

export interface IntesaTransaction {
  date: string
  description: string
  originalDescription: string
  intesaCategory: string
  conto: string
  amount: number
  type: 'entrata' | 'uscita'
}

function excelDateToYMD(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400) * 1000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Operations where column B is a generic label and column C is the actual merchant
const GENERIC_OPERATIONS = ['pagamento tramite pos']

// Keyword map: Intesa category → keywords to match app category names
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Generi alimentari e supermercato': ['supermercato', 'spesa', 'alimentar', 'cibo'],
  'Ristoranti e bar': ['ristorante', 'bar', 'cena', 'pranzo', 'pizza'],
  'Stipendi e pensioni': ['stipendio', 'pensione', 'salario', 'reddito'],
  'Spese mediche': ['medic', 'salute', 'ospedale', 'dottore'],
  'Farmacia': ['farmacia', 'farmaco', 'medicinali', 'salute'],
  'TV, Internet, telefono': ['internet', 'telefono', 'tv', 'abbonament', 'streaming'],
  'Cellulare': ['cellulare', 'telefono', 'mobile', 'sim'],
  'Rate Mutuo e Finanziamento': ['mutuo', 'finanziamento', 'rata', 'prestito'],
  'Bonifici ricevuti': ['bonifico', 'accredito', 'rimborso'],
  'Domiciliazioni e Utenze': ['utenze', 'bolletta', 'luce', 'gas', 'acqua'],
  'Hi-tech e informatica': ['informatica', 'tecnologia', 'elettronica'],
  'Spettacoli e musei': ['cinema', 'teatro', 'svago', 'intrattenimento', 'cultura'],
  'Corsi e sport': ['sport', 'palestra', 'corso', 'fitness'],
  'Cura della persona': ['cura', 'persona', 'bellezza', 'estetica', 'parrucchiere'],
  'Casa varie': ['casa', 'arredamento', 'casaling'],
  'Altre uscite': [],
}

export function matchIntesaCategory(
  intesaCategory: string,
  appCategories: { id: string; name: string; type: string }[],
  txType: 'entrata' | 'uscita',
): string {
  const filtered = appCategories.filter(c => c.type === txType || c.type === 'risparmio')
  const lower = intesaCategory.toLowerCase()

  const exact = filtered.find(c => c.name.toLowerCase() === lower)
  if (exact) return exact.id

  const keywords = CATEGORY_KEYWORDS[intesaCategory] || []
  for (const kw of keywords) {
    const match = filtered.find(c => c.name.toLowerCase().includes(kw))
    if (match) return match.id
  }

  return ''
}

export function parseIntesaXlsx(buffer: ArrayBuffer): IntesaTransaction[] | null {
  let wb: ReturnType<typeof XLSX.read>
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch {
    return null
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return null

  // sheet_to_json with header:1 returns an array of arrays; raw:true keeps serial dates as numbers
  const allRows: any[][] = (XLSX.utils as any).sheet_to_json(ws, { header: 1, raw: true })

  // Find the header row: first row where col A (index 0) is exactly "Data"
  let headerIdx = -1
  for (let i = 0; i < Math.min(allRows.length, 40); i++) {
    const row = allRows[i]
    if (Array.isArray(row) && String(row[0] ?? '').trim() === 'Data') {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) return null

  const results: IntesaTransaction[] = []

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i]
    if (!Array.isArray(row) || row.length < 8) continue

    // A=0 Data, B=1 Operazione, C=2 Dettagli, D=3 Conto, E=4 Contabilizzazione, F=5 Categoria, G=6 Valuta, H=7 Importo
    const dateSerial = row[0]
    const importo = row[7]

    if (typeof dateSerial !== 'number' || typeof importo !== 'number') continue

    const operazione = String(row[1] ?? '').trim()
    const dettagli = String(row[2] ?? '').trim()

    const isGenericOp = GENERIC_OPERATIONS.some(g => operazione.toLowerCase().startsWith(g))
    const description = isGenericOp && dettagli ? dettagli : operazione

    results.push({
      date: excelDateToYMD(dateSerial),
      description,
      originalDescription: dettagli || operazione,
      intesaCategory: String(row[5] ?? '').trim(),
      conto: String(row[3] ?? '').trim(),
      amount: Math.abs(importo),
      type: importo >= 0 ? 'entrata' : 'uscita',
    })
  }

  return results.length ? results : null
}
