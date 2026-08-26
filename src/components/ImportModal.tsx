import { useState, useRef, useCallback } from 'react'
import { X, FileText, Image, Table2, Trash2, Check, AlertTriangle, Loader2, Sparkles, ChevronRight, ChevronLeft, Building2 } from 'lucide-react'
import { extractTransactionsFromImage, extractTransactionsFromPageImage, detectBank, suggestCategory, getStoredApiKey, ExtractedTransaction } from '../lib/claudeAI'
import { parseIntesaXlsx, matchIntesaCategory } from '../lib/parseIntesaXlsx'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PreviewRow {
  _id: string
  date: string
  description: string
  amount: number
  type: 'entrata' | 'uscita'
  category_id: string
  account_id: string
  isDuplicate: boolean
  hasError: boolean
  include: boolean
  intesaCategory?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onImported: (count: number) => void
  profile: any
  accounts: any[]
  categories: any[]
  budgetCategories: any[]
  transactions: any[]
  addTransaction: (tx: any) => Promise<{ error: any }>
}

type Mode = 'screenshot' | 'pdf' | 'csv' | 'intesa'
type CsvStep = 1 | 2 | 3

// ─── Deduplication ────────────────────────────────────────────────────────────
function isDuplicate(row: Omit<PreviewRow, 'isDuplicate' | 'hasError' | 'include' | '_id'>, existing: any[]): boolean {
  return existing.some(t =>
    t.date === row.date &&
    Math.abs(t.amount - row.amount) < 0.01 &&
    t.description?.toLowerCase().trim() === row.description?.toLowerCase().trim(),
  )
}

// ─── PDF page render via pdfjs ────────────────────────────────────────────────
let _pdfjsLib: any = null
async function getPdfjsLib() {
  if (_pdfjsLib) return _pdfjsLib
  _pdfjsLib = await import('pdfjs-dist')
  // Use CDN worker — avoids Vite new URL() resolution issues in production
  _pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${_pdfjsLib.version}/pdf.worker.min.mjs`
  return _pdfjsLib
}

async function renderPdfPageToDataUrl(pdfData: ArrayBuffer, pageNum: number): Promise<string> {
  const pdfjsLib = await getPdfjsLib()
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await (page.render as any)({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85)
}

async function getPdfPageCount(pdfData: ArrayBuffer): Promise<number> {
  const pdfjsLib = await getPdfjsLib()
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
  return pdf.numPages
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
function detectSeparator(text: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  const firstLine = text.split('\n')[0] || ''
  counts[','] = (firstLine.match(/,/g) || []).length
  counts[';'] = (firstLine.match(/;/g) || []).length
  counts['\t'] = (firstLine.match(/\t/g) || []).length
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function parseCsvText(text: string, sep: string): string[][] {
  return text.split('\n')
    .filter(l => l.trim())
    .map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')))
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImportModal({
  open, onClose, onImported,
  profile, accounts, categories, budgetCategories, transactions, addTransaction,
}: Props) {
  const [mode, setMode] = useState<Mode>('screenshot')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // CSV state
  const [csvStep, setCsvStep] = useState<CsvStep>(1)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRawRows, setCsvRawRows] = useState<string[][]>([])
  const [csvMapping, setCsvMapping] = useState({ date: '', description: '', amount: '', type: '', amountSign: 'auto' })
  const [csvSep, setCsvSep] = useState(',')

  const fileRef = useRef<HTMLInputElement>(null)
  const apiKey = getStoredApiKey()
  const hasApiKey = !!apiKey

  const defaultAccountId = accounts[0]?.id || ''
  const [globalAccountId, setGlobalAccountId] = useState<string>('')

  const reset = useCallback(() => {
    setRows([]); setStep('upload'); setLoading(false); setError(null); setSaved(false)
    setCsvStep(1); setCsvHeaders([]); setCsvRawRows([])
    setCsvMapping({ date: '', description: '', amount: '', type: '', amountSign: 'auto' })
  }, [])

  const handleClose = () => { reset(); onClose() }

  // ── Convert extracted rows to preview rows ────────────────────────────────
  const toPreviewRows = useCallback((extracted: ExtractedTransaction[], existing: any[]): PreviewRow[] => {
    return extracted
      .filter(e => e.amount !== null && e.description !== null)
      .map((e, i) => {
        const amount = Math.abs(e.amount!)
        const type: 'entrata' | 'uscita' = e.type === 'credit' ? 'entrata' : 'uscita'
        const date = e.date || new Date().toISOString().split('T')[0]
        const row = { date, description: e.description!, amount, type, category_id: '', account_id: defaultAccountId }
        return {
          _id: `${i}-${Date.now()}`,
          ...row,
          isDuplicate: isDuplicate(row, existing),
          hasError: !date || isNaN(amount),
          include: !isDuplicate(row, existing),
        }
      })
  }, [defaultAccountId])

  // ── Screenshot handler ────────────────────────────────────────────────────
  const handleScreenshotFile = async (file: File) => {
    if (!hasApiKey) { setError('Configura la Claude API Key in Impostazioni → AI'); return }
    setLoading(true); setError(null)
    setLoadingMsg('Analisi screenshot con Claude AI...')
    try {
      const dataUrl = await fileToDataUrl(file)
      const extracted = await extractTransactionsFromImage(dataUrl, apiKey)
      if (!extracted.length) { setError('Nessuna transazione trovata nello screenshot.'); setLoading(false); return }
      setRows(toPreviewRows(extracted, transactions))
      setStep('preview')
    } catch (e: any) {
      setError(e.message || 'Errore durante l\'analisi')
    }
    setLoading(false)
  }

  // ── PDF handler ───────────────────────────────────────────────────────────
  const handlePdfFile = async (file: File) => {
    if (!hasApiKey) { setError('Configura la Claude API Key in Impostazioni → AI'); return }
    setLoading(true); setError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      setLoadingMsg('Caricamento PDF...')
      const numPages = await getPdfPageCount(arrayBuffer.slice(0))
      const allExtracted: ExtractedTransaction[] = []
      let detectedBank: string | undefined

      for (let p = 1; p <= numPages; p++) {
        setLoadingMsg(`Analisi pagina ${p} di ${numPages}...`)
        const dataUrl = await renderPdfPageToDataUrl(arrayBuffer.slice(0), p)
        if (p === 1) detectedBank = detectBank(file.name)
        const extracted = await extractTransactionsFromPageImage(dataUrl, apiKey, detectedBank)
        allExtracted.push(...extracted)
      }

      if (!allExtracted.length) { setError('Nessuna transazione estratta dal PDF.'); setLoading(false); return }
      setRows(toPreviewRows(allExtracted, transactions))
      setStep('preview')
    } catch (e: any) {
      setError(e.message || 'Errore durante l\'analisi del PDF')
    }
    setLoading(false)
  }

  // ── CSV handler ───────────────────────────────────────────────────────────
  const handleCsvFile = async (file: File) => {
    setLoading(true); setError(null)
    try {
      let csvText = ''
      if (file.name.match(/\.(xlsx|xls)$/i)) {
        const xlsx = await import('xlsx')
        const ab = await file.arrayBuffer()
        const wb = xlsx.read(ab, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        csvText = xlsx.utils.sheet_to_csv(ws)
      } else {
        csvText = await file.text()
      }
      const sep = detectSeparator(csvText)
      setCsvSep(sep)
      const allRows = parseCsvText(csvText, sep)
      if (allRows.length < 2) { setError('File vuoto o non riconosciuto'); setLoading(false); return }
      const headers = allRows[0]
      const dataRows = allRows.slice(1)
      setCsvHeaders(headers)
      setCsvRawRows(dataRows)
      // Try auto-detect common column names
      const lower = headers.map(h => h.toLowerCase())
      setCsvMapping({
        date: headers[lower.findIndex(h => h.includes('data') || h.includes('date'))] || '',
        description: headers[lower.findIndex(h => h.includes('descri') || h.includes('causale') || h.includes('movimento'))] || '',
        amount: headers[lower.findIndex(h => h.includes('import') || h.includes('amount') || h.includes('valore'))] || '',
        type: headers[lower.findIndex(h => h.includes('tipo') || h.includes('type') || h.includes('dare') || h.includes('avere'))] || '',
        amountSign: 'auto',
      })
      setCsvStep(2)
      setStep('preview') // use step to switch to CSV wizard view
    } catch (e: any) {
      setError(e.message || 'Errore nel parsing del file')
    }
    setLoading(false)
  }

  // ── Intesa San Paolo XLSX handler ─────────────────────────────────────────
  const handleIntesaFile = async (file: File) => {
    setLoading(true); setError(null)
    setLoadingMsg('Analisi file Intesa San Paolo...')
    try {
      const ab = await file.arrayBuffer()
      const parsed = parseIntesaXlsx(ab)
      if (!parsed) {
        setError('File non riconosciuto come estratto conto Intesa San Paolo. Assicurati di esportare nel formato .xlsx dal menu Movimenti → Esporta.')
        setLoading(false); return
      }
      const accountId = globalAccountId || defaultAccountId
      const previewRows: PreviewRow[] = parsed.map((tx, i) => {
        const categoryId = matchIntesaCategory(tx.intesaCategory, categories, tx.type)
        const row = {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category_id: categoryId,
          account_id: accountId,
        }
        return {
          _id: `intesa-${i}-${Date.now()}`,
          ...row,
          intesaCategory: tx.intesaCategory,
          isDuplicate: isDuplicate(row, transactions),
          hasError: !tx.date || !tx.amount,
          include: !isDuplicate(row, transactions) && !!tx.date && !!tx.amount,
        }
      })
      setRows(previewRows)
      setStep('preview')
    } catch (e: any) {
      setError(e.message || 'Errore nel parsing del file')
    }
    setLoading(false)
  }

  // Build preview rows from CSV mapping
  const applyCsvMapping = useCallback(() => {
    const { date, description, amount, type, amountSign } = csvMapping
    const dateIdx = csvHeaders.indexOf(date)
    const descIdx = csvHeaders.indexOf(description)
    const amtIdx = csvHeaders.indexOf(amount)
    const typeIdx = csvHeaders.indexOf(type)

    const parsed: PreviewRow[] = csvRawRows
      .filter(r => r.length > Math.max(dateIdx, descIdx, amtIdx))
      .map((r, i) => {
        const rawDate = r[dateIdx] || ''
        const desc = r[descIdx] || ''
        const rawAmt = r[amtIdx] || '0'
        const rawType = typeIdx >= 0 ? r[typeIdx] : ''

        // Parse date: try ISO, then Italian format
        let parsedDate = rawDate
        const dmyMatch = rawDate.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
        if (dmyMatch) {
          const y = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3]
          parsedDate = `${y}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
        }

        // Parse amount
        const cleanAmt = rawAmt.replace(/[€$£\s]/g, '').replace(',', '.').replace(/\.(?=.*\.)/g, '')
        const numAmt = Math.abs(parseFloat(cleanAmt) || 0)
        const rawAmtNum = parseFloat(cleanAmt) || 0

        // Determine type
        let txType: 'entrata' | 'uscita' = 'uscita'
        if (amountSign === 'auto') {
          txType = rawAmtNum > 0 ? 'entrata' : 'uscita'
        } else if (amountSign === 'positive_credit') {
          txType = rawAmtNum >= 0 ? 'entrata' : 'uscita'
        } else if (typeIdx >= 0) {
          const lw = rawType.toLowerCase()
          txType = (lw.includes('entrat') || lw.includes('credit') || lw.includes('avere') || lw === 'c') ? 'entrata' : 'uscita'
        }

        const row = { date: parsedDate, description: desc, amount: numAmt, type: txType, category_id: '', account_id: defaultAccountId }
        return {
          _id: `csv-${i}-${Date.now()}`,
          ...row,
          isDuplicate: isDuplicate(row, transactions),
          hasError: !parsedDate || isNaN(numAmt) || !desc,
          include: !isDuplicate(row, transactions) && !(!parsedDate || isNaN(numAmt) || !desc),
        }
      })
    setRows(parsed)
    setCsvStep(3)
  }, [csvMapping, csvHeaders, csvRawRows, transactions, defaultAccountId])

  // ── Suggest categories for all rows ──────────────────────────────────────
  const suggestAllCategories = async () => {
    if (!hasApiKey || !rows.length) return
    setLoadingMsg('Suggerimento categorie...')
    setLoading(true)
    const updated = [...rows]
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].include || updated[i].category_id) continue
      const { categoryId, budgetCategoryId } = await suggestCategory(
        updated[i].description, categories, budgetCategories, apiKey,
      ).catch(() => ({ categoryId: null, budgetCategoryId: null }))
      if (categoryId) updated[i] = { ...updated[i], category_id: categoryId }
      setRows([...updated])
    }
    setLoading(false)
  }

  // ── Save confirmed rows ───────────────────────────────────────────────────
  const handleSave = async () => {
    const toSave = rows.filter(r => r.include && !r.hasError)
    if (!toSave.length) return
    setStep('saving')
    let saved = 0
    let firstError: string | null = null
    const source = mode === 'screenshot' ? 'screenshot' : mode === 'pdf' ? 'pdf' : mode === 'intesa' ? 'csv' : 'csv'
    for (const r of toSave) {
      const categoryId = r.category_id
        || categories.find(c => c.type === r.type)?.id
        || categories.find(c => c.type === 'uscita')?.id
        || categories[0]?.id
        || null
      const { error } = await addTransaction({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category_id: categoryId,
        account_id: r.account_id || defaultAccountId,
        budget_category_id: null,
        family_id: profile.family_id,
        created_by: profile.id,
        source,
        note: null,
      })
      if (!error) saved++
      else if (!firstError) firstError = error?.message || JSON.stringify(error)
    }
    if (saved === 0 && toSave.length > 0) {
      setStep('preview')
      setError(`Salvataggio fallito (0/${toSave.length}). Errore: ${firstError || 'sconosciuto'}`)
      return
    }
    setSaved(true)
    onImported(saved)
    setTimeout(handleClose, 1500)
  }

  if (!open) return null

  const includedCount = rows.filter(r => r.include && !r.hasError).length
  const dupCount = rows.filter(r => r.isDuplicate).length
  const errCount = rows.filter(r => r.hasError).length

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900">Importa transazioni</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* No API key banner */}
        {!hasApiKey && (mode === 'screenshot' || mode === 'pdf') && (
          <div className="mx-4 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Configura la Claude API Key in <strong>Impostazioni → AI</strong> per usare l'importazione da screenshot e PDF.</span>
          </div>
        )}

        {/* Mode tabs */}
        {step === 'upload' && (
          <div className="flex gap-1 p-4 pb-0 flex-shrink-0">
            {([
              { id: 'screenshot', icon: Image, label: 'Screenshot' },
              { id: 'pdf', icon: FileText, label: 'PDF' },
              { id: 'csv', icon: Table2, label: 'CSV / Excel' },
              { id: 'intesa', icon: Building2, label: 'Intesa San Paolo' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setMode(id); setError(null) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === id ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-gray-500">{loadingMsg}</p>
            </div>
          )}

          {/* Saved state */}
          {saved && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-700">Transazioni importate con successo!</p>
            </div>
          )}

          {/* Upload area */}
          {!loading && !saved && step === 'upload' && (
            <div className="space-y-4">
              {error && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Screenshot upload */}
              {mode === 'screenshot' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Carica uno screenshot dell'app bancaria (PNG o JPG). Claude estrarrà automaticamente tutte le transazioni visibili.
                  </p>
                  <DropZone
                    accept="image/*"
                    label="Trascina qui uno screenshot o clicca per selezionarlo"
                    icon={<Image className="h-8 w-8 text-gray-300" />}
                    onFile={handleScreenshotFile}
                    disabled={!hasApiKey}
                  />
                </div>
              )}

              {/* PDF upload */}
              {mode === 'pdf' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Carica l'estratto conto in PDF. Ogni pagina verrà analizzata separatamente.
                    <span className="text-gray-400"> Banche supportate: Fineco, Intesa Sanpaolo, BPER, Trade Republic.</span>
                  </p>
                  <DropZone
                    accept=".pdf"
                    label="Trascina il PDF dell'estratto conto o clicca per selezionarlo"
                    icon={<FileText className="h-8 w-8 text-gray-300" />}
                    onFile={handlePdfFile}
                    disabled={!hasApiKey}
                  />
                </div>
              )}

              {/* CSV upload */}
              {mode === 'csv' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Carica un file CSV o Excel esportato dalla tua banca.
                  </p>
                  <DropZone
                    accept=".csv,.xlsx,.xls"
                    label="Trascina il file CSV/Excel o clicca per selezionarlo"
                    icon={<Table2 className="h-8 w-8 text-gray-300" />}
                    onFile={handleCsvFile}
                    disabled={false}
                  />
                </div>
              )}

              {/* Intesa San Paolo upload */}
              {mode === 'intesa' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Carica l'esportazione Excel da Intesa Sanpaolo:{' '}
                    <strong>App o Home Banking → Movimenti → Esporta → Excel (.xlsx)</strong>.
                    Le colonne vengono mappate automaticamente e le categorie della banca vengono
                    usate come suggerimento.
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conto di provenienza
                    </label>
                    <select
                      value={globalAccountId || defaultAccountId}
                      onChange={e => setGlobalAccountId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <DropZone
                    accept=".xlsx,.xls"
                    label="Trascina il file Excel di Intesa San Paolo o clicca per selezionarlo"
                    icon={<Building2 className="h-8 w-8 text-gray-300" />}
                    onFile={handleIntesaFile}
                    disabled={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* CSV Step 2 — column mapping */}
          {!loading && !saved && step === 'preview' && mode === 'csv' && csvStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Step 2 — Mappa le colonne</h3>
              <p className="text-xs text-gray-500">
                Separatore rilevato: <code className="bg-gray-100 px-1 rounded">{csvSep === '\t' ? 'TAB' : csvSep}</code> ·{' '}
                {csvRawRows.length} righe rilevate
              </p>

              {/* Anteprima prime 3 righe */}
              <div className="overflow-x-auto rounded-lg border text-xs">
                <table className="w-full min-w-max">
                  <thead className="bg-gray-50">
                    <tr>{csvHeaders.map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {csvRawRows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-t">
                        {r.map((c, j) => <td key={j} className="px-3 py-1.5 text-gray-600 whitespace-nowrap max-w-[120px] truncate">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'date', label: 'Colonna DATA' },
                  { key: 'description', label: 'Colonna DESCRIZIONE' },
                  { key: 'amount', label: 'Colonna IMPORTO' },
                  { key: 'type', label: 'Colonna TIPO (opz.)' },
                ] as const).map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
                    <select
                      value={csvMapping[key]}
                      onChange={e => setCsvMapping(m => ({ ...m, [key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="">— Non presente —</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Segno importo</label>
                <select
                  value={csvMapping.amountSign}
                  onChange={e => setCsvMapping(m => ({ ...m, amountSign: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="auto">Automatico (negativo = uscita)</option>
                  <option value="positive_credit">Positivo = entrata</option>
                  <option value="column">Usa colonna Tipo</option>
                </select>
              </div>

              <button
                onClick={applyCsvMapping}
                disabled={!csvMapping.date || !csvMapping.description || !csvMapping.amount}
                className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Avanti — Anteprima transazioni <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Preview table */}
          {!loading && !saved && (step === 'preview' && (mode !== 'csv' || csvStep === 3)) && rows.length > 0 && (
            <div className="space-y-3">
              {/* Stats */}
              <div className="flex gap-3 text-xs flex-wrap items-center">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium">{includedCount} da importare</span>
                {dupCount > 0 && <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">{dupCount} possibili duplicati</span>}
                {errCount > 0 && <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full">{errCount} errori</span>}
                {hasApiKey && (
                  <button
                    onClick={suggestAllCategories}
                    disabled={loading}
                    className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full flex items-center gap-1 hover:bg-purple-100"
                  >
                    <Sparkles className="h-3 w-3" />
                    Suggerisci categorie AI
                  </button>
                )}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-gray-500">Conto:</span>
                  <select
                    className="border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={rows[0]?.account_id || defaultAccountId}
                    onChange={e => {
                      const v = e.target.value
                      setGlobalAccountId(v)
                      setRows(rs => rs.map(r => ({ ...r, account_id: v })))
                    }}
                  >
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border text-xs">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-2 py-2 w-8"><span className="sr-only">Includi</span></th>
                      <th className="px-2 py-2">Data</th>
                      <th className="px-2 py-2">Descrizione</th>
                      <th className="px-2 py-2 text-right">Importo</th>
                      <th className="px-2 py-2">Tipo</th>
                      <th className="px-2 py-2">Categoria</th>
                      <th className="px-2 py-2">Conto</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr
                        key={row._id}
                        className={`border-t transition-colors ${
                          row.hasError ? 'bg-red-50' :
                          row.isDuplicate ? 'bg-yellow-50' :
                          row.include ? 'bg-green-50/40' : 'bg-gray-50/50 opacity-60'
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.include && !row.hasError}
                            disabled={row.hasError}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, include: e.target.checked } : r))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, date: e.target.value, hasError: !e.target.value } : r))}
                            className="w-28 border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.description}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, description: e.target.value } : r))}
                            className="w-full min-w-[160px] border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, amount: parseFloat(e.target.value) || 0 } : r))}
                            className="w-20 border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.type}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, type: e.target.value as any } : r))}
                            className="border rounded px-1 py-0.5 text-xs focus:outline-none"
                          >
                            <option value="uscita">Uscita</option>
                            <option value="entrata">Entrata</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.category_id}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, category_id: e.target.value } : r))}
                            className="border rounded px-1 py-0.5 text-xs focus:outline-none max-w-[120px]"
                          >
                            <option value="">— —</option>
                            {categories.filter(c => c.type === row.type || c.type === 'risparmio').map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          {row.intesaCategory && !row.category_id && (
                            <p className="text-[10px] text-gray-400 mt-0.5 max-w-[120px] truncate" title={row.intesaCategory}>
                              ISP: {row.intesaCategory}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.account_id}
                            onChange={e => setRows(rs => rs.map(r => r._id === row._id ? { ...r, account_id: e.target.value } : r))}
                            className="border rounded px-1 py-0.5 text-xs focus:outline-none max-w-[100px]"
                          >
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => setRows(rs => rs.filter(r => r._id !== row._id))}
                            className="text-gray-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {!saved && !loading && (
          <div className="flex gap-3 p-4 border-t flex-shrink-0">
            {step === 'preview' && mode === 'csv' && csvStep === 3 && (
              <button
                onClick={() => { setCsvStep(2) }}
                className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" /> Indietro
              </button>
            )}
            {step === 'preview' && (mode !== 'csv' || csvStep === 3) && (
              <button
                onClick={() => { reset(); setMode(mode) }}
                className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Nuovo upload
              </button>
            )}
            <div className="flex-1" />
            <button onClick={handleClose} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Annulla
            </button>
            {step === 'preview' && (mode !== 'csv' || csvStep === 3) && includedCount > 0 && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Importa {includedCount} transazioni
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DropZone sub-component ───────────────────────────────────────────────────
function DropZone({ accept, label, icon, onFile, disabled }: {
  accept: string
  label: string
  icon: React.ReactNode
  onFile: (file: File) => void
  disabled: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        if (disabled) return
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
      className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 transition-colors ${
        disabled
          ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
          : dragging
          ? 'border-primary bg-primary/5 cursor-pointer'
          : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50 cursor-pointer'
      }`}
    >
      {icon}
      <p className="text-sm text-gray-500 text-center">{label}</p>
      <p className="text-xs text-gray-400">{accept}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        disabled={disabled}
      />
    </div>
  )
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
