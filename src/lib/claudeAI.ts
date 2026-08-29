// ─── Claude AI utility — chiamate dirette all'API Anthropic dal browser ──────

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5'

const CLAUDE_HEADERS = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
})

export interface ExtractedTransaction {
  date: string | null
  description: string | null
  amount: number | null
  type: 'debit' | 'credit' | null
}

// Legge la API key: prima localStorage, poi parametro
export function getStoredApiKey(): string {
  return localStorage.getItem('claude_api_key') || ''
}

function parseTransactionJson(text: string): ExtractedTransaction[] {
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return []
  try { return JSON.parse(match[0]) } catch { return [] }
}

// ─── 9.1 Estrazione da screenshot PNG/JPG ─────────────────────────────────────
export async function extractTransactionsFromImage(
  base64DataUrl: string,
  apiKey: string,
): Promise<ExtractedTransaction[]> {
  const [header, base64Data] = base64DataUrl.split(',')
  const mediaType = (header.match(/data:([^;]+)/)?.[1] || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp'

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: CLAUDE_HEADERS(apiKey),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          {
            type: 'text',
            text: `Sei un assistente che estrae transazioni bancarie da screenshot di app bancarie italiane.
Estrai TUTTE le transazioni visibili e restituisci SOLO un JSON array, nessun testo aggiuntivo:
[{ "date": "YYYY-MM-DD", "description": "...", "amount": 00.00, "type": "debit" o "credit" }]
Se una informazione non è leggibile usa null. Le date italiane "15/03/2025" vanno convertite in "2025-03-15".`,
          },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error?.message || `Claude API error: ${res.status}`)
  }
  const data = await res.json()
  return parseTransactionJson(data.content?.[0]?.text || '')
}

// ─── 9.2 Estrazione da pagina PDF (immagine canvas) ──────────────────────────
const BANK_NAMES: Record<string, string> = {
  fineco: 'Fineco Bank',
  intesa: 'Intesa Sanpaolo',
  bper: 'BPER Banca',
  trade_republic: 'Trade Republic',
}

function detectBank(text: string): string | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('fineco')) return BANK_NAMES.fineco
  if (lower.includes('intesa') || lower.includes('sanpaolo')) return BANK_NAMES.intesa
  if (lower.includes('bper')) return BANK_NAMES.bper
  if (lower.includes('trade republic')) return BANK_NAMES.trade_republic
  return undefined
}

export async function extractTransactionsFromPageImage(
  base64DataUrl: string,
  apiKey: string,
  bankName?: string,
): Promise<ExtractedTransaction[]> {
  const [header, base64Data] = base64DataUrl.split(',')
  const mediaType = (header.match(/data:([^;]+)/)?.[1] || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp'
  const bankLine = bankName ? `\nBanca rilevata: ${bankName}.` : ''

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: CLAUDE_HEADERS(apiKey),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          {
            type: 'text',
            text: `Sei un assistente che estrae transazioni da estratti conto bancari italiani.${bankLine}
Estrai TUTTE le transazioni e restituisci SOLO un JSON array:
[{ "date": "YYYY-MM-DD", "description": "...", "amount": 00.00, "type": "debit" o "credit" }]
Ignora intestazioni, totali e testo non transazionale. Converti date italiane in ISO YYYY-MM-DD.`,
          },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error?.message || `Claude API error: ${res.status}`)
  }
  const data = await res.json()
  return parseTransactionJson(data.content?.[0]?.text || '')
}

export { detectBank }

// ─── 9.4 Suggerimento macrocategoria (solo budget_category) ──────────────────
export async function suggestMacroCategory(
  description: string,
  budgetCategories: Array<{ id: string; name: string; budget_type?: string }>,
  apiKey: string,
): Promise<string | null> {
  if (!description.trim() || !apiKey) return null
  // Only offer uscita macrocategories (exclude "A- Entrate" type)
  const speseCats = budgetCategories.filter(c => c.budget_type !== 'entrata')
  const bcList = speseCats.map(c => c.name).join(', ')
  if (!bcList) return null

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: CLAUDE_HEADERS(apiKey),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `Descrizione transazione bancaria italiana: "${description}"
Macrocategorie disponibili: ${bcList}
Scegli la macrocategoria più adatta. Rispondi SOLO con il nome esatto, senza altro testo.`,
      }],
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const text: string = (data.content?.[0]?.text || '').trim()
  const match = speseCats.find(c => c.name.toLowerCase() === text.toLowerCase())
    || speseCats.find(c => text.toLowerCase().includes(c.name.toLowerCase()))
  return match?.id || null
}

// ─── 9.4b Suggerimento categoria (legacy, mantiene backward compat) ───────────
export async function suggestCategory(
  description: string,
  categories: Array<{ id: string; name: string; type: string }>,
  budgetCategories: Array<{ id: string; name: string }>,
  apiKey: string,
): Promise<{ categoryId: string | null; budgetCategoryId: string | null }> {
  if (!description.trim() || !apiKey) return { categoryId: null, budgetCategoryId: null }
  const catList = categories.map(c => c.name).join(', ')
  const bcList = budgetCategories.map(c => c.name).join(', ')

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: CLAUDE_HEADERS(apiKey),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `Data questa descrizione di transazione bancaria italiana: '${description}'
Suggerisci la categoria più appropriata tra queste: ${catList}
Suggerisci anche la macro categoria tra: ${bcList}
Rispondi SOLO con JSON: { "category": "nome esatto", "budget_category": "nome esatto" }`,
      }],
    }),
  })
  if (!res.ok) return { categoryId: null, budgetCategoryId: null }
  const data = await res.json()
  const text: string = data.content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*?\}/)
  if (!match) return { categoryId: null, budgetCategoryId: null }
  try {
    const parsed = JSON.parse(match[0])
    const cat = categories.find(c => c.name === parsed.category)
    const bc = budgetCategories.find(c => c.name === parsed.budget_category)
    return { categoryId: cat?.id || null, budgetCategoryId: bc?.id || null }
  } catch {
    return { categoryId: null, budgetCategoryId: null }
  }
}

// ─── Test connessione ─────────────────────────────────────────────────────────
export async function testApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: CLAUDE_HEADERS(apiKey),
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ok' }],
      }),
    })
    if (res.ok) return { ok: true }
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: (err as any).error?.message || `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
