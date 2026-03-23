import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import {
  getMonthlyAmounts, getAnnualAmount, getRecurrenceLabel, getTransferAnnual,
  fmtEur, MONTHS_IT, MONTHS_FULL
} from './budgetUtils'

// ─── Constants ───────────────────────────────────────────────────────────────

const BRAND = '#2563eb'         // blue-600
const BRAND_LIGHT = '#eff6ff'   // blue-50
const GRAY = '#6b7280'          // gray-500
const DARK = '#111827'          // gray-900
const LINE_H = 7
const MARGIN = 15
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_Y = 284

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}

function todayFile(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function createDoc(orientation: 'p' | 'l' = 'p'): jsPDF {
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' })
}

function addHeader(pdf: jsPDF, title: string, subtitle: string, familyName = '') {
  const w = pdf.internal.pageSize.getWidth()
  // Blue header bar
  pdf.setFillColor(BRAND)
  pdf.rect(0, 0, w, 20, 'F')
  // App name
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Family Budget', MARGIN, 8)
  if (familyName) {
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(familyName, MARGIN, 13)
  }
  // Title on right
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, w - MARGIN, 8, { align: 'right' })
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(subtitle, w - MARGIN, 13, { align: 'right' })
}

function addFooterToAllPages(pdf: jsPDF, dateStr: string) {
  const totalPages = pdf.getNumberOfPages()
  const w = pdf.internal.pageSize.getWidth()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.3)
    pdf.line(MARGIN, FOOTER_Y, w - MARGIN, FOOTER_Y)
    pdf.setFontSize(7)
    pdf.setTextColor(GRAY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Generato il ${dateStr}`, MARGIN, FOOTER_Y + 4)
    pdf.text(`Pagina ${i} di ${totalPages}`, w - MARGIN, FOOTER_Y + 4, { align: 'right' })
  }
}

interface ColDef {
  label: string
  key: string
  width: number
  align?: 'left' | 'right' | 'center'
  format?: (v: any, row: any) => string
}

interface TableConfig {
  pdf: jsPDF
  startY: number
  cols: ColDef[]
  rows: any[]
  headerBg?: string   // hex
  headerFg?: string
  rowBgEven?: string
  fontSize?: number
  onNewPage?: (newY: number) => number
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function drawTable(cfg: TableConfig): number {
  const {
    pdf, cols, rows,
    headerBg = '#1d4ed8',
    headerFg = '#ffffff',
    rowBgEven = '#f8fafc',
    fontSize = 8,
  } = cfg
  const pageH = pdf.internal.pageSize.getHeight()
  const pageW = pdf.internal.pageSize.getWidth()
  const totalW = cols.reduce((s, c) => s + c.width, 0)
  const leftX = (pageW - totalW) / 2
  let y = cfg.startY
  const rowH = LINE_H

  function drawHeaderRow() {
    const [hr, hg, hb] = hexToRgb(headerBg)
    pdf.setFillColor(hr, hg, hb)
    pdf.rect(leftX, y, totalW, rowH, 'F')
    pdf.setTextColor(hexToRgb(headerFg)[0], hexToRgb(headerFg)[1], hexToRgb(headerFg)[2])
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', 'bold')
    let cx = leftX
    for (const col of cols) {
      const align = col.align || 'left'
      const tx = align === 'right' ? cx + col.width - 1.5 : align === 'center' ? cx + col.width / 2 : cx + 1.5
      pdf.text(col.label, tx, y + rowH - 2, { align })
      cx += col.width
    }
    y += rowH
  }

  drawHeaderRow()

  for (let ri = 0; ri < rows.length; ri++) {
    // Page break check
    if (y + rowH > pageH - 16) {
      pdf.addPage()
      y = cfg.onNewPage ? cfg.onNewPage(25) : 25
      drawHeaderRow()
    }
    const row = rows[ri]
    if (ri % 2 === 1) {
      const [er, eg, eb] = hexToRgb(rowBgEven)
      pdf.setFillColor(er, eg, eb)
      pdf.rect(leftX, y, totalW, rowH, 'F')
    }
    pdf.setTextColor(...hexToRgb(DARK))
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', 'normal')
    let cx = leftX
    for (const col of cols) {
      const rawVal = row[col.key]
      const text = col.format ? col.format(rawVal, row) : String(rawVal ?? '')
      const align = col.align || 'left'
      const tx = align === 'right' ? cx + col.width - 1.5 : align === 'center' ? cx + col.width / 2 : cx + 1.5
      // Clip text to column width
      const maxChars = Math.floor(col.width / (fontSize * 0.45))
      const clipped = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
      pdf.text(clipped, tx, y + rowH - 2, { align })
      cx += col.width
    }
    // bottom border
    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.1)
    pdf.line(leftX, y + rowH, leftX + totalW, y + rowH)
    y += rowH
  }
  return y
}

async function captureElement(el: HTMLElement): Promise<string> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  })
  return canvas.toDataURL('image/png')
}

function sectionTitle(pdf: jsPDF, text: string, y: number): number {
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...hexToRgb(BRAND))
  pdf.text(text, MARGIN, y)
  pdf.setDrawColor(...hexToRgb(BRAND))
  pdf.setLineWidth(0.4)
  pdf.line(MARGIN, y + 1, MARGIN + CONTENT_W, y + 1)
  pdf.setTextColor(...hexToRgb(DARK))
  return y + 6
}

function kpiBox(pdf: jsPDF, x: number, y: number, w: number, label: string, value: string, color: string) {
  const [r, g, b] = hexToRgb(color + '22'.slice(-6)) // light tint trick — use BRAND_LIGHT fixed
  pdf.setFillColor(239, 246, 255) // blue-50
  pdf.roundedRect(x, y, w, 14, 2, 2, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(GRAY)
  pdf.text(label, x + w / 2, y + 5, { align: 'center' })
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  const [vr, vg, vb] = hexToRgb(color)
  pdf.setTextColor(vr, vg, vb)
  pdf.text(value, x + w / 2, y + 11, { align: 'center' })
  pdf.setTextColor(...hexToRgb(DARK))
}

// ─── PDF Budget Completo ──────────────────────────────────────────────────────

export async function exportBudgetCompleto(params: {
  year: number
  familyName: string
  budgetCategories: any[]
  budgetItems: any[]
  accounts: any[]
  plannedTransfers: any[]
  chartsRef?: HTMLElement | null
}) {
  const { year, familyName, budgetCategories, budgetItems, accounts, plannedTransfers, chartsRef } = params
  const pdf = createDoc()
  const dateStr = today()

  const incomeItems  = budgetItems.filter(i => i.type === 'income'      && i.active !== false)
  const expenseItems = budgetItems.filter(i => i.type === 'expense'     && i.active !== false)
  const savingItems  = budgetItems.filter(i => i.type === 'saving_goal' && i.active !== false)

  const totalIncome  = incomeItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
  const totalExpense = expenseItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
  const totalSaving  = savingItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
  const risparmioLibero = totalIncome - totalExpense - totalSaving

  // ── Page 1 — Cover / KPI ─────────────────────────────────────────────────
  addHeader(pdf, 'Preventivo Budget', `Anno ${year}`, familyName)
  let y = 30

  // KPI boxes
  const kpiW = (CONTENT_W - 9) / 4
  kpiBox(pdf, MARGIN,               y, kpiW, 'Entrate annuali',   fmtEur(totalIncome),  '#16a34a')
  kpiBox(pdf, MARGIN + kpiW + 3,    y, kpiW, 'Uscite annuali',    fmtEur(totalExpense), '#dc2626')
  kpiBox(pdf, MARGIN + (kpiW+3)*2,  y, kpiW, 'Risparmio obiettivi', fmtEur(totalSaving), '#7c3aed')
  kpiBox(pdf, MARGIN + (kpiW+3)*3,  y, kpiW, 'Saldo disponibile', fmtEur(risparmioLibero), risparmioLibero >= 0 ? '#2563eb' : '#dc2626')
  y += 22

  // Charts capture (if element provided)
  if (chartsRef) {
    try {
      const imgData = await captureElement(chartsRef)
      const imgProps = pdf.getImageProperties(imgData)
      const imgW = CONTENT_W
      const imgH = (imgProps.height / imgProps.width) * imgW
      const safeH = Math.min(imgH, PAGE_H - y - 20)
      pdf.addImage(imgData, 'PNG', MARGIN, y, imgW, safeH)
      y += safeH + 6
    } catch { /* skip */ }
  }

  // ── Page 2 onwards — Items by category ───────────────────────────────────
  pdf.addPage()
  addHeader(pdf, 'Voci Preventivo', `Anno ${year}`, familyName)
  y = 28

  for (const cat of budgetCategories) {
    const catItems = budgetItems.filter((i: any) => i.budget_category_id === cat.id && i.active !== false)
    if (catItems.length === 0) continue

    y = sectionTitle(pdf, `${cat.icon || '📂'} ${cat.name}`, y)

    const rows = catItems.map((item: any) => ({
      desc: item.description,
      type: item.type === 'income' ? 'Entrata' : item.type === 'expense' ? 'Uscita' : 'Obiettivo',
      recurrence: getRecurrenceLabel(item),
      amount: fmtEur(Number(item.amount)),
      annual: fmtEur(getAnnualAmount(item)),
    }))

    y = drawTable({
      pdf,
      startY: y,
      cols: [
        { label: 'Descrizione', key: 'desc', width: 70 },
        { label: 'Tipo', key: 'type', width: 24 },
        { label: 'Ricorrenza', key: 'recurrence', width: 48 },
        { label: 'Importo', key: 'amount', width: 28, align: 'right' },
        { label: 'Annuale', key: 'annual', width: 28, align: 'right' },
      ],
      rows,
      onNewPage: (ny) => {
        addHeader(pdf, 'Voci Preventivo', `Anno ${year}`, familyName)
        return ny
      },
    })
    y += 4
  }

  // ── Monthly table — landscape page ───────────────────────────────────────
  pdf.addPage('l')
  const lW = 297
  const lH = 210
  const lMargin = 10
  const lContentW = lW - lMargin * 2
  addHeader(pdf, 'Tabella Mensile', `Anno ${year}`, familyName)
  y = 25

  const allActive = budgetItems.filter((i: any) => i.active !== false)
  const monthCols: ColDef[] = [
    { label: 'Voce', key: 'desc', width: 52 },
    ...MONTHS_IT.map((m, idx) => ({
      label: m,
      key: `m${idx}`,
      width: (lContentW - 52 - 22) / 12,
      align: 'right' as const,
      format: (v: any) => v > 0 ? fmtEur(v) : '-',
    })),
    { label: 'Totale', key: 'total', width: 22, align: 'right', format: (v: any) => fmtEur(v) },
  ]

  const monthRows = allActive.map((item: any) => {
    const months = getMonthlyAmounts(item)
    const row: any = { desc: item.description, total: months.reduce((s: number, a: number) => s + a, 0) }
    months.forEach((v, i) => { row[`m${i}`] = v })
    return row
  })

  drawTable({
    pdf,
    startY: y,
    cols: monthCols,
    rows: monthRows,
    fontSize: 6.5,
    onNewPage: (ny) => {
      addHeader(pdf, 'Tabella Mensile', `Anno ${year}`, familyName)
      return ny
    },
  })

  addFooterToAllPages(pdf, dateStr)
  pdf.save(`FamilyBudget_Budget_${year}_${todayFile()}.pdf`)
}

// ─── PDF Budget per Conto ─────────────────────────────────────────────────────

export async function exportBudgetPerConto(params: {
  year: number
  familyName: string
  budgetItems: any[]
  accounts: any[]
  plannedTransfers: any[]
}) {
  const { year, familyName, budgetItems, accounts, plannedTransfers } = params
  const pdf = createDoc()
  const dateStr = today()

  addHeader(pdf, 'Budget per Conto', `Anno ${year}`, familyName)
  let y = 28

  const activeAccounts = accounts.filter((a: any) => a.active !== false)

  for (const account of activeAccounts) {
    const incomeAssigned = budgetItems
      .filter((i: any) => i.type === 'income' && i.planned_account_id === account.id && i.active !== false)
      .reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
    const expenseAssigned = budgetItems
      .filter((i: any) => (i.type === 'expense' || i.type === 'saving_goal') && i.planned_account_id === account.id && i.active !== false)
      .reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
    const transfersIn = plannedTransfers
      .filter((t: any) => t.to_account_id === account.id)
      .reduce((s: number, t: any) => s + getTransferAnnual(t), 0)
    const transfersOut = plannedTransfers
      .filter((t: any) => t.from_account_id === account.id)
      .reduce((s: number, t: any) => s + getTransferAnnual(t), 0)

    if (incomeAssigned === 0 && expenseAssigned === 0 && transfersIn === 0 && transfersOut === 0) continue

    if (y > PAGE_H - 60) {
      pdf.addPage()
      addHeader(pdf, 'Budget per Conto', `Anno ${year}`, familyName)
      y = 28
    }

    y = sectionTitle(pdf, `${account.name}  (${account.type})`, y)

    const net = incomeAssigned + transfersIn - expenseAssigned - transfersOut

    // Mini KPI row
    const kpiW2 = (CONTENT_W - 9) / 4
    kpiBox(pdf, MARGIN,               y, kpiW2, 'Entrate assegnate', fmtEur(incomeAssigned),  '#16a34a')
    kpiBox(pdf, MARGIN + kpiW2 + 3,   y, kpiW2, 'Uscite assegnate',  fmtEur(expenseAssigned), '#dc2626')
    kpiBox(pdf, MARGIN + (kpiW2+3)*2, y, kpiW2, 'Trasferimenti netti', fmtEur(transfersIn - transfersOut), '#7c3aed')
    kpiBox(pdf, MARGIN + (kpiW2+3)*3, y, kpiW2, 'Saldo netto', fmtEur(net), net >= 0 ? '#2563eb' : '#dc2626')
    y += 20

    // Items assigned to this account
    const assignedItems = budgetItems.filter((i: any) => i.planned_account_id === account.id && i.active !== false)
    if (assignedItems.length > 0) {
      const rows = assignedItems.map((item: any) => ({
        desc: item.description,
        type: item.type === 'income' ? 'Entrata' : item.type === 'expense' ? 'Uscita' : 'Obiettivo',
        recurrence: getRecurrenceLabel(item),
        annual: fmtEur(getAnnualAmount(item)),
      }))
      y = drawTable({
        pdf, startY: y,
        cols: [
          { label: 'Descrizione', key: 'desc', width: 90 },
          { label: 'Tipo', key: 'type', width: 28 },
          { label: 'Ricorrenza', key: 'recurrence', width: 52 },
          { label: 'Annuale', key: 'annual', width: 28, align: 'right' },
        ],
        rows,
        onNewPage: (ny) => {
          addHeader(pdf, 'Budget per Conto', `Anno ${year}`, familyName)
          return ny
        },
      })
      y += 6
    } else {
      y += 4
    }
  }

  addFooterToAllPages(pdf, dateStr)
  pdf.save(`FamilyBudget_PerConto_${year}_${todayFile()}.pdf`)
}

// ─── PDF Budget per Categoria ─────────────────────────────────────────────────

export async function exportBudgetPerCategoria(params: {
  year: number
  familyName: string
  budgetCategories: any[]
  budgetItems: any[]
}) {
  const { year, familyName, budgetCategories, budgetItems } = params
  const pdf = createDoc()
  const dateStr = today()

  addHeader(pdf, 'Budget per Categoria', `Anno ${year}`, familyName)
  let y = 28

  for (const cat of budgetCategories) {
    const catItems = budgetItems.filter((i: any) => i.budget_category_id === cat.id && i.active !== false)
    if (catItems.length === 0) continue

    if (y > PAGE_H - 50) {
      pdf.addPage()
      addHeader(pdf, 'Budget per Categoria', `Anno ${year}`, familyName)
      y = 28
    }

    const catTotal = catItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
    y = sectionTitle(pdf, `${cat.icon || '📂'} ${cat.name}  —  ${fmtEur(catTotal)} annui`, y)

    const rows = catItems.map((item: any) => ({
      desc: item.description,
      type: item.type === 'income' ? 'Entrata' : item.type === 'expense' ? 'Uscita' : 'Obiettivo',
      recurrence: getRecurrenceLabel(item),
      amount: fmtEur(Number(item.amount)),
      annual: fmtEur(getAnnualAmount(item)),
      variable: item.is_variable ? 'Sì' : 'No',
    }))

    y = drawTable({
      pdf, startY: y,
      cols: [
        { label: 'Descrizione', key: 'desc', width: 68 },
        { label: 'Tipo', key: 'type', width: 22 },
        { label: 'Ricorrenza', key: 'recurrence', width: 48 },
        { label: 'Importo', key: 'amount', width: 26, align: 'right' },
        { label: 'Annuale', key: 'annual', width: 26, align: 'right' },
        { label: 'Var.', key: 'variable', width: 10, align: 'center' },
      ],
      rows,
      onNewPage: (ny) => {
        addHeader(pdf, 'Budget per Categoria', `Anno ${year}`, familyName)
        return ny
      },
    })
    y += 5
  }

  addFooterToAllPages(pdf, dateStr)
  pdf.save(`FamilyBudget_PerCategoria_${year}_${todayFile()}.pdf`)
}

// ─── PDF Tracking Mensile ─────────────────────────────────────────────────────

export async function exportTrackingMensile(params: {
  year: number
  month: number
  familyName: string
  transactions: any[]
  categories: any[]
  accounts: any[]
  budgets: any[]
}) {
  const { year, month, familyName, transactions, categories, accounts, budgets } = params
  const pdf = createDoc()
  const dateStr = today()
  const monthName = MONTHS_FULL[month - 1]

  addHeader(pdf, 'Tracking Mensile', `${monthName} ${year}`, familyName)
  let y = 28

  const income    = transactions.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0)
  const expenses  = transactions.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0)
  const balance   = income - expenses
  const savRate   = income > 0 ? (balance / income) * 100 : 0

  // KPIs
  const kpiW3 = (CONTENT_W - 9) / 4
  kpiBox(pdf, MARGIN,               y, kpiW3, 'Entrate',        fmtEur(income),    '#16a34a')
  kpiBox(pdf, MARGIN + kpiW3 + 3,   y, kpiW3, 'Uscite',         fmtEur(expenses),  '#dc2626')
  kpiBox(pdf, MARGIN + (kpiW3+3)*2, y, kpiW3, 'Saldo',          fmtEur(balance),   balance >= 0 ? '#2563eb' : '#dc2626')
  kpiBox(pdf, MARGIN + (kpiW3+3)*3, y, kpiW3, 'Tasso risparmio', `${savRate.toFixed(1)}%`, '#7c3aed')
  y += 22

  // Transactions list
  y = sectionTitle(pdf, `Transazioni — ${monthName} ${year}`, y)

  const rows = transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => {
      const cat = categories.find((c: any) => c.id === t.category_id)
      const acc = accounts.find((a: any) => a.id === t.account_id)
      return {
        date: new Date(t.date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        desc: t.description,
        category: cat?.name || '-',
        account: acc?.name || '-',
        type: t.type === 'entrata' ? '+' : '-',
        amount: fmtEur(t.amount),
      }
    })

  y = drawTable({
    pdf, startY: y,
    cols: [
      { label: 'Data',      key: 'date',     width: 16, align: 'center' },
      { label: 'Descrizione', key: 'desc',   width: 68 },
      { label: 'Categoria', key: 'category', width: 36 },
      { label: 'Conto',     key: 'account',  width: 30 },
      { label: '+/-',       key: 'type',     width: 10, align: 'center' },
      { label: 'Importo',   key: 'amount',   width: 28, align: 'right' },
    ],
    rows,
    onNewPage: (ny) => {
      addHeader(pdf, 'Tracking Mensile', `${monthName} ${year}`, familyName)
      return ny
    },
  })
  y += 6

  // Per-category summary
  if (y > PAGE_H - 60) { pdf.addPage(); addHeader(pdf, 'Tracking Mensile', `${monthName} ${year}`, familyName); y = 28 }
  y = sectionTitle(pdf, 'Riepilogo per Categoria', y)

  const byCat = categories
    .map(cat => {
      const catTxs = transactions.filter(t => t.category_id === cat.id)
      const total = catTxs.reduce((s, t) => s + t.amount, 0)
      if (total === 0) return null
      const bud = budgets.find((b: any) => b.category_id === cat.id)?.amount || 0
      const pct = bud > 0 ? (total / bud * 100).toFixed(0) + '%' : '-'
      return { name: cat.name, type: cat.type === 'entrata' ? 'Entrata' : 'Uscita', count: String(catTxs.length), budget: bud > 0 ? fmtEur(bud) : '-', total: fmtEur(total), pct }
    })
    .filter(Boolean) as any[]

  y = drawTable({
    pdf, startY: y,
    cols: [
      { label: 'Categoria', key: 'name',   width: 70 },
      { label: 'Tipo',      key: 'type',   width: 24 },
      { label: 'N. tx',     key: 'count',  width: 16, align: 'center' },
      { label: 'Budget',    key: 'budget', width: 34, align: 'right' },
      { label: 'Speso',     key: 'total',  width: 34, align: 'right' },
      { label: 'vs Budget', key: 'pct',    width: 20, align: 'right' },
    ],
    rows: byCat,
    onNewPage: (ny) => {
      addHeader(pdf, 'Tracking Mensile', `${monthName} ${year}`, familyName)
      return ny
    },
  })

  addFooterToAllPages(pdf, dateStr)
  pdf.save(`FamilyBudget_Tracking_${year}${String(month).padStart(2, '0')}_${todayFile()}.pdf`)
}

// ─── PDF Tracking Annuale ─────────────────────────────────────────────────────

export async function exportTrackingAnnuale(params: {
  year: number
  familyName: string
  yearTransactions: any[]
  budgetItems: any[]
  categories: any[]
}) {
  const { year, familyName, yearTransactions, budgetItems, categories } = params
  const pdf = createDoc('l')
  const lW = 297
  const dateStr = today()

  addHeader(pdf, 'Tracking Annuale', `Anno ${year}`, familyName)
  let y = 25

  // Monthly totals
  const monthlyIncome  = new Array(12).fill(0)
  const monthlyExpense = new Array(12).fill(0)
  yearTransactions.forEach(t => {
    const m = new Date(t.date + 'T00:00:00').getMonth()
    if (t.type === 'entrata') monthlyIncome[m]  += t.amount
    else                       monthlyExpense[m] += t.amount
  })

  const totalIncome  = monthlyIncome.reduce((s, v) => s + v, 0)
  const totalExpense = monthlyExpense.reduce((s, v) => s + v, 0)

  // Annual KPIs
  const kW = (lW - 30 - 9) / 4
  kpiBox(pdf, 10,            y, kW, 'Entrate anno',  fmtEur(totalIncome),  '#16a34a')
  kpiBox(pdf, 10 + kW + 3,   y, kW, 'Uscite anno',   fmtEur(totalExpense), '#dc2626')
  kpiBox(pdf, 10 + (kW+3)*2, y, kW, 'Saldo',         fmtEur(totalIncome - totalExpense), totalIncome >= totalExpense ? '#2563eb' : '#dc2626')
  kpiBox(pdf, 10 + (kW+3)*3, y, kW, 'Tasso risparmio', totalIncome > 0 ? `${((totalIncome - totalExpense) / totalIncome * 100).toFixed(1)}%` : '—', '#7c3aed')
  y += 22

  // Monthly table
  const lContentW2 = lW - 20
  const colW = (lContentW2 - 36) / 12

  const monthRows2 = [
    { label: 'Entrate',  ...Object.fromEntries(MONTHS_IT.map((_, i) => [`m${i}`, fmtEur(monthlyIncome[i])])), total: fmtEur(totalIncome) },
    { label: 'Uscite',   ...Object.fromEntries(MONTHS_IT.map((_, i) => [`m${i}`, fmtEur(monthlyExpense[i])])), total: fmtEur(totalExpense) },
    { label: 'Saldo',    ...Object.fromEntries(MONTHS_IT.map((_, i) => [`m${i}`, fmtEur(monthlyIncome[i] - monthlyExpense[i])])), total: fmtEur(totalIncome - totalExpense) },
  ]

  y = drawTable({
    pdf, startY: y,
    cols: [
      { label: '',        key: 'label', width: 30 },
      ...MONTHS_IT.map((m, i) => ({ label: m, key: `m${i}`, width: colW, align: 'right' as const, format: (v: any) => v })),
      { label: 'Totale', key: 'total', width: 36, align: 'right' as const },
    ],
    rows: monthRows2,
    fontSize: 7,
  })
  y += 6

  // Per category annual
  const catRows = categories
    .map(cat => {
      const annual = yearTransactions.filter(t => t.category_id === cat.id).reduce((s, t) => s + t.amount, 0)
      if (annual === 0) return null
      const monthAmounts = new Array(12).fill(0)
      yearTransactions.filter(t => t.category_id === cat.id).forEach(t => {
        const m = new Date(t.date + 'T00:00:00').getMonth()
        monthAmounts[m] += t.amount
      })
      const row: any = { label: cat.name, total: fmtEur(annual) }
      monthAmounts.forEach((v, i) => { row[`m${i}`] = v > 0 ? fmtEur(v) : '-' })
      return row
    })
    .filter(Boolean) as any[]

  if (catRows.length > 0) {
    if (y > 180) { pdf.addPage('l'); addHeader(pdf, 'Tracking Annuale', `Anno ${year}`, familyName); y = 25 }
    y = sectionTitle(pdf, 'Dettaglio per Categoria', y)
    drawTable({
      pdf, startY: y,
      cols: [
        { label: 'Categoria', key: 'label', width: 30 },
        ...MONTHS_IT.map((m, i) => ({ label: m, key: `m${i}`, width: colW, align: 'right' as const, format: (v: any) => v })),
        { label: 'Totale', key: 'total', width: 36, align: 'right' as const },
      ],
      rows: catRows,
      fontSize: 7,
      onNewPage: (ny) => {
        addHeader(pdf, 'Tracking Annuale', `Anno ${year}`, familyName)
        return ny
      },
    })
  }

  addFooterToAllPages(pdf, dateStr)
  pdf.save(`FamilyBudget_TrackingAnnuale_${year}_${todayFile()}.pdf`)
}

// ─── PDF Dashboard Snapshot ───────────────────────────────────────────────────

export async function exportDashboardSnapshot(params: {
  year: number
  month: number
  familyName: string
  dashboardEl: HTMLElement
}) {
  const { year, month, familyName, dashboardEl } = params
  const pdf = createDoc()
  const dateStr = today()
  const monthName = MONTHS_FULL[month - 1]

  addHeader(pdf, 'Dashboard Snapshot', `${monthName} ${year}`, familyName)

  try {
    const imgData = await captureElement(dashboardEl)
    const imgProps = pdf.getImageProperties(imgData)
    const maxH = PAGE_H - 30
    const imgH = Math.min((imgProps.height / imgProps.width) * CONTENT_W, maxH)
    pdf.addImage(imgData, 'PNG', MARGIN, 24, CONTENT_W, imgH)
  } catch (e) {
    pdf.setFontSize(10)
    pdf.setTextColor(GRAY)
    pdf.text('Errore nella cattura del dashboard.', MARGIN, 40)
  }

  addFooterToAllPages(pdf, dateStr)
  pdf.save(`FamilyBudget_Dashboard_${year}${String(month).padStart(2, '0')}_${todayFile()}.pdf`)
}

// ─── PDF Estratto Conto ───────────────────────────────────────────────────────

export async function exportEstrattoConto(params: {
  account: any
  familyName: string
  transactions: any[]    // all transactions for this account (already filtered externally)
  categories: any[]
  fromDate: string       // 'YYYY-MM-DD'
  toDate: string
}) {
  const { account, familyName, transactions, categories, fromDate, toDate } = params
  const pdf = createDoc()
  const dateStr = today()

  const fromLabel = new Date(fromDate + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  const toLabel   = new Date(toDate   + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  addHeader(pdf, `Estratto Conto — ${account.name}`, `${fromLabel} → ${toLabel}`, familyName)
  let y = 28

  const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  // KPIs
  const totalIn  = sortedTx.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0)
  const totalOut = sortedTx.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0)
  const kW4 = (CONTENT_W - 6) / 3
  kpiBox(pdf, MARGIN,          y, kW4, 'Entrate periodo',  fmtEur(totalIn),              '#16a34a')
  kpiBox(pdf, MARGIN + kW4 + 3, y, kW4, 'Uscite periodo',  fmtEur(totalOut),             '#dc2626')
  kpiBox(pdf, MARGIN + (kW4+3)*2, y, kW4, 'Saldo periodo', fmtEur(totalIn - totalOut), (totalIn - totalOut) >= 0 ? '#2563eb' : '#dc2626')
  y += 20

  y = sectionTitle(pdf, `Movimenti — ${account.name}`, y)

  // Running balance
  let runningBalance = Number(account.balance || 0) - (totalIn - totalOut)
  const rows = sortedTx.map(t => {
    if (t.type === 'entrata') runningBalance += t.amount
    else runningBalance -= t.amount
    const cat = categories.find((c: any) => c.id === t.category_id)
    return {
      date: new Date(t.date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      desc: t.description,
      category: cat?.name || '-',
      type: t.type === 'entrata' ? 'Entrata' : 'Uscita',
      amount: fmtEur(t.amount),
      balance: fmtEur(runningBalance),
    }
  })

  drawTable({
    pdf, startY: y,
    cols: [
      { label: 'Data',        key: 'date',     width: 20, align: 'center' },
      { label: 'Descrizione', key: 'desc',     width: 72 },
      { label: 'Categoria',   key: 'category', width: 36 },
      { label: 'Tipo',        key: 'type',     width: 22 },
      { label: 'Importo',     key: 'amount',   width: 24, align: 'right' },
      { label: 'Saldo',       key: 'balance',  width: 24, align: 'right' },
    ],
    rows,
    onNewPage: (ny) => {
      addHeader(pdf, `Estratto Conto — ${account.name}`, `${fromLabel} → ${toLabel}`, familyName)
      return ny
    },
  })

  addFooterToAllPages(pdf, dateStr)
  const safeName = account.name.replace(/[^a-z0-9]/gi, '_')
  pdf.save(`FamilyBudget_EstrattoConto_${safeName}_${todayFile()}.pdf`)
}
