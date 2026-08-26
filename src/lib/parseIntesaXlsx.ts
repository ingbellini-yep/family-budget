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

// Col letter(s) → 0-based index: A=0, B=1, H=7, etc.
function colToIdx(col: string): number {
  let n = 0
  for (let i = 0; i < col.length; i++) n = n * 26 + col.charCodeAt(i) - 64
  return n - 1
}

// Operations where column B is a generic label and column C is the actual merchant
const GENERIC_OPERATIONS = ['pagamento tramite pos']

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

  // Build a row→col→value map by iterating directly over ALL cell keys.
  // This bypasses ws['!ref'] entirely, so it works even when Intesa exports
  // an incorrect <dimension ref="A1:J33"/> that is shorter than the actual data.
  const rowMap = new Map<number, Map<number, string | number>>()

  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const match = addr.match(/^([A-Z]+)(\d+)$/)
    if (!match) continue

    const rowNum = parseInt(match[2])
    const colIdx = colToIdx(match[1])
    const cell = ws[addr]
    // For number/date cells cell.v is the raw number; for text cells cell.v is the resolved string
    const val: string | number = typeof cell.v === 'number' ? cell.v : String(cell.v ?? cell.w ?? '')

    if (!rowMap.has(rowNum)) rowMap.set(rowNum, new Map())
    rowMap.get(rowNum)!.set(colIdx, val)
  }

  if (rowMap.size === 0) return null

  // Sort rows ascending by row number
  const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0])

  // Find the header row: first row where col A (idx 0) is exactly "Data"
  let headerIdx = -1
  for (let i = 0; i < Math.min(sortedRows.length, 40); i++) {
    const colMap = sortedRows[i][1]
    const valA = colMap.get(0)
    if (typeof valA === 'string' && valA.trim() === 'Data') {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) return null

  const results: IntesaTransaction[] = []

  for (let i = headerIdx + 1; i < sortedRows.length; i++) {
    const colMap = sortedRows[i][1]

    const dateSerial = colMap.get(0)  // A: Data (Excel serial number)
    const importo = colMap.get(7)     // H: Importo

    if (typeof dateSerial !== 'number' || typeof importo !== 'number') continue

    const operazione = String(colMap.get(1) ?? '').trim()  // B: Operazione
    const dettagli = String(colMap.get(2) ?? '').trim()    // C: Dettagli
    const conto = String(colMap.get(3) ?? '').trim()       // D: Conto o carta
    const categoria = String(colMap.get(5) ?? '').trim()   // F: Categoria

    const isGenericOp = GENERIC_OPERATIONS.some(g => operazione.toLowerCase().startsWith(g))
    const description = isGenericOp && dettagli ? dettagli : operazione

    results.push({
      date: excelDateToYMD(dateSerial),
      description,
      originalDescription: dettagli || operazione,
      intesaCategory: categoria,
      conto,
      amount: Math.abs(importo),
      type: importo >= 0 ? 'entrata' : 'uscita',
    })
  }

  return results.length ? results : null
}
