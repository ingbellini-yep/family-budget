import * as XLSX from 'xlsx'

export interface BperTransaction {
  date: string
  description: string
  bperCategory: string
  amount: number
  type: 'entrata' | 'uscita'
}

const IT_MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
}

function parseItalianDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (!m) return null
  const day = parseInt(m[1])
  const month = IT_MONTHS[m[2].toLowerCase()]
  const year = parseInt(m[3])
  if (!month || !day || !year) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseAmount(s: string): number | null {
  if (!s || s.trim() === '' || s.trim() === '-') return null
  const cleaned = s.replace(/[€\s ]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.abs(n)
}

// BPER categories that map to professional expenses
const PROFESSIONAL_CATEGORIES = new Set([
  'COMMISSIONE', 'COMMISSIONI', 'IMPOSTE', 'COMPETENZE',
  'RATA FINANZIAMENTO', 'CANONE', 'SPESE', 'ADDEBITO CARTA CRED.',
])

export function matchBperBudgetCategory(
  bperCategory: string,
  budgetCategories: { id: string; name: string }[],
): string {
  const upper = bperCategory.trim().toUpperCase()
  if (!PROFESSIONAL_CATEGORIES.has(upper)) return ''
  const prof = budgetCategories.find(bc =>
    bc.name.toLowerCase().includes('profession') ||
    bc.name.toLowerCase().includes('lavoro') ||
    bc.name.toLowerCase().includes('profess')
  )
  return prof?.id || ''
}

export function parseBperXls(buffer: ArrayBuffer): BperTransaction[] | null {
  let wb: ReturnType<typeof XLSX.read>
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch {
    return null
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return null

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][]

  // Find header row: col index 1 === "Data operazione"
  let headerIdx = -1
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    if (String(data[i]?.[1] ?? '').trim() === 'Data operazione') {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return null

  const results: BperTransaction[] = []

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 6) continue

    const rawDate    = String(row[1] ?? '').trim()
    const description = String(row[3] ?? '').trim()
    const rawEntrate = String(row[4] ?? '').trim()
    const rawUscite  = String(row[5] ?? '').trim()
    const bperCategory = String(row[6] ?? '').trim()

    if (!rawDate || rawDate === '-' || !description) continue

    const date = parseItalianDate(rawDate)
    if (!date) continue

    let amount: number | null = null
    let type: 'entrata' | 'uscita'

    if (rawEntrate && rawEntrate !== '-') {
      amount = parseAmount(rawEntrate)
      type = 'entrata'
    } else if (rawUscite && rawUscite !== '-') {
      amount = parseAmount(rawUscite)
      type = 'uscita'
    } else {
      continue
    }

    if (!amount) continue

    results.push({ date, description, bperCategory, amount, type })
  }

  return results.length ? results : null
}
