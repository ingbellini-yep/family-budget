import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, X, Copy, Check, Users, Mail, Shield, RefreshCw, UserMinus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#16a34a',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#94a3b8',
]

const ROLE_OPTIONS = [
  { value: 'admin',    label: 'Amministratore',         desc: 'Accesso completo, può invitare e gestire la famiglia' },
  { value: 'editor',   label: 'Membro completo',         desc: 'CRUD transazioni, budget, conti — no inviti' },
  { value: 'viewer',   label: 'Sola lettura',            desc: 'Può visualizzare tutto senza modifiche' },
  { value: 'readonly', label: 'Solo dashboard',          desc: 'Vede solo la dashboard e i report' },
  { value: 'dependent',label: 'Dipendente (pocket money)',desc: 'Accesso limitato con budget mensile personale' },
]

const ALL_SECTIONS = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'transactions', label: 'Transazioni' },
  { key: 'budget',       label: 'Budget' },
  { key: 'accounts',     label: 'Conti' },
  { key: 'recurring',    label: 'Ricorrenti' },
  { key: 'goals',        label: 'Obiettivi' },
]

type SettingsTab = 'profilo' | 'utenti' | 'categorie' | 'ai'

export default function SettingsPage() {
  const { profile, loadProfile, isAdmin } = useAuthStore()
  const { categories, loadCategories } = useAppStore()
  const [tab, setTab] = useState<SettingsTab>('profilo')

  // ── Profilo ──────────────────────────────────────────────
  const [familyName, setFamilyName] = useState('')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [claudeApiKey, setClaudeApiKey] = useState(() => localStorage.getItem('claude_api_key') || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingFamily, setSavingFamily] = useState(false)
  const [copied, setCopied] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)

  // ── Utenti ───────────────────────────────────────────────
  const [members, setMembers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteAllowedSections, setInviteAllowedSections] = useState<string[]>(ALL_SECTIONS.map(s => s.key))
  const [invitePocketMoney, setInvitePocketMoney] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; emailSent: boolean } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<{ id: string; role: string } | null>(null)
  const [savingMember, setSavingMember] = useState(false)

  // ── Categorie ────────────────────────────────────────────
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<any | null>(null)
  const [catName, setCatName] = useState('')
  const [catType, setCatType] = useState<'entrata' | 'uscita' | 'risparmio'>('uscita')
  const [catColor, setCatColor] = useState('#3b82f6')
  const [savingCat, setSavingCat] = useState(false)
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.family_id) {
      supabase.from('families').select('name').eq('id', profile.family_id).single().then(({ data }) => {
        if (data) setFamilyName(data.name)
      })
    }
    if (tab === 'utenti') loadUsersData()
  }, [profile?.family_id, tab])

  // ── Profile handlers ─────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!profile) return
    setSavingProfile(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
    await loadProfile()
    setSavingProfile(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const handleSaveFamily = async () => {
    if (!profile?.family_id) return
    setSavingFamily(true)
    await supabase.from('families').update({ name: familyName }).eq('id', profile.family_id)
    setSavingFamily(false)
  }

  const handleSaveApiKey = () => {
    localStorage.setItem('claude_api_key', claudeApiKey)
    setApiKeySaved(true)
    setTimeout(() => setApiKeySaved(false), 2000)
  }

  const handleCopyFamilyId = async () => {
    if (!profile?.family_id) return
    await navigator.clipboard.writeText(profile.family_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Users handlers ───────────────────────────────────────

  const loadUsersData = async () => {
    if (!profile?.family_id) return
    setLoadingUsers(true)
    const [{ data: profs }, { data: invs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('family_id', profile.family_id).order('created_at'),
      supabase.from('family_invites').select('*').eq('family_id', profile.family_id).order('created_at', { ascending: false }),
    ])
    setMembers(profs || [])
    setInvites(invs || [])
    setLoadingUsers(false)
  }

  const handleSendInvite = async () => {
    if (!profile?.family_id || !inviteEmail.trim()) return
    setSendingInvite(true)
    setInviteError(null)
    setInviteResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('send-invite', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          allowed_sections: inviteRole === 'editor' ? inviteAllowedSections : null,
          pocket_money_limit: inviteRole === 'dependent' && invitePocketMoney ? parseFloat(invitePocketMoney) : null,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      })

      if (res.error) throw new Error(res.error.message)
      const result = res.data
      if (result.error) throw new Error(result.error)

      setInviteResult({ url: result.inviteUrl, emailSent: result.emailSent })
      setInviteEmail('')
      setInviteRole('editor')
      setInvitePocketMoney('')
      await loadUsersData()
    } catch (e: any) {
      setInviteError(e.message || 'Errore durante l\'invio')
    } finally {
      setSendingInvite(false)
    }
  }

  const handleRevokeAccess = async (memberId: string) => {
    if (!profile?.family_id) return
    if (!confirm('Revocare l\'accesso a questo membro? Il suo profilo verrà dissociato dalla famiglia.')) return
    await supabase.from('profiles').update({ family_id: null, role: 'viewer' }).eq('id', memberId)
    await loadUsersData()
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Revocare questo invito?')) return
    await supabase.from('family_invites').update({ status: 'revoked' }).eq('id', inviteId)
    await loadUsersData()
  }

  const handleResendInvite = async (inv: any) => {
    setInviteEmail(inv.email)
    setInviteRole(inv.role)
    setShowInviteForm(true)
    setTab('utenti')
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveMemberRole = async () => {
    if (!editingMember) return
    setSavingMember(true)
    await supabase.from('profiles').update({ role: editingMember.role as any }).eq('id', editingMember.id)
    await loadUsersData()
    setSavingMember(false)
    setEditingMember(null)
  }

  // ── Category handlers ─────────────────────────────────────

  const openAddCat = () => {
    setEditingCat(null); setCatName(''); setCatType('uscita'); setCatColor('#3b82f6')
    setShowCatModal(true)
  }
  const openEditCat = (cat: any) => {
    setEditingCat(cat); setCatName(cat.name); setCatType(cat.type); setCatColor(cat.color || '#3b82f6')
    setShowCatModal(true)
  }
  const handleSaveCat = async () => {
    if (!catName.trim() || !profile?.family_id) return
    setSavingCat(true)
    if (editingCat) {
      await supabase.from('categories').update({ name: catName, type: catType, color: catColor }).eq('id', editingCat.id)
    } else {
      await supabase.from('categories').insert({ family_id: profile.family_id, name: catName, type: catType, color: catColor, is_default: false, icon: null })
    }
    await loadCategories(profile.family_id)
    setSavingCat(false); setShowCatModal(false)
  }
  const handleDeleteCat = async (id: string) => {
    if (!profile?.family_id) return
    if (!confirm('Eliminare questa categoria?')) return
    setDeletingCatId(id)
    await supabase.from('categories').delete().eq('id', id)
    await loadCategories(profile.family_id)
    setDeletingCatId(null)
  }

  const groupedCategories = {
    entrata: categories.filter(c => c.type === 'entrata'),
    uscita: categories.filter(c => c.type === 'uscita'),
    risparmio: categories.filter(c => c.type === 'risparmio'),
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      accepted: 'bg-green-100 text-green-700',
      expired: 'bg-gray-100 text-gray-500',
      revoked: 'bg-red-100 text-red-600',
    }
    const labels: Record<string, string> = { pending: 'In attesa', accepted: 'Accettato', expired: 'Scaduto', revoked: 'Revocato' }
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[status] || 'bg-gray-100 text-gray-500'}`}>{labels[status] || status}</span>
  }

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      admin: 'bg-blue-100 text-blue-700',
      editor: 'bg-purple-100 text-purple-700',
      viewer: 'bg-gray-100 text-gray-600',
      dependent: 'bg-orange-100 text-orange-700',
      readonly: 'bg-slate-100 text-slate-600',
    }
    const labels: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer', dependent: 'Dipendente', readonly: 'Readonly' }
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[role] || 'bg-gray-100 text-gray-500'}`}>{labels[role] || role}</span>
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Impostazioni</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {([
          { key: 'profilo',    label: 'Profilo' },
          { key: 'utenti',     label: 'Utenti' },
          { key: 'categorie',  label: 'Categorie' },
          { key: 'ai',         label: 'AI' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB PROFILO ═══════════════════════════════════════ */}
      {tab === 'profilo' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Profilo</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Nome completo</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Email</label>
                <input value={profile?.email || ''} disabled
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Ruolo</label>
                <input value={ROLE_OPTIONS.find(r => r.value === profile?.role)?.label || profile?.role || ''} disabled
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              </div>
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {profileSaved ? <><Check className="h-4 w-4" /> Salvato!</> : savingProfile ? 'Salvataggio...' : 'Salva profilo'}
              </button>
            </div>
          </div>

          {profile?.family_id && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Famiglia</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Nome famiglia</label>
                  <input value={familyName} onChange={e => setFamilyName(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                {isAdmin() && (
                  <button onClick={handleSaveFamily} disabled={savingFamily}
                    className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                    {savingFamily ? 'Salvataggio...' : 'Salva nome'}
                  </button>
                )}
                <div className="border-t pt-3">
                  <label className="text-xs font-medium text-gray-700">Family ID</label>
                  <div className="flex gap-2 mt-1">
                    <input value={profile.family_id} readOnly
                      className="flex-1 border rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-500" />
                    <button onClick={handleCopyFamilyId}
                      className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB UTENTI ════════════════════════════════════════ */}
      {tab === 'utenti' && (
        <div className="space-y-5">

          {/* Invite form — admin only */}
          {isAdmin() && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <button
                onClick={() => setShowInviteForm(f => !f)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold text-sm text-gray-900">Invita nuovo membro</span>
                </div>
                {showInviteForm ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {showInviteForm && (
                <div className="px-5 pb-5 border-t space-y-4 pt-4">
                  {inviteResult && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                      <p className="text-green-800 text-xs font-medium flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" />
                        {inviteResult.emailSent ? 'Email inviata!' : 'Invito creato — email non inviata (RESEND_API_KEY non configurata)'}
                      </p>
                      <p className="text-xs text-green-700">Link invito:</p>
                      <div className="flex items-center gap-2">
                        <input value={inviteResult.url} readOnly
                          className="flex-1 bg-white border border-green-300 rounded-lg px-2 py-1.5 text-xs font-mono text-green-800" />
                        <button onClick={() => { navigator.clipboard.writeText(inviteResult.url); }}
                          className="p-1.5 bg-green-100 rounded-lg hover:bg-green-200">
                          <Copy className="h-3.5 w-3.5 text-green-700" />
                        </button>
                        <a href={inviteResult.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-green-100 rounded-lg hover:bg-green-200">
                          <ExternalLink className="h-3.5 w-3.5 text-green-700" />
                        </a>
                      </div>
                    </div>
                  )}

                  {inviteError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-red-700 text-xs">{inviteError}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Email *</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="nome@esempio.com"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Ruolo *</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                      {ROLE_OPTIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {ROLE_OPTIONS.find(r => r.value === inviteRole)?.desc}
                    </p>
                  </div>

                  {/* Sezioni visibili — solo per editor */}
                  {inviteRole === 'editor' && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-2">Sezioni accessibili</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_SECTIONS.map(s => (
                          <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inviteAllowedSections.includes(s.key)}
                              onChange={e => {
                                if (e.target.checked) setInviteAllowedSections(prev => [...prev, s.key])
                                else setInviteAllowedSections(prev => prev.filter(x => x !== s.key))
                              }}
                              className="rounded border-gray-300 text-blue-600"
                            />
                            <span className="text-xs text-gray-700">{s.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pocket money — solo per dependent */}
                  {inviteRole === 'dependent' && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Limite pocket money mensile (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={invitePocketMoney}
                        onChange={e => setInvitePocketMoney(e.target.value)}
                        placeholder="es. 150"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleSendInvite}
                    disabled={sendingInvite || !inviteEmail.trim()}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {sendingInvite ? 'Invio in corso…' : 'Invia invito'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-sm text-gray-900">Membri attivi</h2>
              <span className="ml-auto text-xs text-gray-400">{members.length} member{members.length !== 1 ? 'i' : 'o'}</span>
            </div>

            {loadingUsers ? (
              <div className="p-8 text-center text-sm text-gray-400">Caricamento…</div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Nessun membro</div>
            ) : (
              <div className="divide-y">
                {members.map((m: any) => (
                  <div key={m.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                        {(m.full_name || m.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 truncate">{m.full_name || '—'}</span>
                          {roleBadge(m.role || 'admin')}
                          {m.id === profile?.id && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">tu</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>

                      {isAdmin() && m.id !== profile?.id && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingMember({ id: m.id, role: m.role || 'editor' })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Modifica ruolo"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRevokeAccess(m.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            title="Revoca accesso"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending invites */}
          {invites.filter((i: any) => i.status !== 'accepted').length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-sm text-gray-900">Inviti</h2>
              </div>
              <div className="divide-y">
                {invites.filter((i: any) => i.status !== 'accepted').map((inv: any) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-700 truncate">{inv.email}</span>
                        {roleBadge(inv.role)}
                        {statusBadge(inv.status)}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inv.expires_at ? `Scade: ${new Date(inv.expires_at).toLocaleDateString('it-IT')}` : ''}
                      </p>
                    </div>
                    {isAdmin() && inv.status === 'pending' && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleResendInvite(inv)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                          title="Reinvia">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleRevokeInvite(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                          title="Revoca">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB CATEGORIE ═══════════════════════════════════ */}
      {tab === 'categorie' && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Categorie</h2>
            <button onClick={openAddCat}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </button>
          </div>
          {(['entrata', 'uscita', 'risparmio'] as const).map(type => (
            <div key={type} className="mb-4 last:mb-0">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
                {type === 'entrata' ? 'Entrate' : type === 'uscita' ? 'Uscite' : 'Risparmio'}
              </h3>
              <div className="space-y-1">
                {groupedCategories[type].map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 group">
                    <div className="h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#94a3b8' }}></div>
                    <span className="flex-1 text-sm text-gray-700">{cat.name}</span>
                    {cat.is_default && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">default</span>}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditCat(cat)} className="text-gray-400 hover:text-primary text-xs px-2 py-1 rounded hover:bg-blue-50">Modifica</button>
                      <button onClick={() => handleDeleteCat(cat.id)} disabled={deletingCatId === cat.id} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {groupedCategories[type].length === 0 && <p className="text-xs text-gray-400 px-3">Nessuna categoria</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ TAB AI ══════════════════════════════════════════ */}
      {tab === 'ai' && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Claude AI</h2>
          <p className="text-xs text-gray-500 mb-4">Usata per importare automaticamente transazioni da screenshot e PDF</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700">API Key Anthropic</label>
              <input type="password" value={claudeApiKey} onChange={e => setClaudeApiKey(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="sk-ant-..." />
            </div>
            <button onClick={handleSaveApiKey}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2">
              {apiKeySaved ? <><Check className="h-4 w-4" /> Salvata!</> : 'Salva API Key'}
            </button>
            <p className="text-xs text-gray-400">La chiave viene salvata solo in localStorage, non sul server.</p>
          </div>
        </div>
      )}

      {/* Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">{editingCat ? 'Modifica categoria' : 'Nuova categoria'}</h2>
              <button onClick={() => setShowCatModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">Nome</label>
                <input value={catName} onChange={e => setCatName(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Palestra" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Tipo</label>
                <select value={catType} onChange={e => setCatType(e.target.value as any)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="uscita">Uscita</option>
                  <option value="entrata">Entrata</option>
                  <option value="risparmio">Risparmio</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Colore</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {CATEGORY_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setCatColor(c)}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${catColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCatModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
              <button onClick={handleSaveCat} disabled={savingCat || !catName.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {savingCat ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit member role modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Modifica ruolo</h2>
              <button onClick={() => setEditingMember(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {ROLE_OPTIONS.map(r => (
                <label key={r.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${editingMember.role === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="radio" name="role" value={r.value} checked={editingMember.role === r.value}
                    onChange={() => setEditingMember(prev => prev ? { ...prev, role: r.value } : null)}
                    className="mt-0.5 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{r.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingMember(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Annulla</button>
              <button onClick={handleSaveMemberRole} disabled={savingMember}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {savingMember ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
