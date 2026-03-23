import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'already_accepted' | 'success'

interface InviteData {
  id: string
  family_id: string
  email: string
  role: string
  token: string
  status: string
  expires_at: string | null
  familyName?: string
}

const roleLabels: Record<string, string> = {
  admin: 'Amministratore',
  editor: 'Membro completo',
  viewer: 'Sola lettura',
  dependent: 'Dipendente (pocket money)',
  readonly: 'Solo dashboard',
}

const roleDescriptions: Record<string, string> = {
  admin: 'Accesso completo, può invitare altri membri',
  editor: 'Può gestire transazioni, budget e conti',
  viewer: 'Può visualizzare tutto, senza modifiche',
  dependent: 'Accesso limitato con budget pocket money mensile',
  readonly: 'Solo visualizzazione dashboard',
}

export default function InvitePage() {
  const navigate = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token')

  const [status, setStatus] = useState<InviteStatus>('loading')
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [existingUser, setExistingUser] = useState<boolean | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate token on mount
  useEffect(() => {
    if (!token) { setStatus('invalid'); return }
    validateToken(token)
  }, [token])

  const validateToken = async (tkn: string) => {
    setStatus('loading')
    // Query the invite by token — policy "family_invites_token_check" allows this
    const { data: inv, error: invErr } = await supabase
      .from('family_invites')
      .select('*')
      .eq('token', tkn)
      .maybeSingle()

    if (invErr || !inv) { setStatus('invalid'); return }
    if (inv.status === 'accepted') { setStatus('already_accepted'); return }
    if (inv.status === 'revoked' || inv.status === 'expired') { setStatus('expired'); return }

    // Check expiry
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      // Mark as expired in DB (best effort)
      await supabase.from('family_invites').update({ status: 'expired' }).eq('id', inv.id)
      setStatus('expired')
      return
    }

    // Fetch family name
    const { data: family } = await supabase
      .from('families')
      .select('name')
      .eq('id', inv.family_id)
      .single()

    setInvite({ ...inv, token: inv.token || '', familyName: family?.name })

    // Check if email is already registered
    // We attempt to check via auth — if not possible, show both forms
    // Since we can't check auth from client anonymously, we show "email" label and let user decide
    setExistingUser(null) // will show toggle
    setStatus('valid')
  }

  const handleAcceptExisting = async () => {
    if (!invite) return
    setSubmitting(true)
    setError(null)

    // Sign in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    })

    if (signInErr) {
      setError('Password non corretta o account non trovato per questa email.')
      setSubmitting(false)
      return
    }

    await linkProfileToFamily()
  }

  const handleRegisterNew = async () => {
    if (!invite || !fullName.trim() || password.length < 6) return
    setSubmitting(true)
    setError(null)

    // Sign up
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName.trim() } }
    })

    if (signUpErr) {
      setError(signUpErr.message)
      setSubmitting(false)
      return
    }

    if (data.user) {
      // Upsert profile with role and family
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: invite.email,
        full_name: fullName.trim(),
        family_id: invite.family_id,
        role: invite.role as any,
      } as any)
      await acceptInvite()
    } else {
      // Email confirmation required
      setError('Controlla la tua email per confermare la registrazione, poi torna su questo link.')
      setSubmitting(false)
    }
  }

  const linkProfileToFamily = async () => {
    if (!invite) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Errore di autenticazione.'); setSubmitting(false); return }

    // Update profile
    await supabase.from('profiles').update({
      family_id: invite.family_id,
      role: invite.role as any,
    }).eq('id', user.id)

    await acceptInvite()
  }

  const acceptInvite = async () => {
    if (!invite) return
    await supabase.from('family_invites').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }).eq('id', invite.id)

    setStatus('success')
    setSubmitting(false)
    setTimeout(() => navigate('/dashboard'), 2500)
  }

  // ── Render ────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-gray-600 text-sm">Verifica del link in corso…</p>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return <StatusCard icon="❌" title="Link non valido" desc="Questo link di invito non esiste o è stato rimosso." color="red" />
  }
  if (status === 'expired') {
    return <StatusCard icon="⏰" title="Link scaduto" desc="Questo invito è scaduto. Chiedi all'amministratore di inviarne uno nuovo." color="yellow" />
  }
  if (status === 'already_accepted') {
    return <StatusCard icon="✅" title="Già accettato" desc="Questo invito è già stato accettato. Accedi direttamente all'app." color="green" action={{ label: 'Vai al login', onClick: () => navigate('/auth') }} />
  }
  if (status === 'success') {
    return <StatusCard icon="🎉" title="Benvenuto!" desc={`Sei entrato nella famiglia ${invite?.familyName || ''}. Reindirizzamento in corso…`} color="green" />
  }

  // Valid invite — show acceptance form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-5 text-center">
          <h1 className="text-white font-bold text-xl">💰 Family Budget</h1>
          <p className="text-blue-200 text-sm mt-1">Invito alla famiglia</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Invite info */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-1">
            <p className="text-blue-800 font-semibold text-sm">{invite?.familyName}</p>
            <p className="text-blue-700 text-xs">
              Ruolo assegnato: <strong>{roleLabels[invite?.role || ''] || invite?.role}</strong>
            </p>
            <p className="text-blue-600 text-xs">{roleDescriptions[invite?.role || '']}</p>
          </div>

          <p className="text-gray-600 text-sm text-center">
            Invito per <strong>{invite?.email}</strong>
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Toggle: new or existing */}
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setExistingUser(false)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${existingUser === false ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              Nuovo account
            </button>
            <button
              onClick={() => setExistingUser(true)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${existingUser === true ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              Ho già un account
            </button>
          </div>

          {existingUser === false && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Il tuo nome *</label>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Nome Cognome"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Scegli una password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimo 6 caratteri"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleRegisterNew}
                disabled={submitting || !fullName.trim() || password.length < 6}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrazione…</> : 'Crea account e accetta invito'}
              </button>
            </div>
          )}

          {existingUser === true && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 text-center">Inserisci la password del tuo account <strong>{invite?.email}</strong></p>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="La tua password"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={handleAcceptExisting}
                disabled={submitting || !password}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Accesso…</> : 'Accedi e accetta invito'}
              </button>
            </div>
          )}

          {existingUser === null && (
            <p className="text-xs text-gray-400 text-center">Seleziona un'opzione sopra per continuare</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusCard({ icon, title, desc, color, action }: {
  icon: string; title: string; desc: string; color: 'red' | 'yellow' | 'green'
  action?: { label: string; onClick: () => void }
}) {
  const colors = {
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center border ${colors[color]}`}>
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <p className="text-sm opacity-80">{desc}</p>
        {action && (
          <button onClick={action.onClick}
            className="mt-5 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
