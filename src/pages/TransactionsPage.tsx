import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency, formatDate } from '../lib/utils'
import { Plus, Trash2, X, Filter, Upload, Sparkles, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import ImportModal from '../components/ImportModal'
import { suggestCategory, getStoredApiKey } from '../lib/claudeAI'

const txSchema = z.object({
  date: z.string().min(1, 'Obbligatorio'),
  amount: z.coerce.number().positive('Importo non valido'),
  type: z.enum(['entrata', 'uscita']),
  description: z.string().min(1, 'Obbligatorio'),
  category_id: z.string().min(1, 'Obbligatorio'),
  account_id: z.string().min(1, 'Obbligatorio'),
  budget_category_id: z.string().optional(),
  note: z.string().optional(),
})
type TxForm = z.infer<typeof txSchema>

export default function TransactionsPage() {
  const { transactions, categories, accounts, budgetCategories, categoryBudgetMappings, addTransaction, deleteTransaction, selectedMonth, selectedYear } = useAppStore()
  const { profile } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'entrata' | 'uscita'>('all')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [suggestingCategory, setSuggestingCategory] = useState(false)

  const form = useForm<TxForm>({
    resolver: zodResolver(txSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      type: 'uscita',
    }
  })

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterCategory && t.category_id !== filterCategory) return false
      if (filterAccount && t.account_id !== filterAccount) return false
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, filterType, filterCategory, filterAccount, search])

  const handleSubmit = async (data: TxForm) => {
    if (!profile?.family_id) return
    const { error } = await addTransaction({
      ...data,
      budget_category_id: data.budget_category_id || null,
      family_id: profile.family_id,
      created_by: profile.id,
      source: 'manuale',
    })
    if (!error) {
      setShowModal(false)
      form.reset({
        date: new Date().toISOString().split('T')[0],
        type: 'uscita',
        description: '',
        amount: undefined as any,
        category_id: '',
        account_id: '',
        note: '',
      })
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteTransaction(id)
    setDeletingId(null)
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '-'
  const getCategoryColor = (id: string) => categories.find(c => c.id === id)?.color || '#94a3b8'
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '-'

  const watchType = form.watch('type')
  const watchCategoryId = form.watch('category_id')
  const watchDescription = form.watch('description')
  const filteredCategories = categories.filter(c => c.type === watchType || c.type === 'risparmio')

  const handleSuggestCategory = async () => {
    const desc = watchDescription?.trim()
    if (!desc || !getStoredApiKey()) return
    setSuggestingCategory(true)
    const { categoryId, budgetCategoryId } = await suggestCategory(
      desc, categories, budgetCategories, getStoredApiKey(),
    ).catch(() => ({ categoryId: null, budgetCategoryId: null }))
    if (categoryId) form.setValue('category_id', categoryId)
    if (budgetCategoryId) form.setValue('budget_category_id', budgetCategoryId)
    setSuggestingCategory(false)
  }

  // Auto-suggest macro categoria when category changes
  useEffect(() => {
    if (watchCategoryId) {
      const mapping = categoryBudgetMappings.find((m: any) => m.transaction_category_id === watchCategoryId)
      form.setValue('budget_category_id', mapping?.budget_category_id || '')
    }
  }, [watchCategoryId, categoryBudgetMappings])

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transazioni</h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth - 1))}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtra</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-purple-200 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium hover:bg-purple-100"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importa</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Aggiungi</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border rounded-xl p-4 mb-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Cerca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="col-span-2 md:col-span-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="all">Tutti i tipi</option>
            <option value="entrata">Entrate</option>
            <option value="uscita">Uscite</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Tutte le categorie</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterAccount}
            onChange={e => setFilterAccount(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">Tutti i conti</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-600 font-medium">
          Entrate: {formatCurrency(filtered.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0))}
        </span>
        <span className="text-red-600 font-medium">
          Uscite: {formatCurrency(filtered.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0))}
        </span>
        <span className="text-gray-500">({filtered.length} transazioni)</span>
      </div>

      {/* Transactions list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">Nessuna transazione trovata</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-primary text-sm hover:underline">
              Aggiungi la prima transazione
            </button>
          </div>
        ) : (
          filtered.map(tx => (
            <div key={tx.id} className="bg-white rounded-xl border px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: getCategoryColor(tx.category_id) }}
              >
                {getCategoryName(tx.category_id).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{tx.description}</div>
                <div className="text-xs text-gray-400 flex gap-2">
                  <span>{getCategoryName(tx.category_id)}</span>
                  <span>·</span>
                  <span>{getAccountName(tx.account_id)}</span>
                  {tx.note && <><span>·</span><span className="italic truncate">{tx.note}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className={`font-semibold ${tx.type === 'entrata' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'entrata' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(tx.date)}</div>
                </div>
                <button
                  onClick={() => handleDelete(tx.id)}
                  disabled={deletingId === tx.id}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add transaction modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Nuova transazione</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              {/* Type toggle */}
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => form.setValue('type', 'uscita')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${watchType === 'uscita' ? 'bg-red-500 text-white' : 'text-gray-500'}`}
                >
                  Uscita
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('type', 'entrata')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${watchType === 'entrata' ? 'bg-green-500 text-white' : 'text-gray-500'}`}
                >
                  Entrata
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Importo (€)</label>
                  <input
                    {...form.register('amount')}
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00"
                  />
                  {form.formState.errors.amount && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.amount.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Data</label>
                  <input
                    {...form.register('date')}
                    type="date"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">Descrizione</label>
                  {getStoredApiKey() && (
                    <button
                      type="button"
                      onClick={handleSuggestCategory}
                      disabled={suggestingCategory || !watchDescription?.trim()}
                      className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 disabled:opacity-40"
                    >
                      {suggestingCategory
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Analisi...</>
                        : <><Sparkles className="h-3 w-3" /> Suggerisci categoria AI</>}
                    </button>
                  )}
                </div>
                <input
                  {...form.register('description')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Supermercato Esselunga"
                />
                {form.formState.errors.description && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Categoria</label>
                  <select
                    {...form.register('category_id')}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Seleziona...</option>
                    {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {form.formState.errors.category_id && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.category_id.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Conto</label>
                  <select
                    {...form.register('account_id')}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Seleziona...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {form.formState.errors.account_id && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.account_id.message}</p>}
                </div>
              </div>

              {budgetCategories.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    Macro categoria
                    <span className="text-gray-400 font-normal">(auto-suggerita)</span>
                  </label>
                  <select
                    {...form.register('budget_category_id')}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                  >
                    <option value="">— Non classificata —</option>
                    {budgetCategories.map((bc: any) => (
                      <option key={bc.id} value={bc.id}>{bc.icon} {bc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700">Note (opzionale)</label>
                <input
                  {...form.register('note')}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Nota aggiuntiva..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {form.formState.isSubmitting ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={(count) => {
          setShowImportModal(false)
          // reload transactions is handled by addTransaction updating store
        }}
        profile={profile}
        accounts={accounts}
        categories={categories}
        budgetCategories={budgetCategories}
        transactions={transactions}
        addTransaction={addTransaction}
      />
    </div>
  )
}
