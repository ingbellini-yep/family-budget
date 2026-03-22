import { useState, useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency, formatDate } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Plus, X, CreditCard, Wallet, TrendingUp, PiggyBank } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const accountSchema = z.object({
  name: z.string().min(1, 'Obbligatorio'),
  type: z.enum(['corrente', 'carta', 'investimento', 'risparmio']),
  bank_name: z.string().optional(),
  color: z.string().optional(),
  balance: z.coerce.number().default(0),
})
type AccountForm = z.infer<typeof accountSchema>

const typeIcons: Record<string, any> = {
  corrente: Wallet,
  carta: CreditCard,
  investimento: TrendingUp,
  risparmio: PiggyBank,
}

const typeLabels: Record<string, string> = {
  corrente: 'Conto corrente',
  carta: 'Carta di credito',
  investimento: 'Investimento',
  risparmio: 'Risparmio',
}

const defaultColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

export default function AccountsPage() {
  const { accounts, transactions, categories, loadAccounts } = useAppStore()
  const { profile } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { type: 'corrente', color: '#3b82f6', balance: 0 }
  })

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts])

  const getAccountTransactions = (accountId: string) =>
    transactions.filter(t => t.account_id === accountId).slice(0, 5)

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '-'

  const handleSubmit = async (data: AccountForm) => {
    if (!profile?.family_id) return
    setSaving(true)
    await supabase.from('accounts').insert({
      ...data,
      family_id: profile.family_id,
      bank_name: data.bank_name || null,
      color: data.color || '#3b82f6',
      icon: null,
    })
    await loadAccounts(profile.family_id)
    setSaving(false)
    setShowModal(false)
    form.reset({ type: 'corrente', color: '#3b82f6', balance: 0 })
  }

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conti</h1>
          <p className="text-sm text-muted-foreground">Gestisci i tuoi conti bancari</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Aggiungi
        </button>
      </div>

      {/* Total balance */}
      <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-5 text-white mb-6 shadow-lg">
        <p className="text-blue-100 text-sm">Patrimonio totale</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
        <p className="text-blue-200 text-xs mt-1">{accounts.length} conti</p>
      </div>

      {/* Accounts grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {accounts.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-xl border p-12 text-center">
            <p className="text-4xl mb-3">🏦</p>
            <p className="text-gray-500">Nessun conto ancora</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-primary text-sm hover:underline">
              Aggiungi il primo conto
            </button>
          </div>
        ) : (
          accounts.map(account => {
            const Icon = typeIcons[account.type] || Wallet
            const recentTx = getAccountTransactions(account.id)
            const isSelected = selectedAccount === account.id

            return (
              <div key={account.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Account header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedAccount(isSelected ? null : account.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: account.color || '#3b82f6' }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{account.name}</div>
                      <div className="text-xs text-gray-400">
                        {typeLabels[account.type]}
                        {account.bank_name && ` · ${account.bank_name}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${account.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(account.balance)}
                      </div>
                      <div className="text-xs text-gray-400">Saldo</div>
                    </div>
                  </div>
                </div>

                {/* Recent transactions (expanded) */}
                {isSelected && (
                  <div className="border-t px-4 pb-4">
                    <p className="text-xs font-medium text-gray-500 mt-3 mb-2">Transazioni recenti</p>
                    {recentTx.length === 0 ? (
                      <p className="text-xs text-gray-400">Nessuna transazione</p>
                    ) : (
                      <div className="space-y-2">
                        {recentTx.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{formatDate(tx.date)}</span>
                              <span className="text-gray-700 truncate max-w-[140px]">{tx.description}</span>
                            </div>
                            <span className={tx.type === 'entrata' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {tx.type === 'entrata' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add account modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Nuovo conto</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Nome conto</label>
                <input
                  {...form.register('name')}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Conto BancoPosta"
                />
                {form.formState.errors.name && <p className="text-red-500 text-xs mt-0.5">{form.formState.errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Tipo</label>
                  <select
                    {...form.register('type')}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="corrente">Corrente</option>
                    <option value="carta">Carta</option>
                    <option value="investimento">Investimento</option>
                    <option value="risparmio">Risparmio</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Saldo iniziale (€)</label>
                  <input
                    {...form.register('balance')}
                    type="number"
                    step="0.01"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Banca (opzionale)</label>
                <input
                  {...form.register('bank_name')}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Intesa Sanpaolo"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">Colore</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {defaultColors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => form.setValue('color', c)}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${form.watch('color') === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Annulla
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
