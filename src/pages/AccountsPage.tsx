import { useState, useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency, formatDate } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Plus, X, CreditCard, Wallet, TrendingUp, PiggyBank, Edit2, Trash2, PowerOff, FileDown } from 'lucide-react'
import { exportEstrattoConto } from '../lib/usePDFExport'

const typeIcons: Record<string, any> = {
  corrente: Wallet, carta: CreditCard, investimento: TrendingUp, risparmio: PiggyBank,
}
const typeLabels: Record<string, string> = {
  corrente: 'Conto corrente', carta: 'Carta di credito', investimento: 'Investimento', risparmio: 'Risparmio',
}
const ownerLabels: Record<string, string> = {
  family: 'Familiare', user1: 'Utente 1', user2: 'Utente 2',
}
const defaultColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#10b981']

const emptyForm = () => ({
  name: '', type: 'corrente' as const, bank_name: '', color: '#3b82f6',
  balance: '', owner: 'family', notes: '', is_default: false,
})

export default function AccountsPage() {
  const { accounts, transactions, categories, loadAccounts } = useAppStore()
  const { profile } = useAuthStore()
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; account?: any } | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [estrattoModal, setEstrattoModal] = useState<{ account: any } | null>(null)
  const [estrattoFrom, setEstrattoFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [estrattoTo, setEstrattoTo] = useState(() => new Date().toISOString().split('T')[0])
  const [estrattoLoading, setEstrattoLoading] = useState(false)

  const activeAccounts = useMemo(() => accounts.filter((a: any) => a.active !== false), [accounts])
  const inactiveAccounts = useMemo(() => accounts.filter((a: any) => a.active === false), [accounts])
  const totalBalance = useMemo(() => activeAccounts.reduce((s: number, a: any) => s + (a.balance || 0), 0), [activeAccounts])

  const getAccountTxs = (id: string) => transactions.filter((t: any) => t.account_id === id).slice(0, 5)
  const getCategoryName = (id: string) => categories.find((c: any) => c.id === id)?.name || '-'
  const hasTxs = (id: string) => transactions.some((t: any) => t.account_id === id)

  const openAdd = () => {
    setForm(emptyForm())
    setModal({ mode: 'add' })
  }
  const openEdit = (account: any) => {
    setForm({
      name: account.name, type: account.type, bank_name: account.bank_name || '',
      color: account.color || '#3b82f6', balance: String(account.balance || 0),
      owner: account.owner || 'family', notes: account.notes || '',
      is_default: !!account.is_default,
    })
    setModal({ mode: 'edit', account })
  }

  const handleSave = async () => {
    if (!profile?.family_id || !form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      type: form.type,
      bank_name: form.bank_name || null,
      color: form.color,
      balance: parseFloat(form.balance) || 0,
      owner: form.owner,
      notes: form.notes || null,
      is_default: form.is_default,
    }
    if (modal?.mode === 'edit' && modal.account) {
      // If setting as default, unset others first
      if (form.is_default) {
        await supabase.from('accounts').update({ is_default: false }).eq('family_id', profile.family_id)
      }
      await supabase.from('accounts').update(payload).eq('id', modal.account.id)
    } else {
      if (form.is_default) {
        await supabase.from('accounts').update({ is_default: false }).eq('family_id', profile.family_id)
      }
      await supabase.from('accounts').insert({ ...payload, family_id: profile.family_id, icon: null })
    }
    await loadAccounts(profile.family_id)
    setSaving(false)
    setModal(null)
  }

  const handleToggleActive = async (account: any) => {
    if (!profile?.family_id) return
    await supabase.from('accounts').update({ active: !account.active }).eq('id', account.id)
    await loadAccounts(profile.family_id)
  }

  const handleDelete = async (account: any) => {
    if (!profile?.family_id) return
    if (hasTxs(account.id)) {
      alert('Questo conto ha transazioni associate. Puoi solo disattivarlo.')
      return
    }
    if (!confirm(`Eliminare il conto "${account.name}"? L'operazione è irreversibile.`)) return
    await supabase.from('accounts').delete().eq('id', account.id)
    await loadAccounts(profile.family_id)
  }

  const handleExportEstratto = async () => {
    if (!estrattoModal || !profile?.family_id) return
    setEstrattoLoading(true)
    try {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_id', profile.family_id)
        .eq('account_id', estrattoModal.account.id)
        .gte('date', estrattoFrom)
        .lte('date', estrattoTo)
        .order('date', { ascending: true })
      await exportEstrattoConto({
        account: estrattoModal.account,
        familyName: profile.email || '',
        transactions: txs || [],
        categories,
        fromDate: estrattoFrom,
        toDate: estrattoTo,
      })
      setEstrattoModal(null)
    } catch (e) {
      alert('Errore durante la generazione del PDF.')
    } finally {
      setEstrattoLoading(false)
    }
  }

  const AccountCard = ({ account }: { account: any }) => {
    const Icon = typeIcons[account.type] || Wallet
    const recentTx = getAccountTxs(account.id)
    const isExpanded = expandedId === account.id
    const inactive = account.active === false

    return (
      <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${inactive ? 'opacity-60' : ''}`}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 text-lg"
              style={{ backgroundColor: account.color || '#3b82f6' }}>
              {account.icon ? account.icon : <Icon className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : account.id)}>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 truncate">{account.name}</span>
                {account.is_default && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">default</span>}
                {inactive && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">inattivo</span>}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {typeLabels[account.type]}
                {account.bank_name && ` · ${account.bank_name}`}
                {account.owner && account.owner !== 'family' && ` · ${ownerLabels[account.owner]}`}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-base font-bold ${(account.balance || 0) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatCurrency(account.balance || 0)}
              </div>
              <div className="text-xs text-gray-400">Saldo</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t flex-wrap">
            <button onClick={() => openEdit(account)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100">
              <Edit2 className="h-3.5 w-3.5" /> Modifica
            </button>
            <button onClick={() => handleToggleActive(account)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-gray-100 ${inactive ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <PowerOff className="h-3.5 w-3.5" />
              {inactive ? 'Riattiva' : 'Disattiva'}
            </button>
            <button onClick={() => setEstrattoModal({ account })}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50">
              <FileDown className="h-3.5 w-3.5" /> Estratto PDF
            </button>
            <button onClick={() => handleDelete(account)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 ml-auto">
              <Trash2 className="h-3.5 w-3.5" /> Elimina
            </button>
          </div>
        </div>

        {/* Recent transactions */}
        {isExpanded && (
          <div className="border-t px-4 pb-4 bg-gray-50/50">
            <p className="text-xs font-medium text-gray-500 mt-3 mb-2">Transazioni recenti</p>
            {recentTx.length === 0 ? (
              <p className="text-xs text-gray-400">Nessuna transazione</p>
            ) : (
              <div className="space-y-1.5">
                {recentTx.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{formatDate(tx.date)}</span>
                      <span className="text-gray-700 truncate max-w-[130px]">{tx.description}</span>
                      <span className="text-gray-400 hidden sm:inline">{getCategoryName(tx.category_id)}</span>
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
  }

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conti</h1>
          <p className="text-sm text-gray-500">Gestisci i tuoi conti bancari</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Aggiungi
        </button>
      </div>

      {/* Total balance */}
      <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-5 text-white mb-6 shadow-lg">
        <p className="text-blue-100 text-sm">Patrimonio totale (conti attivi)</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
        <p className="text-blue-200 text-xs mt-1">{activeAccounts.length} conti attivi</p>
      </div>

      {/* Active accounts */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-4xl mb-3">🏦</p>
          <p className="text-gray-500">Nessun conto ancora</p>
          <button onClick={openAdd} className="mt-3 text-primary text-sm hover:underline">Aggiungi il primo conto</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {activeAccounts.map((account: any) => <AccountCard key={account.id} account={account} />)}
        </div>
      )}

      {/* Inactive accounts */}
      {inactiveAccounts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Conti disattivati</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {inactiveAccounts.map((account: any) => <AccountCard key={account.id} account={account} />)}
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-semibold">{modal.mode === 'add' ? 'Nuovo conto' : 'Modifica conto'}</h2>
              <button onClick={() => setModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Nome conto *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Fineco Corrente" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="corrente">Corrente</option>
                    <option value="carta">Carta di credito</option>
                    <option value="investimento">Investimento</option>
                    <option value="risparmio">Risparmio</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Intestatario</label>
                  <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="family">Familiare</option>
                    <option value="user1">Utente 1</option>
                    <option value="user2">Utente 2</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Banca</label>
                  <input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="es. Fineco" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Saldo (€)</label>
                  <input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0,00" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Colore</label>
                <div className="flex gap-2 flex-wrap">
                  {defaultColors.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="h-7 w-7 rounded-full cursor-pointer border-0 p-0" title="Colore personalizzato" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Note (IBAN, note libere)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. IT60 X054 2811 1010 0000 0123 456" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-700">Conto predefinito</div>
                  <div className="text-[10px] text-gray-400">Pre-selezionato nei form transazioni</div>
                </div>
                <button onClick={() => setForm(f => ({ ...f, is_default: !f.is_default }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_default ? 'bg-primary' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${form.is_default ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annulla
              </button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estratto Conto Modal */}
      {estrattoModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-sm">📄 Estratto Conto PDF</h2>
              <button onClick={() => setEstrattoModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="font-medium text-blue-800 text-sm">{estrattoModal.account.name}</div>
                <div className="text-xs text-blue-600 mt-0.5">{estrattoModal.account.type} · Saldo {formatCurrency(estrattoModal.account.balance || 0)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Da data</label>
                  <input type="date" value={estrattoFrom} onChange={e => setEstrattoFrom(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">A data</label>
                  <input type="date" value={estrattoTo} onChange={e => setEstrattoTo(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
              </div>
              <p className="text-xs text-gray-400">Il PDF includerà tutte le transazioni del conto nel periodo selezionato con saldo progressivo.</p>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setEstrattoModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annulla
              </button>
              <button onClick={handleExportEstratto} disabled={estrattoLoading || !estrattoFrom || !estrattoTo}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <FileDown className="h-4 w-4" />
                {estrattoLoading ? 'Generazione...' : 'Scarica PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
