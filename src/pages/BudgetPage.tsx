import { useState, useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Edit2, X } from 'lucide-react'

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export default function BudgetPage() {
  const { categories, budgets, transactions, selectedYear, setSelectedYear, loadBudgets } = useAppStore()
  const { profile } = useAuthStore()
  const [editModal, setEditModal] = useState<{ categoryId: string; month: number | null; current: number } | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewYear, setViewYear] = useState(selectedYear)

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'uscita'), [categories])

  // Build budget table data
  const tableData = useMemo(() => {
    return expenseCategories.map(cat => {
      const months = MONTHS_IT.map((_, idx) => {
        const month = idx + 1
        const bud = budgets.find(b => b.category_id === cat.id && b.year === viewYear && (b.month === month || b.month === null))
        const spent = transactions
          .filter(t => {
            if (t.type !== 'uscita' || t.category_id !== cat.id) return false
            const d = new Date(t.date)
            return d.getFullYear() === viewYear && d.getMonth() + 1 === month
          })
          .reduce((s: number, t: any) => s + t.amount, 0)
        const budgeted = bud?.amount || 0
        const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0
        return { budgeted, spent, percentage, budgetId: bud?.id }
      })
      const totalBudgeted = months.reduce((s, m) => s + m.budgeted, 0)
      const totalSpent = months.reduce((s, m) => s + m.spent, 0)
      return { category: cat, months, totalBudgeted, totalSpent }
    })
  }, [expenseCategories, budgets, transactions, viewYear])

  const cellColor = (pct: number, hasBudget: boolean) => {
    if (!hasBudget) return 'bg-gray-50'
    if (pct === 0) return 'bg-white'
    if (pct < 80) return 'bg-green-50'
    if (pct < 100) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  const textColor = (pct: number, hasBudget: boolean) => {
    if (!hasBudget || pct === 0) return 'text-gray-400'
    if (pct < 80) return 'text-green-700'
    if (pct < 100) return 'text-yellow-700'
    return 'text-red-700'
  }

  const handleSaveBudget = async () => {
    if (!editModal || !profile?.family_id) return
    setSaving(true)
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0) { setSaving(false); return }

    if (editModal.current > 0 || amount > 0) {
      // upsert
      const existing = budgets.find(b =>
        b.category_id === editModal.categoryId &&
        b.year === viewYear &&
        b.month === editModal.month
      )
      if (existing) {
        await supabase.from('budgets').update({ amount }).eq('id', existing.id)
      } else {
        await supabase.from('budgets').insert({
          family_id: profile.family_id,
          category_id: editModal.categoryId,
          year: viewYear,
          month: editModal.month,
          amount,
        })
      }
      await loadBudgets(profile.family_id, viewYear)
    }
    setSaving(false)
    setEditModal(null)
  }

  const prevYear = () => setViewYear(y => y - 1)
  const nextYear = () => setViewYear(y => y + 1)

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-muted-foreground">Pianifica le spese per categoria</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
          <button onClick={prevYear} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold w-12 text-center">{viewYear}</span>
          <button onClick={nextYear} className="text-gray-400 hover:text-gray-700">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-100 border border-green-300"></span> &lt;80%</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-100 border border-yellow-300"></span> 80-100%</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100 border border-red-300"></span> &gt;100%</span>
        <span className="text-gray-400">Clicca su una cella per impostare il budget</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-semibold text-gray-700 min-w-[130px] sticky left-0 bg-gray-50">Categoria</th>
              {MONTHS_IT.map(m => (
                <th key={m} className="text-center p-2 font-medium text-gray-500 min-w-[70px]">{m}</th>
              ))}
              <th className="text-center p-2 font-semibold text-gray-700 min-w-[90px]">Totale</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map(row => (
              <tr key={row.category.id} className="border-b last:border-0 hover:bg-gray-50/50">
                <td className="p-3 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.category.color || '#94a3b8' }}></div>
                    <span className="font-medium text-gray-800 leading-tight">{row.category.name}</span>
                  </div>
                </td>
                {row.months.map((m, idx) => (
                  <td key={idx} className="p-1">
                    <button
                      onClick={() => {
                        setEditModal({ categoryId: row.category.id, month: idx + 1, current: m.budgeted })
                        setEditAmount(m.budgeted > 0 ? String(m.budgeted) : '')
                      }}
                      className={`w-full rounded-lg p-1.5 text-center transition-colors hover:opacity-80 ${cellColor(m.percentage, m.budgeted > 0)}`}
                    >
                      {m.budgeted > 0 ? (
                        <>
                          <div className={`font-medium ${textColor(m.percentage, true)}`}>
                            {formatCurrency(m.spent, 'EUR').replace('€', '').trim()}
                          </div>
                          <div className="text-gray-400 text-[10px]">
                            / {formatCurrency(m.budgeted, 'EUR').replace('€', '').trim()}
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-300 flex items-center justify-center">
                          <Edit2 className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  </td>
                ))}
                <td className="p-2 text-center">
                  <div className={`font-semibold ${row.totalSpent > row.totalBudgeted && row.totalBudgeted > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {formatCurrency(row.totalSpent)}
                  </div>
                  {row.totalBudgeted > 0 && (
                    <div className="text-gray-400 text-[10px]">/ {formatCurrency(row.totalBudgeted)}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td className="p-3 font-semibold text-gray-700 sticky left-0 bg-gray-50">Totale</td>
              {MONTHS_IT.map((_, idx) => {
                const totalSpent = tableData.reduce((s, r) => s + r.months[idx].spent, 0)
                const totalBudgeted = tableData.reduce((s, r) => s + r.months[idx].budgeted, 0)
                return (
                  <td key={idx} className="p-2 text-center">
                    <div className={`font-medium text-xs ${totalSpent > totalBudgeted && totalBudgeted > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatCurrency(totalSpent, 'EUR').replace('€', '').trim()}
                    </div>
                    {totalBudgeted > 0 && <div className="text-gray-400 text-[10px]">/ {formatCurrency(totalBudgeted, 'EUR').replace('€', '').trim()}</div>}
                  </td>
                )
              })}
              <td className="p-2 text-center font-semibold text-sm">
                {formatCurrency(tableData.reduce((s, r) => s + r.totalSpent, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Edit budget modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Imposta budget</h2>
              <button onClick={() => setEditModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{expenseCategories.find(c => c.id === editModal.categoryId)?.name}</span>
              {editModal.month && <span> — {MONTHS_IT[editModal.month - 1]} {viewYear}</span>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Importo budget (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annulla
              </button>
              <button
                onClick={handleSaveBudget}
                disabled={saving}
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
