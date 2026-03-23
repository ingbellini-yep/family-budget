import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type UserRole = 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'

export const ALL_SECTIONS = ['dashboard', 'transactions', 'budget', 'accounts', 'recurring', 'goals', 'settings'] as const
export type AppSection = typeof ALL_SECTIONS[number]

export interface Profile {
  id: string
  email: string
  full_name: string | null
  family_id: string | null
  role: UserRole
  allowed_sections: string[] | null
  pocket_money_limit: number | null
  created_at?: string
}

interface AuthState {
  user: any | null
  profile: Profile | null
  loading: boolean
  setUser: (user: any | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
  // Role helpers
  isAdmin: () => boolean
  canWrite: () => boolean
  canAccessSection: (section: AppSection) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  },

  signUp: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })
    if (!error && data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        family_id: null,
        role: 'admin',
      })
    }
    return { error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  loadProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ loading: false }); return }
    set({ user })
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    set({ profile: profile ? { ...profile, role: profile.role || 'admin' } : null, loading: false })
  },

  isAdmin: () => get().profile?.role === 'admin',

  canWrite: () => {
    const role = get().profile?.role
    return role === 'admin' || role === 'editor'
  },

  canAccessSection: (section: AppSection) => {
    const p = get().profile
    if (!p) return false
    const role = p.role || 'admin'
    // readonly: only dashboard
    if (role === 'readonly') return section === 'dashboard'
    // dependent: dashboard + transactions (own) + goals
    if (role === 'dependent') return ['dashboard', 'transactions', 'goals'].includes(section)
    // viewer: no settings write, but can see all sections except settings
    if (role === 'viewer') return section !== 'settings' || section === 'settings'
    // If allowed_sections is set, check it (for 'editor' or custom)
    if (p.allowed_sections && p.allowed_sections.length > 0) {
      return p.allowed_sections.includes(section)
    }
    // admin/editor: full access
    return true
  },
}))
