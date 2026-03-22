import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Users, Plus, LogIn } from 'lucide-react'

const DEFAULT_CATEGORIES = [
  // Entrate
  { name: 'Stipendio', type: 'entrata' as const, color: '#22c55e', icon: '💼' },
  { name: 'Freelance', type: 'entrata' as const, color: '#16a34a', icon: '💻' },
  { name: 'Investimenti', type: 'entrata' as const, color: '#15803d', icon: '📈' },
  { name: 'Altro (entrata)', type: 'entrata' as const, color: '#86efac', icon: '➕' },
  // Spese fisse
  { name: 'Affitto / Mutuo', type: 'uscita' as const, color: '#ef4444', icon: '🏠' },
  { name: 'Utenze', type: 'uscita' as const, color: '#f97316', icon: '💡' },
  { name: 'Assicurazioni', type: 'uscita' as const, color: '#eab308', icon: '🛡️' },
  { name: 'Abbonamenti', type: 'uscita' as const, color: '#a855f7', icon: '📺' },
  { name: 'Telefono', type: 'uscita' as const, color: '#6366f1', icon: '📱' },
  // Spese variabili
  { name: 'Alimentari', type: 'uscita' as const, color: '#f59e0b', icon: '🛒' },
  { name: 'Ristoranti', type: 'uscita' as const, color: '#fb923c', icon: '🍽️' },
  { name: 'Trasporti', type: 'uscita' as const, color: '#38bdf8', icon: '🚗' },
  { name: 'Salute', type: 'uscita' as const, color: '#f43f5e', icon: '🏥' },
  { name: 'Abbigliamento', type: 'uscita' as const, color: '#ec4899', icon: '👗' },
  { name: 'Svago', type: 'uscita' as const, color: '#8b5cf6', icon: '🎮' },
  { name: 'Istruzione', type: 'uscita' as const, color: '#0ea5e9', icon: '📚' },
  { name: 'Cura personale', type: 'uscita' as const, color: '#d946ef', icon: '✂️' },
  { name: 'Regali', type: 'uscita' as const, color: '#e11d48', icon: '🎁' },
  { name: 'Altro (uscita)', type: 'uscita' as const, color: '#94a3b8', icon: '💸' },
  // Risparmio
  { name: 'Fondo emergenza', type: 'risparmio' as const, color: '#06b6d4', icon: '🏦' },
  { name: 'Vacanze', type: 'risparmio' as const, color: '#10b981', icon: '✈️' },
  { name: 'Pensione', type: 'risparmio' as const, color: '#6366f1', icon: '🏖️' },
  { name: 'Obiettivo generico', type: 'risparmio' as const, color: '#3b82f6', icon: '🎯' },
]

const DEFAULT_ACCOUNTS = [
  { name: 'Conto corrente', type: 'corrente' as const, color: '#3b82f6', balance: 0 },
  { name: 'Carta di credito', type: 'carta' as const, color: '#8b5cf6', balance: 0 },
]

export default function SetupFamilyPage() {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { profile, loadProfile } = useAuthStore()
  const navigate = useNavigate()

  const createFamily = async () => {
    if (!familyName.trim() || !profile) return
    setLoading(true)
    setError('')
    try {
      // Create family
      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: familyName.trim() })
        .select()
        .single()
      if (familyError) throw familyError

      // Update profile with family_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ family_id: family.id })
        .eq('id', profile.id)
      if (profileError) throw profileError

      // Seed default categories
      const categories = DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        family_id: family.id,
        is_default: true,
      }))
      await supabase.from('categories').insert(categories)

      // Seed default accounts
      const accounts = DEFAULT_ACCOUNTS.map(acc => ({
        ...acc,
        family_id: family.id,
        bank_name: null,
        icon: null,
      }))
      await supabase.from('accounts').insert(accounts)

      await loadProfile()
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Errore durante la creazione della famiglia')
    } finally {
      setLoading(false)
    }
  }

  const joinFamily = async () => {
    if (!inviteCode.trim() || !profile) return
    setLoading(true)
    setError('')
    try {
      // Verify family exists
      const { data: family, error: familyError } = await supabase
        .from('families')
        .select('id, name')
        .eq('id', inviteCode.trim())
        .single()
      if (familyError || !family) throw new Error('Codice famiglia non trovato')

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ family_id: family.id })
        .eq('id', profile.id)
      if (profileError) throw profileError

      await loadProfile()
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Errore durante il collegamento alla famiglia')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👨‍👩‍👧‍👦</div>
          <h1 className="text-3xl font-bold text-gray-900">Configura la famiglia</h1>
          <p className="text-gray-500 mt-1">Crea una nuova famiglia o unisciti a una esistente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {mode === 'choose' && (
            <div className="space-y-4">
              <button
                onClick={() => setMode('create')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-blue-50 transition-colors text-left"
              >
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Crea nuova famiglia</div>
                  <div className="text-sm text-gray-500">Inizia a tracciare il tuo budget familiare</div>
                </div>
              </button>

              <button
                onClick={() => setMode('join')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-blue-50 transition-colors text-left"
              >
                <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <LogIn className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Unisciti a una famiglia</div>
                  <div className="text-sm text-gray-500">Inserisci il codice d'invito del tuo partner</div>
                </div>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setMode('choose')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-lg font-semibold">Crea nuova famiglia</h2>
                  <p className="text-sm text-gray-500">Verranno create categorie e conti predefiniti</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Nome della famiglia</label>
                <input
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Famiglia Rossi"
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <strong>Verrà creato automaticamente:</strong>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>23 categorie predefinite (entrate, uscite, risparmio)</li>
                  <li>2 conti di esempio (corrente, carta di credito)</li>
                </ul>
              </div>

              <button
                onClick={createFamily}
                disabled={loading || !familyName.trim()}
                className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creazione in corso...' : 'Crea famiglia'}
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setMode('choose')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-lg font-semibold">Unisciti a una famiglia</h2>
                  <p className="text-sm text-gray-500">Chiedi il codice ID famiglia al tuo partner</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Codice famiglia (Family ID)</label>
                <input
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <p className="text-xs text-gray-400 mt-1">Puoi trovare il codice nelle Impostazioni della famiglia</p>
              </div>

              <button
                onClick={joinFamily}
                disabled={loading || !inviteCode.trim()}
                className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Connessione in corso...' : 'Unisciti alla famiglia'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400">
          <Users className="h-4 w-4" />
          <span>Benvenuto, {profile?.full_name}!</span>
        </div>
      </div>
    </div>
  )
}
