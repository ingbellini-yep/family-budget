import { useState, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'
import { Plus, Trash2, X, Edit2, Target, TrendingUp } from 'lucide-react'

const GOAL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
]

const GOAL_ICONS = ['🎯', '🏖️', '🏠', '🚗', '💍', '🎓', '💊', '🌍', '📱', '💰', '🛡️', '✈️']

function monthsUntil(dateStr: string): number {
  const today = new Date()
  const target = new Date(dateStr + 'T00:00:00')
  return Math.max(0, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()))
}

const defaultForm = () => ({
  name: '',
  icon: '🎯',
  color: '#3b82f6',
  target_amount: '',
  current_amount: '',
  target_date: '',
})

export default function GoalsPage() {
  const { profile } = useAuthStore()
  const { savingsGoals, loadSavingsGoals } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [depositModal, setDepositModal] = useState<any | null>(null)
  const [depositAmount, setDepositAmount] = useState('')

  useEffect(() => {
    if (profile?.family_id) loadSavingsGoals(profile.family_id)
  }, [profile?.family_id])

  const openAdd = () => {
    setEditingId(null)
    setForm(defaultForm())
    setShowModal(true)
  }

  const openEdit = (g: any) => {
    setEditingId(g.id)
    setForm({
      name: g.name,
      icon: g.icon || '🎯',
      color: g.color || '#3b82f6',
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount || 0),
      target_date: g.target_date || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!profile?.family_id || !form.name.trim() || !form.target_amount) return
    setSaving(true)
    const payload = {
      family_id: profile.family_id,
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      target_amount: parseFloat(form.target_amount) || 0,
      current_amount: parseFloat(form.current_amount) || 0,
      target_date: form.target_date || null,
    }
    if (editingId) {
      await supabase.from('savings_goals').update(payload).eq('id', editingId)
    } else {
      await supabase.from('savings_goals').insert(payload)
    }
    await loadSavingsGoals(profile.family_id)
    setSaving(false)
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    if (!profile?.family_id || !confirm('Eliminare questo obiettivo?')) return
    setDeletingId(id)
    await supabase.from('savings_goals').delete().eq('id', id)
    await loadSavingsGoals(profile.family_id)
    setDeletingId(null)
  }

  const handleDeposit = async () => {
    if (!profile?.family_id || !depositModal || !depositAmount) return
    const newAmount = (Number(depositModal.current_amount) || 0) + (parseFloat(depositAmount) || 0)
    await supabase.from('savings_goals').update({ current_amount: newAmount }).eq('id', depositModal.id)
    await loadSavingsGoals(profile.family_id)
    setDepositModal(null)
    setDepositAmount('')
  }

  const totalTarget = savingsGoals.reduce((s: number, g: any) => s + Number(g.target_amount), 0)
  const totalCurrent = savingsGoals.reduce((s: number, g: any) => s + Number(g.current_amount || 0), 0)

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Obiettivi Risparmio</h1>
          <p className="text-sm text-muted-foreground">Monitora i tuoi traguardi finanziari</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuovo obiettivo</span>
        </button>
      </div>

      {/* Summary */}
      {savingsGoals.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Riepilogo obiettivi</span>
          </div>
          <div className="flex gap-6 text-sm mb-3">
            <div>
              <span className="text-gray-500">Accantonato</span>
              <div className="font-bold text-blue-700">{formatCurrency(totalCurrent)}</div>
            </div>
            <div>
              <span className="text-gray-500">Totale target</span>
              <div className="font-bold text-gray-700">{formatCurrency(totalTarget)}</div>
            </div>
            <div>
              <span className="text-gray-500">Avanzamento</span>
              <div className="font-bold text-green-700">
                {totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%
              </div>
            </div>
          </div>
          <div className="h-2.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Goals grid */}
      {savingsGoals.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-500">Nessun obiettivo di risparmio</p>
          <button onClick={openAdd} className="mt-3 text-primary text-sm hover:underline">
            Crea il primo obiettivo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savingsGoals.map((g: any) => {
            const pct = g.target_amount > 0 ? Math.min((Number(g.current_amount || 0) / Number(g.target_amount)) * 100, 100) : 0
            const remaining = Number(g.target_amount) - Number(g.current_amount || 0)
            const months = g.target_date ? monthsUntil(g.target_date) : null
            const monthlyNeeded = months && months > 0 ? remaining / months : null
            const isCompleted = pct >= 100

            return (
              <div key={g.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isCompleted ? 'ring-2 ring-green-400' : ''}`}>
                <div className="h-1.5" style={{ backgroundColor: g.color || '#3b82f6' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{g.icon || '🎯'}</span>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{g.name}</div>
                        {g.target_date && (
                          <div className="text-xs text-gray-400">
                            Entro {new Date(g.target_date + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                    {isCompleted && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Completato</span>}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{formatCurrency(Number(g.current_amount || 0))}</span>
                      <span className="font-medium" style={{ color: g.color || '#3b82f6' }}>{Math.round(pct)}%</span>
                      <span>{formatCurrency(Number(g.target_amount))}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: g.color || '#3b82f6' }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  {!isCompleted && (
                    <div className="flex gap-3 text-xs text-gray-500 mb-4">
                      <span>Mancano <strong className="text-gray-700">{formatCurrency(remaining)}</strong></span>
                      {months !== null && <span>· <strong className="text-gray-700">{months}</strong> mesi</span>}
                      {monthlyNeeded && monthlyNeeded > 0 && (
                        <span>· <strong className="text-gray-700">{formatCurrency(monthlyNeeded)}</strong>/mese</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!isCompleted && (
                      <button
                        onClick={() => { setDepositModal(g); setDepositAmount('') }}
                        className="flex-1 py-1.5 text-xs font-medium rounded-lg border text-primary border-primary/30 hover:bg-primary/5"
                      >
                        + Versamento
                      </button>
                    )}
                    <button onClick={() => openEdit(g)} className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={deletingId === g.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{editingId ? 'Modifica obiettivo' : 'Nuovo obiettivo'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Icon picker */}
              <div>
                <label className="text-xs font-medium text-gray-700">Icona</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {GOAL_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, icon }))}
                      className={`h-9 w-9 rounded-lg text-xl transition-all flex items-center justify-center ${form.icon === icon ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-gray-100'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Nome obiettivo</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Vacanza Grecia, Fondo emergenza..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Target (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.target_amount}
                    onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Accantonato (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.current_amount}
                    onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Data target (opzionale)</label>
                <input
                  type="date"
                  value={form.target_date}
                  onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs font-medium text-gray-700">Colore</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {GOAL_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.target_amount}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit modal */}
      {depositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Versamento — {depositModal.name}</h2>
              <button onClick={() => setDepositModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="mb-1 text-xs text-gray-500">
              Accantonato: <strong>{formatCurrency(Number(depositModal.current_amount || 0))}</strong> / {formatCurrency(Number(depositModal.target_amount))}
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700">Importo versamento (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDepositModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annulla
              </button>
              <button
                onClick={handleDeposit}
                disabled={!depositAmount}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                Versa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
