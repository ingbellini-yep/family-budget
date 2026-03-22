import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, X, Copy, Check } from 'lucide-react'

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#16a34a',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#94a3b8',
]

export default function SettingsPage() {
  const { profile, loadProfile } = useAuthStore()
  const { categories, loadCategories } = useAppStore()
  const [familyName, setFamilyName] = useState('')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [claudeApiKey, setClaudeApiKey] = useState(() => localStorage.getItem('claude_api_key') || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingFamily, setSavingFamily] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<any | null>(null)
  const [catName, setCatName] = useState('')
  const [catType, setCatType] = useState<'entrata' | 'uscita' | 'risparmio'>('uscita')
  const [catColor, setCatColor] = useState('#3b82f6')
  const [savingCat, setSavingCat] = useState(false)
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)

  useEffect(() => {
    if (profile?.family_id) {
      supabase.from('families').select('name').eq('id', profile.family_id).single().then(({ data }) => {
        if (data) setFamilyName(data.name)
      })
    }
  }, [profile?.family_id])

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

  const openAddCat = () => {
    setEditingCat(null)
    setCatName('')
    setCatType('uscita')
    setCatColor('#3b82f6')
    setShowCatModal(true)
  }

  const openEditCat = (cat: any) => {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatType(cat.type)
    setCatColor(cat.color || '#3b82f6')
    setShowCatModal(true)
  }

  const handleSaveCat = async () => {
    if (!catName.trim() || !profile?.family_id) return
    setSavingCat(true)
    if (editingCat) {
      await supabase.from('categories').update({ name: catName, type: catType, color: catColor }).eq('id', editingCat.id)
    } else {
      await supabase.from('categories').insert({
        family_id: profile.family_id,
        name: catName,
        type: catType,
        color: catColor,
        is_default: false,
        icon: null,
      })
    }
    await loadCategories(profile.family_id)
    setSavingCat(false)
    setShowCatModal(false)
  }

  const handleDeleteCat = async (id: string) => {
    if (!profile?.family_id) return
    if (!confirm('Eliminare questa categoria? Le transazioni associate non verranno eliminate.')) return
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

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Impostazioni</h1>

      {/* Profile section */}
      <div className="bg-white rounded-xl border shadow-sm p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Profilo</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700">Nome completo</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Email</label>
            <input
              value={profile?.email || ''}
              disabled
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {profileSaved ? <><Check className="h-4 w-4" /> Salvato!</> : savingProfile ? 'Salvataggio...' : 'Salva profilo'}
          </button>
        </div>
      </div>

      {/* Claude API Key */}
      <div className="bg-white rounded-xl border shadow-sm p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Claude AI</h2>
        <p className="text-xs text-gray-500 mb-4">Usata per importare automaticamente transazioni da screenshot e PDF</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700">API Key Anthropic</label>
            <input
              type="password"
              value={claudeApiKey}
              onChange={e => setClaudeApiKey(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="sk-ant-..."
            />
          </div>
          <button
            onClick={handleSaveApiKey}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
          >
            {apiKeySaved ? <><Check className="h-4 w-4" /> Salvata!</> : 'Salva API Key'}
          </button>
          <p className="text-xs text-gray-400">La chiave viene salvata solo in localStorage, non sul server.</p>
        </div>
      </div>

      {/* Family section */}
      {profile?.family_id && (
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Famiglia</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Nome famiglia</label>
              <input
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              onClick={handleSaveFamily}
              disabled={savingFamily}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {savingFamily ? 'Salvataggio...' : 'Salva nome'}
            </button>

            <div className="border-t pt-3 mt-3">
              <label className="text-xs font-medium text-gray-700">Codice invito partner</label>
              <div className="flex gap-2 mt-1">
                <input
                  value={profile.family_id}
                  readOnly
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 text-gray-500"
                />
                <button
                  onClick={handleCopyFamilyId}
                  className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Condividi questo codice con il tuo partner per invitarlo</p>
            </div>
          </div>
        </div>
      )}

      {/* Categories management */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Categorie</h2>
          <button
            onClick={openAddCat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi
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
                    <button
                      onClick={() => openEditCat(cat)}
                      className="text-gray-400 hover:text-primary text-xs px-2 py-1 rounded hover:bg-blue-50"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteCat(cat.id)}
                      disabled={deletingCatId === cat.id}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {groupedCategories[type].length === 0 && (
                <p className="text-xs text-gray-400 px-3">Nessuna categoria</p>
              )}
            </div>
          </div>
        ))}
      </div>

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
                <input
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="es. Palestra"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Tipo</label>
                <select
                  value={catType}
                  onChange={e => setCatType(e.target.value as any)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="uscita">Uscita</option>
                  <option value="entrata">Entrata</option>
                  <option value="risparmio">Risparmio</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Colore</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${catColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCatModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annulla
              </button>
              <button
                onClick={handleSaveCat}
                disabled={savingCat || !catName.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {savingCat ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
