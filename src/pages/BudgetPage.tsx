import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../lib/utils'
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, Link } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

type Recurrence = 'weekly' | 'monthly' | 'annual' | 'once' | 'quarterly'
type ItemType = 'income' | 'expense' | 'saving_goal'

function getMonthlyAmounts(item: any): number[] {
  const amounts = new Array(12).fill(0)
  if (!item.active) return amounts
  const amt = Number(item.amount)
  switch (item.recurrence as Recurrence) {
    case 'monthly': return new Array(12).fill(amt)
    case 'weekly': return new Array(12).fill(Math.round(amt * 4.33 * 100) / 100)
    case 'annual':
      if (item.recurrence_month) amounts[item.recurrence_month - 1] = amt
      return amounts
    case 'once':
      if (item.recurrence_date) {
        const m = new Date(item.recurrence_date + 'T00:00:00').getMonth()
        amounts[m] = amt
      } else if (item.recurrence_month) {
        amounts[item.recurrence_month - 1] = amt
      }
      return amounts
    case 'quarterly': {
      const start = (item.recurrence_month ?? 1) - 1
      for (let i = 0; i < 4; i++) amounts[(start + i * 3) % 12] = amt
      return amounts
    }
    default: return amounts
  }
}

function getAnnualAmount(item: any): number {
  return getMonthlyAmounts(item).reduce((s: number, a: number) => s + a, 0)
}

function getRecurrenceLabel(item: any): string {
  const labels: Record<Recurrence, string> = {
    monthly: 'Mensile', weekly: 'Settimanale', annual: 'Annuale', once: 'Una tantum', quarterly: 'Trimestrale'
  }
  const base = labels[item.recurrence as Recurrence] || item.recurrence
  if (item.recurrence === 'annual' && item.recurrence_month) return `${base} (${MONTHS_IT[item.recurrence_month - 1]})`
  if (item.recurrence === 'quarterly' && item.recurrence_month) return `${base} (da ${MONTHS_IT[item.recurrence_month - 1]})`
  if (item.recurrence === 'once') {
    if (item.recurrence_date) {
      const d = new Date(item.recurrence_date + 'T00:00:00')
      return `${base} (${d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })})`
    }
    if (item.recurrence_month) return `${base} (${MONTHS_IT[item.recurrence_month - 1]})`
  }
  return base
}

function ItemRow({ item, onEdit, onDelete }: { item: any; onEdit: () => void; onDelete: () => void }) {
  const annual = getAnnualAmount(item)
  const amt = Number(item.amount)
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/80">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-800 truncate">{item.description}</span>
          {!item.active && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">inattivo</span>}
          {item.is_variable && <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded border border-yellow-200">var.</span>}
          {item.type === 'saving_goal' && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200">🎯 obiettivo</span>}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">{getRecurrenceLabel(item)}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold text-gray-800">{formatCurrency(amt)}</div>
        {annual !== amt && <div className="text-[10px] text-gray-400">{formatCurrency(annual)}/anno</div>}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100"><Edit2 className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

const defaultForm = (): {
  type: ItemType; description: string; budget_category_id: string | null
  recurrence: Recurrence; recurrence_month: number | null; recurrence_date: string
  amount: string; is_variable: boolean; notes: string; active: boolean
  target_amount: string; target_date: string; planned_account_id: string | null
} => ({
  type: 'expense', description: '', budget_category_id: null,
  recurrence: 'monthly', recurrence_month: null, recurrence_date: '',
  amount: '', is_variable: false, notes: '', active: true,
  target_amount: '', target_date: '', planned_account_id: null,
})

export default function BudgetPage() {
  const {
    budgetCategories, budgetItems, categoryBudgetMappings, yearTransactions,
    categories, accounts, selectedYear,
    loadBudgetCategories, loadBudgetItems, loadCategoryBudgetMappings, loadYearTransactions,
    addBudgetItem, updateBudgetItem, deleteBudgetItem,
    addBudgetCategory, updateBudgetCategory, deleteBudgetCategory,
    saveCategoryBudgetMapping,
  } = useAppStore()
  const { profile } = useAuthStore()

  const [view, setView] = useState<'preventivo' | 'mensile' | 'confronto'>('preventivo')
  const [viewYear, setViewYear] = useState(selectedYear)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selMonth, setSelMonth] = useState<number | null>(null)

  const [itemModal, setItemModal] = useState<{ mode: 'add' | 'edit'; item?: any; defaultType?: ItemType; defaultCatId?: string } | null>(null)
  const [itemForm, setItemForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)

  const [catModal, setCatModal] = useState<{ mode: 'add' | 'edit'; cat?: any } | null>(null)
  const [catForm, setCatForm] = useState({ name: '', icon: '📦', color: '#6366f1' })

  const [mappingModal, setMappingModal] = useState(false)
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (profile?.family_id) {
      loadBudgetCategories(profile.family_id)
      loadBudgetItems(profile.family_id, viewYear)
      loadCategoryBudgetMappings(profile.family_id)
      loadYearTransactions(profile.family_id, viewYear)
    }
  }, [profile?.family_id, viewYear])

  useEffect(() => {
    if (budgetCategories.length > 0 && Object.keys(expanded).length === 0) {
      const e: Record<string, boolean> = {}
      budgetCategories.forEach(c => { e[c.id] = true })
      setExpanded(e)
    }
  }, [budgetCategories.length])

  // ── derived lists
  const incomeItems = useMemo(() => budgetItems.filter((i: any) => i.type === 'income'), [budgetItems])
  const expenseItems = useMemo(() => budgetItems.filter((i: any) => i.type === 'expense'), [budgetItems])
  const savingItems = useMemo(() => budgetItems.filter((i: any) => i.type === 'saving_goal'), [budgetItems])

  // ── annual totals
  const incomeTotal = incomeItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
  const expenseTotal = expenseItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
  const savingTotal = savingItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
  const saldoDisponibile = incomeTotal - expenseTotal
  const risparmioLibero = saldoDisponibile - savingTotal

  // ── monthly aggregates for "mensile" tab
  const monthlyData = useMemo(() => {
    const inc = new Array(12).fill(0)
    const exp = new Array(12).fill(0)
    incomeItems.forEach((item: any) => { getMonthlyAmounts(item).forEach((a, i) => { inc[i] += a }) })
    ;[...expenseItems, ...savingItems].forEach((item: any) => { getMonthlyAmounts(item).forEach((a, i) => { exp[i] += a }) })
    const saldo = inc.map((v, i) => v - exp[i])
    let cum = 0
    const cumul = saldo.map(s => { cum += s; return cum })
    return { inc, exp, saldo, cumul }
  }, [incomeItems, expenseItems, savingItems])

  const monthlyRows = useMemo(() =>
    budgetCategories.map((cat: any) => {
      const items = budgetItems.filter((i: any) => i.budget_category_id === cat.id)
      const monthly = new Array(12).fill(0)
      items.forEach((item: any) => { getMonthlyAmounts(item).forEach((a, idx) => { monthly[idx] += a }) })
      return { cat, items, monthly, total: monthly.reduce((s: number, a: number) => s + a, 0) }
    }), [budgetCategories, budgetItems])

  // ── confronto
  const confronto = useMemo(() => {
    const txMap: Record<string, string> = {}
    categoryBudgetMappings.forEach((m: any) => { txMap[m.transaction_category_id] = m.budget_category_id })

    const actual: Record<string, number[]> = {}
    const budget: Record<string, number[]> = {}
    budgetCategories.forEach((cat: any) => {
      actual[cat.id] = new Array(12).fill(0)
      budget[cat.id] = new Array(12).fill(0)
    })
    yearTransactions.forEach((tx: any) => {
      // Prefer direct budget_category_id on transaction, fallback to mapping
      const bcId = tx.budget_category_id || txMap[tx.category_id]
      if (!bcId || !actual[bcId]) return
      const m = new Date(tx.date + 'T00:00:00').getMonth()
      actual[bcId][m] += tx.type === 'uscita' ? Number(tx.amount) : -Number(tx.amount)
    })
    budgetItems.forEach((item: any) => {
      if (!item.budget_category_id || !budget[item.budget_category_id]) return
      getMonthlyAmounts(item).forEach((a, idx) => { budget[item.budget_category_id][idx] += a })
    })
    return { actual, budget, txMap }
  }, [budgetCategories, budgetItems, yearTransactions, categoryBudgetMappings])

  const curMonth = new Date().getFullYear() === viewYear ? new Date().getMonth() : 11
  const ytdBudget = useMemo(() => budgetCategories.reduce((s: number, cat: any) => {
    for (let m = 0; m <= curMonth; m++) s += confronto.budget[cat.id]?.[m] || 0
    return s
  }, 0), [confronto, budgetCategories, curMonth])

  const ytdActual = useMemo(() => budgetCategories.reduce((s: number, cat: any) => {
    for (let m = 0; m <= curMonth; m++) s += confronto.actual[cat.id]?.[m] || 0
    return s
  }, 0), [confronto, budgetCategories, curMonth])

  const ytdIncome = useMemo(() => yearTransactions
    .filter((tx: any) => tx.type === 'entrata' && new Date(tx.date + 'T00:00:00').getMonth() <= curMonth)
    .reduce((s: number, tx: any) => s + Number(tx.amount), 0), [yearTransactions, curMonth])

  const monthsInRosso = useMemo(() => {
    let c = 0
    for (let m = 0; m <= curMonth; m++) {
      const b = budgetCategories.reduce((s: number, cat: any) => s + (confronto.budget[cat.id]?.[m] || 0), 0)
      const a = budgetCategories.reduce((s: number, cat: any) => s + (confronto.actual[cat.id]?.[m] || 0), 0)
      if (a > b && b > 0) c++
    }
    return c
  }, [confronto, budgetCategories, curMonth])

  // ── chart data for confronto tab (YTD per macrovoce)
  const confrontoChartData = useMemo(() => {
    return budgetCategories
      .map((cat: any) => {
        let budgetYTD = 0
        let actualYTD = 0
        for (let m = 0; m <= curMonth; m++) {
          budgetYTD += confronto.budget[cat.id]?.[m] || 0
          actualYTD += confronto.actual[cat.id]?.[m] || 0
        }
        return {
          name: `${cat.icon || ''} ${cat.name}`,
          preventivo: Math.round(budgetYTD),
          consuntivo: Math.round(actualYTD),
          color: cat.color || '#6366f1',
        }
      })
      .filter(d => d.preventivo > 0 || d.consuntivo > 0)
  }, [budgetCategories, confronto, curMonth])

  // ── grafici di sintesi (sezione 6.5 REV03)
  const [chartsView, setChartsView] = useState<'preventivo' | 'consuntivo'>('preventivo')

  // helper: shade di un hex in base all'indice (da colore base a versione più chiara)
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt((hex || '#6366f1').slice(1, 3), 16)
    const g = parseInt((hex || '#6366f1').slice(3, 5), 16)
    const b = parseInt((hex || '#6366f1').slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  // Pie 1: spese per conto (preventivo = planned_account_id, consuntivo = account_id su tx)
  const pieDataByConto = useMemo(() => {
    const spendItems = [...expenseItems, ...savingItems]
    if (chartsView === 'preventivo') {
      const map: Record<string, { name: string; value: number; color: string }> = {}
      accounts.forEach((a: any) => {
        const total = spendItems.filter((i: any) => i.planned_account_id === a.id).reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
        if (total > 0) map[a.id] = { name: a.name, value: Math.round(total), color: a.color || '#94a3b8' }
      })
      const nonAssigned = spendItems.filter((i: any) => !i.planned_account_id).reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
      const result = Object.values(map).sort((a, b) => b.value - a.value)
      if (nonAssigned > 0) result.push({ name: 'Non assegnato', value: Math.round(nonAssigned), color: '#cbd5e1' })
      return result
    } else {
      const map: Record<string, { name: string; value: number; color: string }> = {}
      yearTransactions.filter((tx: any) => tx.type === 'uscita').forEach((tx: any) => {
        const acc = accounts.find((a: any) => a.id === tx.account_id)
        if (!acc) return
        if (!map[acc.id]) map[acc.id] = { name: acc.name, value: 0, color: acc.color || '#94a3b8' }
        map[acc.id].value += Number(tx.amount)
      })
      return Object.values(map).map(d => ({ ...d, value: Math.round(d.value) })).sort((a, b) => b.value - a.value)
    }
  }, [expenseItems, savingItems, accounts, yearTransactions, chartsView])

  // Pie 2: spese per macro categoria
  const pieDataByMacro = useMemo(() => {
    if (chartsView === 'preventivo') {
      return budgetCategories
        .map((cat: any) => {
          const total = [...expenseItems, ...savingItems]
            .filter((i: any) => i.budget_category_id === cat.id)
            .reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
          return { name: `${cat.icon || ''} ${cat.name}`, value: Math.round(total), color: cat.color || '#6366f1' }
        })
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)
    } else {
      const txMap: Record<string, string> = {}
      categoryBudgetMappings.forEach((m: any) => { txMap[m.transaction_category_id] = m.budget_category_id })
      const map: Record<string, { name: string; value: number; color: string }> = {}
      yearTransactions.filter((tx: any) => tx.type === 'uscita').forEach((tx: any) => {
        const bcId = tx.budget_category_id || txMap[tx.category_id]
        if (!bcId) return
        const cat = budgetCategories.find((c: any) => c.id === bcId)
        if (!cat) return
        if (!map[bcId]) map[bcId] = { name: `${cat.icon || ''} ${cat.name}`, value: 0, color: cat.color || '#6366f1' }
        map[bcId].value += Number(tx.amount)
      })
      return Object.values(map).map(d => ({ ...d, value: Math.round(d.value) })).sort((a, b) => b.value - a.value)
    }
  }, [expenseItems, savingItems, budgetCategories, yearTransactions, categoryBudgetMappings, chartsView])

  // Chart 3: dati per stacked bar (voci per macro categoria)
  const stackedBarData = useMemo(() =>
    budgetCategories
      .map((cat: any) => {
        const items = [...expenseItems, ...savingItems].filter((i: any) => i.budget_category_id === cat.id)
        const catTotal = items.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
        return { cat, items, catTotal }
      })
      .filter(d => d.catTotal > 0)
      .sort((a, b) => b.catTotal - a.catTotal)
  , [expenseItems, savingItems, budgetCategories])

  const semaforoClass = (b: number, a: number) => {
    if (b === 0) return 'text-gray-400'
    const p = a / b
    if (p <= 0.9) return 'text-green-600'
    if (p <= 1.1) return 'text-yellow-600'
    return 'text-red-600'
  }
  const semaforoEmoji = (b: number, a: number) => {
    if (b === 0) return ''
    const p = a / b; if (p <= 0.9) return '🟢'; if (p <= 1.1) return '🟡'; return '🔴'
  }

  // ── handlers
  const openAddItem = (defaultType: ItemType = 'expense', defaultCatId?: string) => {
    const f = defaultForm(); f.type = defaultType; f.budget_category_id = defaultCatId || null
    setItemForm(f); setItemModal({ mode: 'add', defaultType, defaultCatId })
  }
  const openEditItem = (item: any) => {
    setItemForm({
      type: item.type, description: item.description, budget_category_id: item.budget_category_id || null,
      recurrence: item.recurrence, recurrence_month: item.recurrence_month || null,
      recurrence_date: item.recurrence_date || '', amount: String(item.amount),
      is_variable: !!item.is_variable, notes: item.notes || '', active: item.active !== false,
      target_amount: String(item.target_amount || ''), target_date: item.target_date || '',
      planned_account_id: item.planned_account_id || null,
    })
    setItemModal({ mode: 'edit', item })
  }
  const handleSaveItem = async () => {
    if (!profile?.family_id || !itemForm.description.trim() || !itemForm.amount) return
    setSaving(true)
    const payload: any = {
      family_id: profile.family_id, year: viewYear, type: itemForm.type,
      description: itemForm.description.trim(), budget_category_id: itemForm.budget_category_id,
      planned_account_id: itemForm.planned_account_id,
      recurrence: itemForm.recurrence, recurrence_month: itemForm.recurrence_month,
      recurrence_date: itemForm.recurrence_date || null,
      amount: parseFloat(itemForm.amount) || 0,
      is_variable: itemForm.is_variable, notes: itemForm.notes || null, active: itemForm.active,
    }
    if (itemForm.type === 'saving_goal') {
      payload.target_amount = parseFloat(itemForm.target_amount) || null
      payload.target_date = itemForm.target_date || null
    }
    if (itemModal?.mode === 'edit' && itemModal.item) await updateBudgetItem(itemModal.item.id, payload)
    else await addBudgetItem(payload)
    await loadBudgetItems(profile.family_id, viewYear)
    setSaving(false); setItemModal(null)
  }
  const handleDeleteItem = async (id: string) => {
    if (!profile?.family_id || !confirm('Eliminare questa voce?')) return
    await deleteBudgetItem(id)
  }
  const handleSaveCat = async () => {
    if (!profile?.family_id || !catForm.name.trim()) return
    setSaving(true)
    if (catModal?.mode === 'edit' && catModal.cat) {
      await updateBudgetCategory(catModal.cat.id, { name: catForm.name.trim(), icon: catForm.icon, color: catForm.color })
    } else {
      await addBudgetCategory({ family_id: profile.family_id, name: catForm.name.trim(), icon: catForm.icon, color: catForm.color, sort_order: budgetCategories.length, is_default: false })
    }
    await loadBudgetCategories(profile.family_id)
    setSaving(false); setCatModal(null)
  }
  const handleDeleteCat = async (id: string) => {
    if (!profile?.family_id || !confirm('Eliminare la macrovoce?')) return
    await deleteBudgetCategory(id)
  }
  const openMapping = () => {
    const draft: Record<string, string> = {}
    categoryBudgetMappings.forEach((m: any) => { draft[m.transaction_category_id] = m.budget_category_id })
    setMappingDraft(draft); setMappingModal(true)
  }
  const handleSaveMapping = async () => {
    if (!profile?.family_id) return
    setSaving(true)
    for (const cat of categories) {
      await saveCategoryBudgetMapping(profile.family_id, cat.id, mappingDraft[cat.id] || null)
    }
    await loadCategoryBudgetMappings(profile.family_id)
    setSaving(false); setMappingModal(false)
  }

  const fmt = (n: number) => formatCurrency(n, 'EUR').replace('€', '').trim()

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-500">Pianificazione e controllo</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => setViewYear(y => y - 1)} className="text-gray-400 hover:text-gray-700"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold w-12 text-center">{viewYear}</span>
          <button onClick={() => setViewYear(y => y + 1)} className="text-gray-400 hover:text-gray-700"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {(['preventivo', 'mensile', 'confronto'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {v === 'preventivo' ? 'Preventivo' : v === 'mensile' ? 'Mensile' : 'Confronto'}
          </button>
        ))}
      </div>

      {/* ═══ TAB: PREVENTIVO ═══════════════════════════════════ */}
      {view === 'preventivo' && (
        <div className="space-y-6">
          {/* A - ENTRATE */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-100">
              <div className="flex items-center gap-2">
                <span className="text-base">💰</span>
                <h2 className="font-semibold text-green-800 text-sm">A · Entrate</h2>
                <span className="text-sm font-medium text-green-600">{formatCurrency(incomeTotal)}</span>
              </div>
              <button onClick={() => openAddItem('income')} className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700">
                <Plus className="h-3 w-3" /> Aggiungi
              </button>
            </div>
            {incomeItems.length === 0
              ? <div className="text-center py-8 text-gray-400 text-sm">Nessuna entrata. Clicca "Aggiungi" per iniziare.</div>
              : <div className="divide-y">{incomeItems.map((item: any) => <ItemRow key={item.id} item={item} onEdit={() => openEditItem(item)} onDelete={() => handleDeleteItem(item.id)} />)}</div>
            }
          </div>

          {/* B - SPESE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                <span className="text-base">💸</span> B · Spese
                <span className="text-gray-500 font-normal">{formatCurrency(expenseTotal + savingTotal)}</span>
              </h2>
              <button onClick={() => { setCatForm({ name: '', icon: '📦', color: '#6366f1' }); setCatModal({ mode: 'add' }) }}
                className="text-xs text-gray-500 border px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Macrovoce
              </button>
            </div>
            {budgetCategories.length === 0 && (
              <div className="bg-white rounded-xl border shadow-sm text-center py-8 text-gray-400 text-sm">
                Nessuna macrovoce. Clicca "+ Macrovoce" per aggiungerne una.
              </div>
            )}
            {budgetCategories.map((cat: any) => {
              const catItems = [...expenseItems.filter((i: any) => i.budget_category_id === cat.id), ...savingItems.filter((i: any) => i.budget_category_id === cat.id)]
              const catTotal = catItems.reduce((s: number, i: any) => s + getAnnualAmount(i), 0)
              const isOpen = expanded[cat.id] !== false
              return (
                <div key={cat.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b cursor-pointer hover:bg-gray-50"
                    style={{ borderLeftWidth: 3, borderLeftColor: cat.color || '#6366f1' }}
                    onClick={() => setExpanded(e => ({ ...e, [cat.id]: !isOpen }))}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span>{cat.icon || '📦'}</span>
                      <span className="font-medium text-gray-800 text-sm truncate">{cat.name}</span>
                      <span className="text-xs text-gray-400">{formatCurrency(catTotal)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={e => { e.stopPropagation(); setCatForm({ name: cat.name, icon: cat.icon || '📦', color: cat.color || '#6366f1' }); setCatModal({ mode: 'edit', cat }) }}
                        className="p-1 text-gray-300 hover:text-gray-600"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteCat(cat.id) }}
                        className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                    </div>
                  </div>
                  {isOpen && (
                    <>
                      {catItems.length === 0
                        ? <div className="py-4 text-center text-sm text-gray-400">Nessuna voce</div>
                        : <div className="divide-y">{catItems.map((item: any) => <ItemRow key={item.id} item={item} onEdit={() => openEditItem(item)} onDelete={() => handleDeleteItem(item.id)} />)}</div>
                      }
                      <div className="px-4 py-2 border-t bg-gray-50 flex gap-3">
                        <button onClick={() => openAddItem('expense', cat.id)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Spesa
                        </button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => openAddItem('saving_goal', cat.id)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Obiettivo risparmio
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* C - RIEPILOGO */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-4 text-sm flex items-center gap-2"><span>📊</span> C · Riepilogo {viewYear}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Totale entrate previste</span>
                <span className="font-semibold text-green-600">+{formatCurrency(incomeTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Totale spese previste</span>
                <span className="font-semibold text-red-500">−{formatCurrency(expenseTotal)}</span>
              </div>
              <div className="h-px bg-blue-200 my-1" />
              <div className="flex justify-between font-bold text-base">
                <span className="text-gray-800">Saldo disponibile</span>
                <span className={saldoDisponibile >= 0 ? 'text-blue-700' : 'text-red-600'}>{formatCurrency(saldoDisponibile)}</span>
              </div>
              {savingTotal > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>di cui accantonato per obiettivi</span>
                    <span>−{formatCurrency(savingTotal)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-700">Risparmio libero</span>
                    <span className={risparmioLibero >= 0 ? 'text-green-700' : 'text-red-600'}>{formatCurrency(risparmioLibero)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* D - GRAFICI DI SINTESI */}
          {(expenseTotal + savingTotal) > 0 && (
            <div className="space-y-4">
              {/* Header + toggle */}
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <h2 className="font-semibold text-gray-700 text-sm">D · Grafici di Sintesi {viewYear}</h2>
                <div className="flex gap-1 ml-auto bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartsView('preventivo')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${chartsView === 'preventivo' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                  >Preventivo</button>
                  <button
                    onClick={() => setChartsView('consuntivo')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${chartsView === 'consuntivo' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                  >Consuntivo</button>
                </div>
              </div>

              {/* Riga 1: due torte affiancate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Torta 1 — per conto */}
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <h3 className="text-xs font-semibold text-gray-600 mb-3">
                    🏦 Spese per conto — {chartsView === 'preventivo' ? 'Preventivo' : `Consuntivo ${MONTHS_IT[0]}–${MONTHS_IT[curMonth]}`}
                  </h3>
                  {pieDataByConto.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-xs text-gray-400">
                      {chartsView === 'preventivo' ? 'Assegna un conto alle voci di spesa' : 'Nessuna transazione registrata'}
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieDataByConto} dataKey="value" cx="50%" cy="50%" outerRadius={70} labelLine={false}>
                            {pieDataByConto.map((entry, index) => <Cell key={`c1-${index}`} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-2">
                        {pieDataByConto.map((d, i) => {
                          const total = pieDataByConto.reduce((s, x) => s + x.value, 0)
                          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="flex-1 truncate text-gray-600">{d.name}</span>
                              <span className="text-gray-400">{pct}%</span>
                              <span className="font-medium text-gray-700">{formatCurrency(d.value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Torta 2 — per macro categoria */}
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <h3 className="text-xs font-semibold text-gray-600 mb-3">
                    🏷️ Spese per macro categoria — {chartsView === 'preventivo' ? 'Preventivo' : `Consuntivo ${MONTHS_IT[0]}–${MONTHS_IT[curMonth]}`}
                  </h3>
                  {pieDataByMacro.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-xs text-gray-400">
                      {chartsView === 'preventivo' ? 'Nessuna voce di spesa' : 'Nessuna transazione con macro categoria'}
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieDataByMacro} dataKey="value" cx="50%" cy="50%" outerRadius={70} labelLine={false}>
                            {pieDataByMacro.map((entry, index) => <Cell key={`c2-${index}`} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-2">
                        {pieDataByMacro.map((d, i) => {
                          const total = pieDataByMacro.reduce((s, x) => s + x.value, 0)
                          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="flex-1 truncate text-gray-600">{d.name}</span>
                              <span className="text-gray-400">{pct}%</span>
                              <span className="font-medium text-gray-700">{formatCurrency(d.value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Riga 2: barre stacked con voci per macro categoria */}
              {stackedBarData.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm p-4">
                  <h3 className="text-xs font-semibold text-gray-600 mb-4">
                    📊 Dettaglio voci per macro categoria — Preventivo {viewYear}
                  </h3>
                  <div className="space-y-3">
                    {stackedBarData.map(({ cat, items, catTotal }) => (
                      <div key={cat.id}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{cat.icon || '📦'}</span>
                            <span className="text-xs font-semibold text-gray-700">{cat.name}</span>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: cat.color || '#6366f1' }}>{formatCurrency(catTotal)}</span>
                        </div>
                        {/* Segmented bar */}
                        <div className="flex h-6 rounded-lg overflow-hidden gap-px">
                          {items.map((item: any, idx: number) => {
                            const pct = catTotal > 0 ? (getAnnualAmount(item) / catTotal) * 100 : 0
                            if (pct < 0.5) return null
                            const alpha = 0.45 + (idx / Math.max(items.length - 1, 1)) * 0.55
                            return (
                              <div
                                key={item.id}
                                title={`${item.description}: ${formatCurrency(getAnnualAmount(item))} (${Math.round(pct)}%)`}
                                className="cursor-help transition-opacity hover:opacity-80"
                                style={{ width: `${pct}%`, backgroundColor: hexToRgba(cat.color || '#6366f1', alpha), minWidth: 4 }}
                              />
                            )
                          })}
                        </div>
                        {/* Legenda voci */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                          {items.map((item: any, idx: number) => {
                            const annual = getAnnualAmount(item)
                            const pct = catTotal > 0 ? Math.round((annual / catTotal) * 100) : 0
                            const alpha = 0.45 + (idx / Math.max(items.length - 1, 1)) * 0.55
                            return (
                              <div key={item.id} className="flex items-center gap-1 text-[10px] text-gray-500">
                                <div className="h-2 w-2 rounded-sm flex-shrink-0" style={{ backgroundColor: hexToRgba(cat.color || '#6366f1', alpha) }} />
                                <span className="truncate max-w-[120px]">{item.description}</span>
                                <span className="text-gray-400">({pct}%)</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: MENSILE ══════════════════════════════════════ */}
      {view === 'mensile' && (
        <div>
          <p className="text-xs text-gray-500 mb-3">Distribuzione mensile generata automaticamente dal preventivo annuale</p>
          <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 940 }}>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-semibold text-gray-700 sticky left-0 bg-gray-50" style={{ minWidth: 130 }}>Voce</th>
                  {MONTHS_IT.map(m => <th key={m} className="text-center p-2 font-medium text-gray-500" style={{ minWidth: 62 }}>{m}</th>)}
                  <th className="text-center p-2 font-semibold text-gray-700" style={{ minWidth: 75 }}>Totale</th>
                </tr>
              </thead>
              <tbody>
                {/* Entrate header */}
                <tr className="bg-green-50 border-b">
                  <td colSpan={14} className="px-3 py-1.5 text-xs font-semibold text-green-700 uppercase tracking-wide sticky left-0 bg-green-50">💰 Entrate</td>
                </tr>
                {incomeItems.length === 0 && (
                  <tr className="border-b"><td colSpan={14} className="py-3 text-center text-gray-400">Nessuna voce di entrata</td></tr>
                )}
                {incomeItems.map((item: any) => {
                  const amounts = getMonthlyAmounts(item)
                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50/50">
                      <td className="p-3 sticky left-0 bg-white">
                        <div className="font-medium text-gray-700 truncate" style={{ maxWidth: 115 }}>{item.description}</div>
                        <div className="text-gray-400 text-[10px]">{getRecurrenceLabel(item)}</div>
                      </td>
                      {amounts.map((a: number, idx: number) => (
                        <td key={idx} className="p-2 text-center text-gray-600">{a > 0 ? fmt(a) : <span className="text-gray-200">—</span>}</td>
                      ))}
                      <td className="p-2 text-center font-semibold text-green-700">{fmt(amounts.reduce((s: number, a: number) => s + a, 0))}</td>
                    </tr>
                  )
                })}
                {/* Expense rows per category */}
                {monthlyRows.flatMap(({ cat, items, monthly, total }) => {
                  if (items.length === 0) return []
                  return [
                    <tr key={`cat-hdr-${cat.id}`} className="border-b" style={{ backgroundColor: `${cat.color}18` }}>
                      <td colSpan={14} className="px-3 py-1 sticky left-0" style={{ backgroundColor: `${cat.color}18` }}>
                        <span className="text-xs font-semibold" style={{ color: cat.color }}>{cat.icon} {cat.name}</span>
                      </td>
                    </tr>,
                    ...items.map((item: any) => {
                      const amounts = getMonthlyAmounts(item)
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50/50">
                          <td className="p-3 pl-5 sticky left-0 bg-white">
                            <div className="font-medium text-gray-700 truncate" style={{ maxWidth: 105 }}>{item.description}</div>
                            <div className="text-gray-400 text-[10px]">{getRecurrenceLabel(item)}{item.is_variable ? ' · var.' : ''}</div>
                          </td>
                          {amounts.map((a: number, idx: number) => (
                            <td key={idx} className="p-2 text-center text-gray-600">{a > 0 ? fmt(a) : <span className="text-gray-200">—</span>}</td>
                          ))}
                          <td className="p-2 text-center font-medium text-gray-700">{fmt(amounts.reduce((s: number, a: number) => s + a, 0))}</td>
                        </tr>
                      )
                    }),
                    <tr key={`cat-sub-${cat.id}`} className="border-b" style={{ backgroundColor: `${cat.color}0C` }}>
                      <td className="p-2 pl-3 font-semibold sticky left-0 text-[11px]" style={{ backgroundColor: `${cat.color}0C`, color: cat.color }}>Subtotale</td>
                      {monthly.map((a: number, idx: number) => (
                        <td key={idx} className="p-2 text-center font-medium text-[11px]" style={{ color: cat.color }}>{a > 0 ? fmt(a) : <span className="text-gray-200">—</span>}</td>
                      ))}
                      <td className="p-2 text-center font-semibold text-[11px]" style={{ color: cat.color }}>{fmt(total)}</td>
                    </tr>
                  ]
                })}
              </tbody>
              <tfoot>
                <tr className="bg-red-50 border-t-2 border-red-200">
                  <td className="p-3 font-semibold text-red-700 sticky left-0 bg-red-50 text-[11px]">Tot. Spese</td>
                  {monthlyData.exp.map((a: number, i: number) => <td key={i} className="p-2 text-center font-medium text-[11px] text-red-600">{a > 0 ? fmt(a) : <span className="text-gray-200">—</span>}</td>)}
                  <td className="p-2 text-center font-semibold text-[11px] text-red-700">{fmt(monthlyData.exp.reduce((s: number, a: number) => s + a, 0))}</td>
                </tr>
                <tr className="bg-green-50 border-t border-green-200">
                  <td className="p-3 font-semibold text-green-700 sticky left-0 bg-green-50 text-[11px]">Tot. Entrate</td>
                  {monthlyData.inc.map((a: number, i: number) => <td key={i} className="p-2 text-center font-medium text-[11px] text-green-600">{a > 0 ? fmt(a) : <span className="text-gray-200">—</span>}</td>)}
                  <td className="p-2 text-center font-semibold text-[11px] text-green-700">{fmt(monthlyData.inc.reduce((s: number, a: number) => s + a, 0))}</td>
                </tr>
                <tr className="bg-blue-50 border-t border-blue-200">
                  <td className="p-3 font-semibold text-blue-700 sticky left-0 bg-blue-50 text-[11px]">Saldo Mese</td>
                  {monthlyData.saldo.map((s: number, i: number) => <td key={i} className={`p-2 text-center font-semibold text-[11px] ${s >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(s)}</td>)}
                  <td className="p-2 text-center text-gray-300 text-[11px]">—</td>
                </tr>
                <tr className="bg-indigo-50 border-t border-indigo-200">
                  <td className="p-3 font-semibold text-indigo-700 sticky left-0 bg-indigo-50 text-[11px]">Saldo Cumulato</td>
                  {monthlyData.cumul.map((s: number, i: number) => <td key={i} className={`p-2 text-center font-semibold text-[11px] ${s >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{fmt(s)}</td>)}
                  <td className="p-2 text-center text-gray-300 text-[11px]">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: CONFRONTO ════════════════════════════════════ */}
      {view === 'confronto' && (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border shadow-sm p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Saldo YTD</div>
              <div className={`text-base font-bold ${ytdIncome - ytdActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ytdIncome - ytdActual)}</div>
              <div className="text-[10px] text-gray-400">gen–{MONTHS_IT[curMonth]}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Vs Preventivo</div>
              <div className={`text-base font-bold ${ytdBudget - ytdActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ytdBudget - ytdActual)}</div>
              <div className="text-[10px] text-gray-400">budget rimanente</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Mesi in rosso</div>
              <div className={`text-base font-bold ${monthsInRosso === 0 ? 'text-green-600' : 'text-red-600'}`}>{monthsInRosso}</div>
              <div className="text-[10px] text-gray-400">su {curMonth + 1} mesi</div>
            </div>
          </div>

          {/* Mapping banner */}
          {categoryBudgetMappings.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center justify-between">
              <div className="text-xs text-yellow-800">
                <span className="font-semibold">Configura il mapping</span> per collegare le categorie transazioni alle macrovoci budget e vedere i dati reali.
              </div>
              <button onClick={openMapping} className="text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0 ml-3">
                <Link className="h-3 w-3" /> Configura
              </button>
            </div>
          )}
          {categoryBudgetMappings.length > 0 && (
            <button onClick={openMapping} className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700">
              <Link className="h-3 w-3" /> Modifica mapping categorie
            </button>
          )}

          {/* Charts — YTD per macrovoce */}
          {confrontoChartData.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Preventivo vs Consuntivo YTD (gen–{MONTHS_IT[curMonth]})
              </h3>
              <ResponsiveContainer width="100%" height={confrontoChartData.length * 52 + 40}>
                <BarChart
                  data={confrontoChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="preventivo" name="Preventivo" fill="#93c5fd" radius={[0, 3, 3, 0]} barSize={12}>
                    {confrontoChartData.map((_, index) => (
                      <Cell key={`prev-${index}`} fill="#93c5fd" />
                    ))}
                  </Bar>
                  <Bar dataKey="consuntivo" name="Consuntivo" fill="#f87171" radius={[0, 3, 3, 0]} barSize={12}>
                    {confrontoChartData.map((entry, index) => (
                      <Cell key={`cons-${index}`} fill={entry.consuntivo > entry.preventivo ? '#ef4444' : '#4ade80'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Month selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setSelMonth(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selMonth === null ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              Anno
            </button>
            {MONTHS_IT.map((m, idx) => (
              <button key={idx} onClick={() => setSelMonth(idx + 1)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selMonth === idx + 1 ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Table — annual */}
          {selMonth === null && (
            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 750 }}>
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-semibold text-gray-700 sticky left-0 bg-gray-50" style={{ minWidth: 120 }}>Macrovoce</th>
                    {MONTHS_IT.map(m => <th key={m} className="text-center p-2 font-medium text-gray-500" style={{ minWidth: 52 }}>{m}</th>)}
                    <th className="text-center p-2 font-semibold" style={{ minWidth: 70 }}>Tot.</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetCategories.map((cat: any) => {
                    const b = confronto.budget[cat.id] || new Array(12).fill(0)
                    const a = confronto.actual[cat.id] || new Array(12).fill(0)
                    const tb = b.reduce((s: number, v: number) => s + v, 0)
                    const ta = a.reduce((s: number, v: number) => s + v, 0)
                    return (
                      <tr key={cat.id} className="border-b hover:bg-gray-50/50">
                        <td className="p-3 sticky left-0 bg-white">
                          <div className="flex items-center gap-1.5">
                            <span>{cat.icon}</span>
                            <span className="font-medium text-gray-700 truncate" style={{ maxWidth: 80 }}>{cat.name}</span>
                          </div>
                        </td>
                        {b.map((_: number, idx: number) => {
                          const bv = b[idx], av = a[idx]
                          return (
                            <td key={idx} className="p-1 text-center">
                              {(bv > 0 || av > 0) ? (
                                <div className={`text-[10px] font-medium ${semaforoClass(bv, av)}`}>
                                  {av > 0 ? fmt(av) : '—'}
                                  {bv > 0 && <div className="text-gray-300">{fmt(bv)}</div>}
                                </div>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                          )
                        })}
                        <td className="p-2 text-center">
                          <div className={`font-semibold text-xs ${semaforoClass(tb, ta)}`}>{semaforoEmoji(tb, ta)} {fmt(ta)}</div>
                          {tb > 0 && <div className="text-gray-400 text-[10px]">/ {fmt(tb)}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail — monthly */}
          {selMonth !== null && (
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-4">{MONTHS_FULL[selMonth - 1]} {viewYear}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Preventivo</h4>
                  <div className="space-y-1.5">
                    {budgetItems.filter((i: any) => getMonthlyAmounts(i)[selMonth - 1] > 0).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate" style={{ maxWidth: 120 }}>{item.description}</span>
                        <span className="font-medium text-gray-800">{formatCurrency(getMonthlyAmounts(item)[selMonth - 1])}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Consuntivo</h4>
                  <div className="space-y-1.5">
                    {yearTransactions
                      .filter((tx: any) => new Date(tx.date + 'T00:00:00').getMonth() + 1 === selMonth)
                      .slice(0, 20)
                      .map((tx: any) => (
                        <div key={tx.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 truncate" style={{ maxWidth: 120 }}>{tx.description}</span>
                          <span className={`font-medium ${tx.type === 'entrata' ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.type === 'entrata' ? '+' : '−'}{fmt(Number(tx.amount))}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              {/* Monthly summary */}
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-xs">
                {(() => {
                  const mBudgInc = budgetItems.filter((i: any) => i.type === 'income').reduce((s: number, i: any) => s + getMonthlyAmounts(i)[selMonth - 1], 0)
                  const mBudgExp = budgetItems.filter((i: any) => i.type !== 'income').reduce((s: number, i: any) => s + getMonthlyAmounts(i)[selMonth - 1], 0)
                  const mTxs = yearTransactions.filter((tx: any) => new Date(tx.date + 'T00:00:00').getMonth() + 1 === selMonth)
                  const mActInc = mTxs.filter((tx: any) => tx.type === 'entrata').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
                  const mActExp = mTxs.filter((tx: any) => tx.type === 'uscita').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
                  const scost = (mActInc - mActExp) - (mBudgInc - mBudgExp)
                  return (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-gray-500">Entrate previste</span><span className="font-medium text-green-600">+{formatCurrency(mBudgInc)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Spese previste</span><span className="font-medium text-red-500">−{formatCurrency(mBudgExp)}</span></div>
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Saldo previsto</span><span className={mBudgInc - mBudgExp >= 0 ? 'text-blue-700' : 'text-red-600'}>{formatCurrency(mBudgInc - mBudgExp)}</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-gray-500">Entrate effettive</span><span className="font-medium text-green-600">+{formatCurrency(mActInc)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Spese effettive</span><span className="font-medium text-red-500">−{formatCurrency(mActExp)}</span></div>
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Saldo effettivo</span><span className={mActInc - mActExp >= 0 ? 'text-blue-700' : 'text-red-600'}>{formatCurrency(mActInc - mActExp)}</span></div>
                        <div className="flex justify-between text-gray-500"><span>Scostamento</span><span className={scost >= 0 ? 'text-green-600' : 'text-red-600'}>{scost >= 0 ? '+' : ''}{formatCurrency(scost)}</span></div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODAL: Add/Edit Item ══════════════════════════════ */}
      {itemModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="font-semibold">{itemModal.mode === 'add' ? 'Nuova voce' : 'Modifica voce'}</h2>
              <button onClick={() => setItemModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              {itemModal.mode === 'add' && !itemModal.defaultType && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Tipo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['income', 'expense', 'saving_goal'] as ItemType[]).map(t => (
                      <button key={t} onClick={() => setItemForm(f => ({ ...f, type: t }))}
                        className={`py-2 rounded-lg text-xs font-medium border transition-colors ${itemForm.type === t ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'}`}>
                        {t === 'income' ? '💰 Entrata' : t === 'expense' ? '💸 Spesa' : '🎯 Obiettivo'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Descrizione *</label>
                <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Mutuo, Stipendio, Netflix..." autoFocus />
              </div>
              {(itemForm.type === 'expense' || itemForm.type === 'saving_goal') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Macrovoce</label>
                  <select value={itemForm.budget_category_id || ''} onChange={e => setItemForm(f => ({ ...f, budget_category_id: e.target.value || null }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white">
                    <option value="">— Nessuna —</option>
                    {budgetCategories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Ricorrenza *</label>
                <select value={itemForm.recurrence} onChange={e => setItemForm(f => ({ ...f, recurrence: e.target.value as Recurrence, recurrence_month: null, recurrence_date: '' }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white">
                  <option value="monthly">Mensile (× 12)</option>
                  <option value="weekly">Settimanale (× 52)</option>
                  <option value="quarterly">Trimestrale (× 4)</option>
                  <option value="annual">Annuale (1 volta)</option>
                  <option value="once">Una tantum</option>
                </select>
              </div>
              {(itemForm.recurrence === 'annual' || itemForm.recurrence === 'quarterly') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    {itemForm.recurrence === 'annual' ? 'Mese di competenza' : 'Mese di inizio'}
                  </label>
                  <select value={itemForm.recurrence_month || ''} onChange={e => setItemForm(f => ({ ...f, recurrence_month: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white">
                    <option value="">— Seleziona mese —</option>
                    {MONTHS_FULL.map((m, idx) => <option key={idx + 1} value={idx + 1}>{m}</option>)}
                  </select>
                </div>
              )}
              {itemForm.recurrence === 'once' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Data prevista</label>
                  <input type="date" value={itemForm.recurrence_date} onChange={e => setItemForm(f => ({ ...f, recurrence_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Importo (€) *</label>
                <input type="number" step="0.01" min="0" value={itemForm.amount} onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0,00" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-700">Importo variabile</div>
                  <div className="text-[10px] text-gray-400">L'importo è una stima media</div>
                </div>
                <button onClick={() => setItemForm(f => ({ ...f, is_variable: !f.is_variable }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${itemForm.is_variable ? 'bg-primary' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${itemForm.is_variable ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {/* Conto previsto — per tutte le voci */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Conto previsto</label>
                <select value={itemForm.planned_account_id || ''} onChange={e => setItemForm(f => ({ ...f, planned_account_id: e.target.value || null }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white">
                  <option value="">— Non assegnato —</option>
                  {accounts.map((acc: any) => <option key={acc.id} value={acc.id}>{acc.icon ? acc.icon + ' ' : ''}{acc.name}</option>)}
                </select>
              </div>
              {itemForm.type === 'saving_goal' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Importo target (€)</label>
                    <input type="number" step="0.01" min="0" value={itemForm.target_amount} onChange={e => setItemForm(f => ({ ...f, target_amount: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="es. 2500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Data target</label>
                    <input type="date" value={itemForm.target_date} onChange={e => setItemForm(f => ({ ...f, target_date: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Note</label>
                <input value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Opzionale..." />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-gray-700">Voce attiva</div>
                <button onClick={() => setItemForm(f => ({ ...f, active: !f.active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${itemForm.active ? 'bg-primary' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${itemForm.active ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setItemModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
              <button onClick={handleSaveItem} disabled={saving || !itemForm.description.trim() || !itemForm.amount}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Add/Edit Budget Category ══════════════════ */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{catModal.mode === 'add' ? 'Nuova macrovoce' : 'Modifica macrovoce'}</h2>
              <button onClick={() => setCatModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Nome *</label>
                <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Casa, Auto..." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Icona (emoji)</label>
                  <input value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="🏠" maxLength={4} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Colore</label>
                  <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full h-9 border rounded-lg cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setCatModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
              <button onClick={handleSaveCat} disabled={saving || !catForm.name.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Category Mapping ════════════════════════════ */}
      {mappingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="font-semibold">Mapping categorie → macrovoci</h2>
                <p className="text-xs text-gray-500 mt-0.5">Collega le categorie transazioni alle macrovoci budget</p>
              </div>
              <button onClick={() => setMappingModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-2">
              {categories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#94a3b8' }} />
                    <span className="text-sm text-gray-700 truncate">{cat.name}</span>
                    <span className="text-xs text-gray-400">{cat.type === 'entrata' ? 'entr.' : cat.type === 'uscita' ? 'usc.' : 'risp.'}</span>
                  </div>
                  <select value={mappingDraft[cat.id] || ''} onChange={e => setMappingDraft(d => ({ ...d, [cat.id]: e.target.value }))}
                    className="border rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[160px]">
                    <option value="">— nessuna —</option>
                    {budgetCategories.map((bc: any) => <option key={bc.id} value={bc.id}>{bc.icon} {bc.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setMappingModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
              <button onClick={handleSaveMapping} disabled={saving}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva mapping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
