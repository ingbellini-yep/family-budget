import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'
import { MONTHS_IT } from '../lib/budgetUtils'
import { Plus, Trash2, X, Edit2, RefreshCw, AlertCircle } from 'lucide-react'

type Frequency = 'mensile' | 'annuale' | 'settimanale' | 'mesi_specifici'

const FREQ_LABELS: Record<string, string> = {
  mensile: 'Mensile',
  annuale: 'Annuale',
  settimanale: 'Settimanale',
  mesi_specifici: 'Mesi specifici',
}

const FREQ_COLORS: Record<string, string> = {
  mensile: 'bg-blue-100 text-blue-700',
  annuale: 'bg-purple-100 text-purple-700',
  settimanale: 'bg-green-100 text-green-700',
  mesi_specifici: 'bg-orange-100 text-orange-700',
}

const defaultForm = () => ({
  name: '',
  amount: '',
  frequency: 'mensile' as Frequency,
  due_day: '1',
  next_due_date: new Date().toISOString().split('T')[0],
  account_id: '',
  category_id: '',
  active: true,
  recurrence_months: [] as number[],
})

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export default function RecurringPage() {
  const { profile } = useAuthStore()
  const { categories, accounts, recurringExpenses, loadRecurringExpenses } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.family_id) loadRecurringExpenses(profile.family_id)
  }, [profile?.family_id])

  const openAdd = () => {
    setEditingId(null)
    setForm(defaultForm())
    setShowModal(true)
  }

  const openEdit = (r: any) => {
    setEditingId(r.id)
    setForm({
      name: r.name,
      amount: String(r.amount),
      frequency: r.frequency,
      due_day: String(r.due_day),
      next_due_date: r.next_due_date,
      account_id: r.account_id || '',
      category_id: r.category_id || '',
      active: r.active !== false,
      recurrence_months: Array.isArray(r.recurrence_months) ? r.recurrence_months : [],
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!profile?.family_id || !form.name.trim() || !form.amount) return
    setSaving(true)
    const payload = {
      family_id: profile.family_id,
      name: form.name.trim(),
      amount: parseFloat(form.amount) || 0,
      frequency: form.frequency,
      due_day: parseInt(form.due_day) || 1,
      next_due_date: form.next_due_date,
      account_id: form.account_id || null,
      category_id: form.category_id || null,
      active: form.active,
      recurrence_months: form.frequency === 'mesi_specifici' ? form.recurrence_months : null,
    }
    if (editingId) {
      await supabase.from('recurring_expenses').update(payload as any).eq('id', editingId)
    } else {
      await supabase.from('recurring_expenses').insert(payload as any)
    }
    await loadRecurringExpenses(profile.family_id)
    setSaving(false)
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    if (!profile?.family_id || !confirm('Eliminare questa spesa ricorrente?')) return
    setDeletingId(id)
    await supabase.from('recurring_expenses').delete().eq('id', id)
    await loadRecurringExpenses(profile.family_id)
    setDeletingId(null)
  }

  const handleToggleActive = async (r: any) => {
    if (!profile?.family_id) return
    await supabase.from('recurring_expenses').update({ active: !r.active }).eq('id', r.id)
    await loadRecurringExpenses(profile.family_id)
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '—'
  const getCategoryColor = (id: string) => categories.find(c => c.id === id)?.color || '#94a3b8'
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '—'

  const active = recurringExpenses.filter((r: any) => r.active !== false)
  const inactive = recurringExpenses.filter((r: any) => r.active === false)

  const monthlyTotal = active
    .filter((r: any) => r.frequency === 'mensile')
    .reduce((s: number, r: any) => s + Number(r.amount), 0)

  const annualTotal = active.reduce((s: number, r: any) => {
    const amt = Number(r.amount)
    if (r.frequency === 'mensile') return s + amt * 12
    if (r.frequency === 'settimanale') return s + amt * 52
    if (r.frequency === 'mesi_specifici') {
      const months: number[] = Array.isArray(r.recurrence_months) ? r.recurrence_months : []
      return s + amt * months.length
    }
    return s + amt
  }, 0)

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spese Ricorrenti</h1>
          <p className="text-sm text-muted-foreground">Abbonamenti, utenze e rate fisse</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Aggiungi</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Mensile fisso</span>
          </div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(monthlyTotal)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{active.filter((r: any) => r.frequency === 'mensile').length} voci</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Totale annuale</span>
          </div>
          <div className="text-xl font-bold text-purple-600">{formatCurrency(annualTotal)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{active.length} voci attive</div>
        </div>
      </div>

      {/* Active recurring */}
      <div className="space-y-2 mb-6">
        {active.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-4xl mb-3">🔄</p>
            <p className="text-gray-500">Nessuna spesa ricorrente</p>
            <button onClick={openAdd} className="mt-3 text-primary text-sm hover:underline">
              Aggiungi la prima
            </button>
          </div>
        ) : (
          active.map((r: any) => {
            const days = daysUntil(r.next_due_date)
            const isUrgent = days <= 5
            const isPast = days < 0
            return (
              <div key={r.id} className="bg-white rounded-xl border px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: getCategoryColor(r.category_id) }}
                >
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{r.name}</div>
                  <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${FREQ_COLORS[r.frequency] || 'bg-gray-100 text-gray-600'}`}>
                      {r.frequency === 'mesi_specifici' && Array.isArray(r.recurrence_months) && r.recurrence_months.length > 0
                        ? [...r.recurrence_months].sort((a: number, b: number) => a - b).map((m: number) => MONTHS_IT[m - 1]).join(', ')
                        : (FREQ_LABELS[r.frequency] || r.frequency)}
                    </span>
                    {r.category_id && <span>{getCategoryName(r.category_id)}</span>}
                    {r.account_id && <><span>·</span><span>{getAccountName(r.account_id)}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-red-600 text-sm">{formatCurrency(Number(r.amount))}</div>
                    <div className={`text-xs flex items-center gap-0.5 justify-end ${isPast ? 'text-red-500' : isUrgent ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {isPast && <AlertCircle className="h-3 w-3" />}
                      {isPast ? `Scaduta ${Math.abs(days)}g fa` : days === 0 ? 'Oggi' : `${days}g`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(r)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleToggleActive(r)} className="p-1.5 text-gray-300 hover:text-yellow-500 rounded-lg hover:bg-yellow-50" title="Disattiva">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Inactive section */}
      {inactive.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Disattivate ({inactive.length})</h3>
          <div className="space-y-2">
            {inactive.map((r: any) => (
              <div key={r.id} className="bg-white rounded-xl border px-4 py-3 flex items-center gap-3 opacity-50">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-700 text-sm truncate">{r.name}</div>
                  <div className="text-xs text-gray-400">{FREQ_LABELS[r.frequency]} · {formatCurrency(Number(r.amount))}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggleActive(r)} className="text-xs text-green-600 hover:underline px-2 py-1">Riattiva</button>
                  <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} className="p-1.5 text-gray-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Modifica ricorrente' : 'Nuova spesa ricorrente'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Nome</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Netflix, Mutuo, Palestra..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Importo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Frequenza</label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Frequency, recurrence_months: [] }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="mensile">Mensile</option>
                    <option value="annuale">Annuale</option>
                    <option value="settimanale">Settimanale</option>
                    <option value="mesi_specifici">Mesi specifici</option>
                  </select>
                </div>
              </div>
              {form.frequency === 'mesi_specifici' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-2">
                    Mesi di addebito{' '}
                    <span className="text-gray-400 font-normal">
                      ({form.recurrence_months.length} sel.{form.amount ? ` · ${(parseFloat(form.amount) * form.recurrence_months.length).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}/anno` : ''})
                    </span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MONTHS_IT.map((m, idx) => {
                      const monthNum = idx + 1
                      const selected = form.recurrence_months.includes(monthNum)
                      return (
                        <button
                          key={monthNum}
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            recurrence_months: selected
                              ? f.recurrence_months.filter(x => x !== monthNum)
                              : [...f.recurrence_months, monthNum],
                          }))}
                          className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selected
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary'
                          }`}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Giorno scadenza</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.due_day}
                    onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Prossima scadenza</label>
                  <input
                    type="date"
                    value={form.next_due_date}
                    onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Categoria</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Nessuna</option>
                    {categories.filter(c => c.type === 'uscita').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Conto</label>
                  <select
                    value={form.account_id}
                    onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Nessuno</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring-active"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="recurring-active" className="text-sm text-gray-700">Attiva</label>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.amount}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
