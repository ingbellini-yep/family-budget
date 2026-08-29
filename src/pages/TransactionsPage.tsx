import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency, formatDate, normalizeDescriptionKey } from '../lib/utils'
import { Plus, Trash2, X, Filter, Upload, Loader2, Pencil, Layers, RefreshCw, CheckSquare, Search, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import ImportModal from '../components/ImportModal'
import PeriodSelector from '../components/PeriodSelector'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const txSchema = z.object({
  date: z.string().min(1, 'Obbligatorio'),
  amount: z.coerce.number().positive('Importo non valido'),
  type: z.enum(['entrata', 'uscita', 'giroconto']),
  description: z.string().optional(),
  budget_category_id: z.string().optional(),
  budget_item_id: z.string().optional(),
  category_id: z.string().optional(),
  account_id: z.string().min(1, 'Seleziona un conto'),
  to_account_id: z.string().optional(),
  note: z.string().optional(),
})
type TxForm = z.infer<typeof txSchema>

export default function TransactionsPage() {
  const {
    transactions, categories, accounts, budgetCategories, budgetItems, categoryBudgetMappings,
    addTransaction, deleteTransaction, updateTransaction, addBudgetItem, loadBudgetItems,
    bulkDeleteTransactions, bulkUpdateTransactions, bulkDeleteByIds,
    viewMode, selectedMonth, selectedYear, customDateFrom, customDateTo,
    saveDescriptionMacroMapping, applyMappingRetroactively,
  } = useAppStore()
  const { profile } = useAuthStore()

  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<any>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [formError, setFormError] = useState('')
  const [learnToast, setLearnToast] = useState('')
  const [showDashboard, setShowDashboard] = useState(false)

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<'all' | 'entrata' | 'uscita' | 'giroconto'>('all')
  const [filterBudgetCategory, setFilterBudgetCategory] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionDeleting, setSelectionDeleting] = useState(false)
  const [selectionDeleteConfirm, setSelectionDeleteConfirm] = useState(false)
  const [selectionDeleteError, setSelectionDeleteError] = useState('')

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkMode, setBulkMode] = useState<'date' | 'account' | 'all'>('date')
  const [bulkDateFrom, setBulkDateFrom] = useState('')
  const [bulkDateTo, setBulkDateTo] = useState('')
  const [bulkAccountId, setBulkAccountId] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkConfirm, setBulkConfirm] = useState(false)

  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)
  const [bulkUpdateScope, setBulkUpdateScope] = useState<'selected' | 'filtered'>('selected')
  const [bulkUpdateType, setBulkUpdateType] = useState<'' | 'entrata' | 'uscita'>('')
  const [bulkUpdateBudgetCategoryId, setBulkUpdateBudgetCategoryId] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [bulkUpdateError, setBulkUpdateError] = useState('')

  // ── New budget-item inline ───────────────────────────────────────────────────
  const [showNewItemInput, setShowNewItemInput] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  const form = useForm<TxForm>({
    resolver: zodResolver(txSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], type: 'uscita' },
  })

  const watchType = form.watch('type')
  const watchBudgetCategoryId = form.watch('budget_category_id')
  const watchBudgetItemId = form.watch('budget_item_id')
  const watchDescription = form.watch('description')
  const watchAccountId = form.watch('account_id')

  // ── Budget item lists ─────────────────────────────────────────────────────────
  const incomeBudgetItems = useMemo(
    () => budgetItems.filter((i: any) => i.type === 'income' && i.active !== false),
    [budgetItems],
  )
  const expenseBudgetItems = useMemo(
    () => watchBudgetCategoryId
      ? budgetItems.filter((i: any) => i.budget_category_id === watchBudgetCategoryId && i.type !== 'income' && i.active !== false)
      : [],
    [budgetItems, watchBudgetCategoryId],
  )

  const incomeMacro = budgetCategories.find((bc: any) => bc.budget_type === 'entrata')

  // Auto-suggest account when income budget_item selected
  useEffect(() => {
    if (watchType !== 'entrata' || !watchBudgetItemId) return
    const item = incomeBudgetItems.find((i: any) => i.id === watchBudgetItemId)
    if (item?.planned_account_id && !watchAccountId) {
      form.setValue('account_id', item.planned_account_id)
    }
  }, [watchBudgetItemId, watchType])

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const hasActiveFilters = filterType !== 'all' || filterBudgetCategory
    || filterAccount || filterDateFrom || filterDateTo || search

  const filtered = useMemo(() => transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterBudgetCategory && t.budget_category_id !== filterBudgetCategory) return false
    if (filterAccount && t.account_id !== filterAccount) return false
    if (filterDateFrom && t.date < filterDateFrom) return false
    if (filterDateTo && t.date > filterDateTo) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.description?.toLowerCase().includes(q) && !t.note?.toLowerCase().includes(q)) return false
    }
    return true
  }), [transactions, filterType, filterBudgetCategory, filterAccount, filterDateFrom, filterDateTo, search])

  useEffect(() => {
    const filteredIds = new Set(filtered.map((t: any) => t.id))
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => filteredIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filtered])

  const resetFilters = () => {
    setFilterType('all'); setFilterBudgetCategory('')
    setFilterAccount(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch('')
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((t: any) => selectedIds.has(t.id))
  const someSelected = selectedIds.size > 0
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAll = () => allFilteredSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map((t: any) => t.id)))
  const clearSelection = () => setSelectedIds(new Set())

  // ── Display helpers ───────────────────────────────────────────────────────────
  const getBudgetItemName = (tx: any) => {
    if (tx.budget_item_id) return budgetItems.find((i: any) => i.id === tx.budget_item_id)?.description || '—'
    if (tx.category_id) return categories.find((c: any) => c.id === tx.category_id)?.name || '—'
    return '—'
  }
  const getBudgetCategoryIcon = (tx: any) => {
    if (tx.budget_category_id) return budgetCategories.find((bc: any) => bc.id === tx.budget_category_id)?.icon || ''
    return ''
  }
  const getAccountName = (id: string) => accounts.find((a: any) => a.id === id)?.name || '—'

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const resetFormModal = (type: TxForm['type'] = 'uscita') => {
    setShowNewItemInput(false); setNewItemName(''); setFormError('')
    form.reset({
      date: new Date().toISOString().split('T')[0], type,
      description: '', amount: undefined as any,
      budget_category_id: type === 'entrata' ? (incomeMacro?.id || '') : '',
      budget_item_id: '', category_id: '', account_id: '', to_account_id: '', note: '',
    })
  }

  const handleOpenAdd = () => { setEditingTx(null); resetFormModal('uscita'); setShowModal(true) }

  const handleOpenEdit = (tx: any) => {
    setEditingTx(tx)
    setShowNewItemInput(false); setNewItemName(''); setFormError('')
    form.reset({
      date: tx.date,
      type: tx.type as TxForm['type'],
      description: tx.description || '',
      amount: tx.amount,
      budget_category_id: tx.budget_category_id || '',
      budget_item_id: tx.budget_item_id || '',
      category_id: tx.category_id || '',
      account_id: tx.account_id || '',
      to_account_id: tx.to_account_id || '',
      note: tx.note || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (data: TxForm) => {
    if (!profile?.family_id) return
    setFormError('')

    // Validation per tipo
    if (data.type === 'giroconto') {
      if (!data.to_account_id) { setFormError('Seleziona il conto di arrivo'); return }
      if (data.account_id === data.to_account_id) { setFormError('I conti di partenza e arrivo devono essere diversi'); return }
    } else {
      if (!data.budget_item_id) { setFormError('Seleziona una voce di budget'); return }
    }

    // Deriva budget_category_id dalla voce selezionata
    let budget_category_id = data.budget_category_id || null
    let description = data.description?.trim() || ''

    if (data.type !== 'giroconto' && data.budget_item_id) {
      const item = budgetItems.find((i: any) => i.id === data.budget_item_id)
      if (item) {
        budget_category_id = item.budget_category_id
        if (!description) description = item.description
      }
    }
    if (data.type === 'giroconto' && !description) {
      const toAcc = accounts.find((a: any) => a.id === data.to_account_id)
      description = `Giroconto → ${toAcc?.name || ''}`
    }

    const payload: any = {
      date: data.date,
      amount: data.amount,
      type: data.type,
      description: description || '',
      budget_category_id,
      budget_item_id: data.budget_item_id || null,
      category_id: data.category_id || null,
      account_id: data.account_id,
      to_account_id: data.to_account_id || null,
      note: data.note || null,
    }

    if (editingTx) {
      const { error } = await updateTransaction(editingTx.id, payload)
      if (!error) {
        // Learn mapping se budget_category cambiato
        if (budget_category_id && budget_category_id !== editingTx.budget_category_id && description) {
          const key = normalizeDescriptionKey(description)
          await saveDescriptionMacroMapping(profile.family_id, key, budget_category_id)
          const count = await applyMappingRetroactively(profile.family_id, key, budget_category_id)
          if (count > 0) {
            setLearnToast(`✓ Mappa appresa — ${count} transazioni aggiornate`)
            setTimeout(() => setLearnToast(''), 4000)
          }
        }
        setShowModal(false); setEditingTx(null)
      }
    } else {
      const { error } = await addTransaction({
        ...payload,
        family_id: profile.family_id, created_by: profile.id, source: 'manuale',
      })
      if (!error) {
        setShowModal(false)
        resetFormModal('uscita')
      }
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteTransaction(id)
    setDeletingId(null)
  }

  const handleSelectionDelete = async () => {
    if (!someSelected) return
    setSelectionDeleting(true); setSelectionDeleteError('')
    const { error } = await bulkDeleteByIds([...selectedIds])
    setSelectionDeleting(false)
    if (error) setSelectionDeleteError(error.message || 'Errore')
    else { setSelectionDeleteConfirm(false); setSelectedIds(new Set()) }
  }

  const handleOpenBulkUpdate = (scope: 'selected' | 'filtered') => {
    setBulkUpdateScope(scope); setBulkUpdateType(''); setBulkUpdateBudgetCategoryId(''); setBulkUpdateError('')
    setShowBulkUpdateModal(true)
  }

  const handleBulkUpdate = async () => {
    const ids = bulkUpdateScope === 'selected' ? [...selectedIds] : filtered.map((t: any) => t.id)
    if (!ids.length) return
    const updates: Record<string, any> = {}
    if (bulkUpdateType) updates.type = bulkUpdateType
    if (bulkUpdateBudgetCategoryId) updates.budget_category_id = bulkUpdateBudgetCategoryId
    if (!Object.keys(updates).length) return
    setBulkUpdateError(''); setBulkUpdating(true)
    const { error } = await bulkUpdateTransactions(ids, updates)
    setBulkUpdating(false)
    if (error) setBulkUpdateError(error.message || 'Errore')
    else { setShowBulkUpdateModal(false); if (bulkUpdateScope === 'selected') setSelectedIds(new Set()) }
  }

  const handleBulkDelete = async () => {
    if (!profile?.family_id) return
    setBulkError(''); setBulkDeleting(true)
    const { error } = await bulkDeleteTransactions({
      familyId: profile.family_id,
      dateFrom: bulkMode === 'date' ? bulkDateFrom : undefined,
      dateTo: bulkMode === 'date' ? bulkDateTo : undefined,
      accountId: bulkMode === 'account' ? bulkAccountId : undefined,
      all: bulkMode === 'all',
    })
    setBulkDeleting(false)
    if (error) setBulkError(error.message || 'Errore')
    else { setShowBulkModal(false); setBulkConfirm(false); setBulkDateFrom(''); setBulkDateTo(''); setBulkAccountId('') }
  }

  // ── Crea nuova voce budget inline ─────────────────────────────────────────────
  const handleAddNewBudgetItem = async () => {
    if (!newItemName.trim() || !profile?.family_id) return
    setAddingItem(true)
    const isIncome = watchType === 'entrata'
    const payload = {
      family_id: profile.family_id,
      year: selectedYear,
      type: isIncome ? 'income' : 'expense',
      description: newItemName.trim(),
      budget_category_id: isIncome ? (incomeMacro?.id || null) : (watchBudgetCategoryId || null),
      amount: 0,
      recurrence: 'monthly',
      active: true,
    }
    const { data, error } = await addBudgetItem(payload)
    if (!error && data) {
      await loadBudgetItems(profile.family_id, selectedYear)
      form.setValue('budget_item_id', data.id)
      setShowNewItemInput(false); setNewItemName('')
    }
    setAddingItem(false)
  }

  const bulkDeleteValid = bulkMode === 'all'
    || (bulkMode === 'date' && bulkDateFrom && bulkDateTo && bulkDateFrom <= bulkDateTo)
    || (bulkMode === 'account' && bulkAccountId)
  const bulkUpdateCount = bulkUpdateScope === 'selected' ? selectedIds.size : filtered.length
  const bulkUpdateValid = (bulkUpdateType || bulkUpdateBudgetCategoryId) && bulkUpdateCount > 0

  const CHART_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']

  const pieData = useMemo(() => {
    const map = new Map<string, number>()
    filtered.filter((t: any) => t.type === 'uscita' && t.budget_category_id).forEach((t: any) => {
      const name = budgetCategories.find((bc: any) => bc.id === t.budget_category_id)?.name || 'Altro'
      map.set(name, (map.get(name) || 0) + t.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value)
  }, [filtered, budgetCategories])

  const barData = useMemo(() => {
    const budgetByCategory = new Map<string, number>()
    budgetItems.forEach((item: any) => {
      if (!item.budget_category_id || item.active === false) return
      let monthly = 0
      if (item.recurrence === 'monthly') monthly = item.amount
      else if (item.recurrence === 'annual') monthly = item.amount / 12
      else if (item.recurrence === 'weekly') monthly = item.amount * 4.33
      else if (item.recurrence === 'quarterly') monthly = item.amount / 3
      else monthly = item.amount / 6
      budgetByCategory.set(item.budget_category_id, (budgetByCategory.get(item.budget_category_id) || 0) + monthly)
    })
    const actualByCategory = new Map<string, number>()
    filtered.filter((t: any) => t.type === 'uscita' && t.budget_category_id).forEach((t: any) => {
      actualByCategory.set(t.budget_category_id, (actualByCategory.get(t.budget_category_id) || 0) + t.amount)
    })
    const ids = new Set([...budgetByCategory.keys(), ...actualByCategory.keys()])
    return Array.from(ids).map(id => {
      const cat = budgetCategories.find((bc: any) => bc.id === id)
      return {
        name: (cat?.name || 'Altro').length > 12 ? (cat?.name || 'Altro').slice(0, 12) + '…' : (cat?.name || 'Altro'),
        Budget: Math.round(budgetByCategory.get(id) || 0),
        Effettivo: Math.round(actualByCategory.get(id) || 0),
      }
    }).sort((a, b) => b.Effettivo - a.Effettivo).slice(0, 8)
  }, [filtered, budgetCategories, budgetItems])

  return (
    <div className="p-4 md:p-6 pb-28 md:pb-6">

      {learnToast && (
        <div className="mb-4 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{learnToast}</div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transazioni</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <PeriodSelector />
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${hasActiveFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtra</span>
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
          <button onClick={() => { setShowBulkModal(true); setBulkConfirm(false); setBulkError('') }}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100">
            <Layers className="h-4 w-4" /><span className="hidden sm:inline">Elimina</span>
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-purple-200 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium hover:bg-purple-100">
            <Upload className="h-4 w-4" /><span className="hidden sm:inline">Importa</span>
          </button>
          <button onClick={handleOpenAdd}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /><span className="hidden sm:inline">Aggiungi</span>
          </button>
        </div>
      </div>

      {/* ── Mini dashboard ─────────────────────────────────────────────────── */}
      {pieData.length > 0 && (
        <div className="mb-4">
          <button onClick={() => setShowDashboard(v => !v)}
            className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700">
            <span>{showDashboard ? '▲' : '▼'}</span>
            <span>{showDashboard ? 'Nascondi analisi' : 'Mostra analisi macrocategorie'}</span>
          </button>
          {showDashboard && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-600 mb-2">Uscite per macrocategoria</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white border rounded-xl p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-600 mb-2">Budget vs Effettivo {viewMode === 'month' ? '(mensile)' : ''}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v: number) => `${v}€`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                    <Tooltip formatter={(v: number) => `€ ${v.toLocaleString('it-IT')}`} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                    {viewMode === 'month' && <Bar dataKey="Budget" fill="#e2e8f0" radius={[0, 3, 3, 0]} />}
                    <Bar dataKey="Effettivo" fill="#6366f1" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input type="text" placeholder="Cerca per descrizione o nota..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white shadow-sm" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-white border rounded-xl p-4 mb-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="all">Tutti i tipi</option>
              <option value="entrata">Entrate</option>
              <option value="uscita">Uscite</option>
              <option value="giroconto">Giroconti</option>
            </select>
            <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Tutti i conti</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <select value={filterBudgetCategory} onChange={e => setFilterBudgetCategory(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Tutte le macrocategorie</option>
              {budgetCategories.map((bc: any) => (
                <option key={bc.id} value={bc.id}>{bc.icon} {bc.name}</option>
              ))}
            </select>
            <div className="relative">
              <label className="absolute -top-1.5 left-2 text-[10px] text-gray-400 bg-white px-0.5">Da</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="relative">
              <label className="absolute -top-1.5 left-2 text-[10px] text-gray-400 bg-white px-0.5">A</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X className="h-3 w-3" /> Rimuovi filtri
            </button>
          )}
        </div>
      )}

      {/* ── Summary bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none text-gray-500 hover:text-gray-700">
          <input type="checkbox" checked={allFilteredSelected}
            ref={el => { if (el) el.indeterminate = someSelected && !allFilteredSelected }}
            onChange={toggleSelectAll} className="h-4 w-4 rounded accent-primary cursor-pointer" />
          <span className="text-xs hidden sm:inline">Seleziona tutti</span>
        </label>
        <span className="text-green-600 font-medium">Entrate: {formatCurrency(filtered.filter((t: any) => t.type === 'entrata').reduce((s: number, t: any) => s + t.amount, 0))}</span>
        <span className="text-red-600 font-medium">Uscite: {formatCurrency(filtered.filter((t: any) => t.type === 'uscita').reduce((s: number, t: any) => s + t.amount, 0))}</span>
        <span className="text-gray-500">({filtered.length} transazioni)</span>
        {hasActiveFilters && filtered.length > 0 && !someSelected && (
          <button onClick={() => handleOpenBulkUpdate('filtered')}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 border border-blue-200 text-blue-600 bg-blue-50 rounded-lg text-xs font-medium hover:bg-blue-100">
            <RefreshCw className="h-3 w-3" /> Modifica le {filtered.length} filtrate
          </button>
        )}
      </div>

      {/* ── Selection bar ──────────────────────────────────────────────────── */}
      {someSelected && (
        <div className="mb-3 space-y-1">
          {selectionDeleteError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{selectionDeleteError}</p>}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
            <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-primary">{selectedIds.size} selezionate</span>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => handleOpenBulkUpdate('selected')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                <Pencil className="h-3.5 w-3.5" /> Modifica
              </button>
              {!selectionDeleteConfirm ? (
                <button onClick={() => setSelectionDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600">
                  <Trash2 className="h-3.5 w-3.5" /> Elimina
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-600 font-medium">Confermi?</span>
                  <button onClick={handleSelectionDelete} disabled={selectionDeleting}
                    className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1">
                    {selectionDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sì, elimina'}
                  </button>
                  <button onClick={() => setSelectionDeleteConfirm(false)}
                    className="px-2.5 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">No</button>
                </div>
              )}
              <button onClick={() => { clearSelection(); setSelectionDeleteError('') }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction list ────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">Nessuna transazione trovata</p>
            <button onClick={handleOpenAdd} className="mt-3 text-primary text-sm hover:underline">Aggiungi la prima transazione</button>
          </div>
        ) : filtered.map((tx: any) => {
          const isSelected = selectedIds.has(tx.id)
          const bcIcon = getBudgetCategoryIcon(tx)
          const itemName = getBudgetItemName(tx)
          const typeEmoji = tx.type === 'entrata' ? '💰' : tx.type === 'giroconto' ? '🔄' : ''
          return (
            <div key={tx.id}
              className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${isSelected ? 'border-primary/40 bg-primary/5 shadow-sm' : 'hover:shadow-sm'}`}>
              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(tx.id)}
                className="h-4 w-4 rounded accent-primary cursor-pointer flex-shrink-0" />
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                tx.type === 'entrata' ? 'bg-green-100' : tx.type === 'giroconto' ? 'bg-blue-100' : 'bg-red-100'
              }`}>
                {bcIcon || typeEmoji || (tx.type === 'uscita' ? '📤' : '💰')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{tx.description}</div>
                <div className="text-xs text-gray-400 flex gap-1.5 flex-wrap">
                  <span>{itemName}</span>
                  <span>·</span>
                  <span>{getAccountName(tx.account_id)}</span>
                  {tx.type === 'giroconto' && tx.to_account_id && (
                    <><span><ArrowRight className="inline h-3 w-3" /></span><span>{getAccountName(tx.to_account_id)}</span></>
                  )}
                  {tx.note && <><span>·</span><span className="italic truncate">{tx.note}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <div className={`font-semibold text-sm ${tx.type === 'entrata' ? 'text-green-600' : tx.type === 'giroconto' ? 'text-blue-600' : 'text-red-600'}`}>
                    {tx.type === 'entrata' ? '+' : tx.type === 'giroconto' ? '⇄' : '−'}{formatCurrency(tx.amount)}
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(tx.date)}</div>
                </div>
                <button onClick={() => handleOpenEdit(tx)} className="text-gray-300 hover:text-blue-500 p-1"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(tx.id)} disabled={deletingId === tx.id} className="text-gray-300 hover:text-red-500 p-1">
                  {deletingId === tx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Add / Edit modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingTx ? 'Modifica transazione' : 'Nuova transazione'}</h2>
              <button onClick={() => { setShowModal(false); setEditingTx(null) }}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">

              {/* Tipo */}
              <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
                {(['uscita', 'entrata', 'giroconto'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => {
                      form.setValue('type', t)
                      form.setValue('budget_category_id', t === 'entrata' ? (incomeMacro?.id || '') : '')
                      form.setValue('budget_item_id', '')
                      form.setValue('to_account_id', '')
                      setShowNewItemInput(false); setNewItemName(''); setFormError('')
                    }}
                    className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                      watchType === t
                        ? t === 'uscita' ? 'bg-red-500 text-white'
                          : t === 'entrata' ? 'bg-green-500 text-white'
                          : 'bg-blue-500 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t === 'uscita' ? '📤 Uscita' : t === 'entrata' ? '💰 Entrata' : '🔄 Giroconto'}
                  </button>
                ))}
              </div>

              {/* Importo + Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Importo (€) *</label>
                  <input {...form.register('amount')} type="number" step="0.01" min="0"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00" />
                  {form.formState.errors.amount && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.amount.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Data *</label>
                  <input {...form.register('date')} type="date"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              {/* Descrizione (opzionale per giroconti) */}
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Descrizione {watchType !== 'giroconto' && <span className="text-gray-400">(opzionale — auto da voce budget)</span>}
                </label>
                <input {...form.register('description')}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={watchType === 'giroconto' ? 'Descrizione trasferimento...' : 'Se vuoto usa il nome della voce budget'} />
              </div>

              {/* ── FLUSSO ENTRATA ── */}
              {watchType === 'entrata' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-800">Voce di entrata *</label>
                      <button type="button" onClick={() => { setShowNewItemInput(v => !v); setNewItemName('') }}
                        className="text-[10px] text-green-600 hover:underline">
                        {showNewItemInput ? 'Annulla' : '+ Nuova voce'}
                      </button>
                    </div>
                    {!showNewItemInput ? (
                      <select {...form.register('budget_item_id')}
                        className="w-full border-2 border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                        <option value="">— Seleziona voce —</option>
                        {incomeBudgetItems.map((i: any) => <option key={i.id} value={i.id}>{i.description}</option>)}
                      </select>
                    ) : (
                      <div className="flex gap-1">
                        <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                          placeholder="Nome nuova voce entrata..."
                          className="flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewBudgetItem() } }} />
                        <button type="button" onClick={handleAddNewBudgetItem}
                          disabled={!newItemName.trim() || addingItem}
                          className="px-2 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 flex items-center">
                          {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">Budget aggiornato con importo €0 — imposta il valore nel Budget</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Conto accreditato *</label>
                    <select {...form.register('account_id')}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">Seleziona conto...</option>
                      {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {form.formState.errors.account_id && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.account_id.message}</p>}
                  </div>
                </div>
              )}

              {/* ── FLUSSO USCITA ── */}
              {watchType === 'uscita' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-800">Macrocategoria *</label>
                    <select {...form.register('budget_category_id', { onChange: () => { form.setValue('budget_item_id', ''); setShowNewItemInput(false) } })}
                      className="mt-1 w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                      <option value="">— Seleziona macrocategoria —</option>
                      {(['familiare', 'professionale'] as const).map(btype => {
                        const macros = budgetCategories.filter((bc: any) => bc.budget_type === btype)
                        if (!macros.length) return null
                        return (
                          <optgroup key={btype} label={btype === 'familiare' ? 'B - Spese Familiari' : 'C - Spese Professionali'}>
                            {macros.map((bc: any) => <option key={bc.id} value={bc.id}>{bc.icon} {bc.name}</option>)}
                          </optgroup>
                        )
                      })}
                    </select>
                  </div>

                  {watchBudgetCategoryId && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-800">Voce di spesa *</label>
                        <button type="button" onClick={() => { setShowNewItemInput(v => !v); setNewItemName('') }}
                          className="text-[10px] text-primary hover:underline">
                          {showNewItemInput ? 'Annulla' : '+ Nuova voce'}
                        </button>
                      </div>
                      {!showNewItemInput ? (
                        <select {...form.register('budget_item_id')}
                          className="w-full border-2 border-primary/30 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                          <option value="">— Seleziona voce —</option>
                          {expenseBudgetItems.map((i: any) => <option key={i.id} value={i.id}>{i.description}</option>)}
                        </select>
                      ) : (
                        <div className="flex gap-1">
                          <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)}
                            placeholder="Nome nuova voce di spesa..."
                            className="flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewBudgetItem() } }} />
                          <button type="button" onClick={handleAddNewBudgetItem}
                            disabled={!newItemName.trim() || addingItem}
                            className="px-2 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-40 flex items-center">
                            {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
                          </button>
                        </div>
                      )}
                      {showNewItemInput && <p className="text-[10px] text-gray-400 mt-1">Aggiunta al budget con importo €0 — imposta il valore nel Budget</p>}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-700">Conto addebitato *</label>
                    <select {...form.register('account_id')}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">Seleziona conto...</option>
                      {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {form.formState.errors.account_id && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.account_id.message}</p>}
                  </div>
                </div>
              )}

              {/* ── FLUSSO GIROCONTO ── */}
              {watchType === 'giroconto' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Conto di partenza *</label>
                      <select {...form.register('account_id')}
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                        <option value="">Seleziona conto...</option>
                        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {form.formState.errors.account_id && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.account_id.message}</p>}
                    </div>
                    <div className="flex items-center justify-center text-blue-400">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Conto di arrivo *</label>
                      <select {...form.register('to_account_id')}
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                        <option value="">Seleziona conto...</option>
                        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-gray-700">Note (opzionale)</label>
                <input {...form.register('note')}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Nota aggiuntiva..." />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingTx(null) }}
                  className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
                <button type="submit" disabled={form.formState.isSubmitting}
                  className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {form.formState.isSubmitting ? 'Salvataggio...' : (editingTx ? 'Aggiorna' : 'Salva')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk update modal ───────────────────────────────────────────────── */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Modifica in blocco</h2>
                <p className="text-xs text-gray-400 mt-0.5">{bulkUpdateScope === 'selected' ? `${selectedIds.size} transazioni selezionate` : `${filtered.length} transazioni filtrate`}</p>
              </div>
              <button onClick={() => setShowBulkUpdateModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-500">Lascia vuoti i campi che non vuoi modificare.</p>
              <div>
                <label className="text-xs font-medium text-gray-700">Tipo (opzionale)</label>
                <div className="flex rounded-lg bg-gray-100 p-1 mt-1 gap-1">
                  {(['', 'uscita', 'entrata'] as const).map(v => (
                    <button key={v} type="button" onClick={() => setBulkUpdateType(v)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        bulkUpdateType === v ? v === 'uscita' ? 'bg-red-500 text-white' : v === 'entrata' ? 'bg-green-500 text-white' : 'bg-white shadow text-gray-700' : 'text-gray-500'
                      }`}>
                      {v === '' ? 'Non cambiare' : v === 'uscita' ? 'Uscita' : 'Entrata'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Macrocategoria (opzionale)</label>
                <select value={bulkUpdateBudgetCategoryId} onChange={e => setBulkUpdateBudgetCategoryId(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">— Non cambiare —</option>
                  {budgetCategories.map((bc: any) => <option key={bc.id} value={bc.id}>{bc.icon} {bc.name}</option>)}
                </select>
              </div>
              {bulkUpdateError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bulkUpdateError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBulkUpdateModal(false)}
                  className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
                <button type="button" disabled={bulkUpdating || !bulkUpdateValid} onClick={handleBulkUpdate}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                  {bulkUpdating ? <><Loader2 className="h-4 w-4 animate-spin" /> Aggiornamento...</> : `Applica a ${bulkUpdateCount} transazioni`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk delete modal ───────────────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-red-600">Eliminazione massiva</h2>
              <button onClick={() => { setShowBulkModal(false); setBulkConfirm(false) }}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex rounded-lg bg-gray-100 p-1 gap-1 text-xs font-medium">
                {(['date', 'account', 'all'] as const).map(m => (
                  <button key={m} type="button" onClick={() => { setBulkMode(m); setBulkConfirm(false); setBulkError('') }}
                    className={`flex-1 py-2 rounded-md transition-colors ${bulkMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {m === 'date' ? 'Per data' : m === 'account' ? 'Per conto' : 'Tutte'}
                  </button>
                ))}
              </div>
              {bulkMode === 'date' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Da</label>
                    <input type="date" value={bulkDateFrom} onChange={e => { setBulkDateFrom(e.target.value); setBulkConfirm(false) }}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">A</label>
                    <input type="date" value={bulkDateTo} onChange={e => { setBulkDateTo(e.target.value); setBulkConfirm(false) }}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                  </div>
                </div>
              )}
              {bulkMode === 'account' && (
                <div>
                  <label className="text-xs font-medium text-gray-700">Conto</label>
                  <select value={bulkAccountId} onChange={e => { setBulkAccountId(e.target.value); setBulkConfirm(false) }}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300">
                    <option value="">Seleziona conto...</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {bulkMode === 'all' && (
                <p className="text-sm text-gray-600 bg-red-50 border border-red-200 rounded-lg p-3">Verranno eliminate <strong>tutte</strong> le transazioni della famiglia.</p>
              )}
              {bulkError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{bulkError}</p>}
              {!bulkConfirm ? (
                <button type="button" disabled={!bulkDeleteValid} onClick={() => setBulkConfirm(true)}
                  className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-40">
                  Procedi con l'eliminazione
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-700 text-center">Sei sicuro? L'azione è irreversibile.</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setBulkConfirm(false)}
                      className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
                    <button type="button" disabled={bulkDeleting} onClick={handleBulkDelete}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {bulkDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminazione...</> : 'Conferma eliminazione'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => setShowImportModal(false)}
        profile={profile}
        accounts={accounts}
        categories={categories}
        budgetCategories={budgetCategories}
        budgetItems={budgetItems}
        transactions={transactions}
        addTransaction={addTransaction}
      />
    </div>
  )
}
