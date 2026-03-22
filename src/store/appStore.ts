import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AppState {
  accounts: any[]
  categories: any[]
  transactions: any[]
  budgets: any[]
  recurringExpenses: any[]
  savingsGoals: any[]
  selectedMonth: number
  selectedYear: number
  loading: boolean

  setSelectedMonth: (month: number) => void
  setSelectedYear: (year: number) => void
  loadAccounts: (familyId: string) => Promise<void>
  loadCategories: (familyId: string) => Promise<void>
  loadTransactions: (familyId: string, year: number, month: number) => Promise<void>
  loadBudgets: (familyId: string, year: number) => Promise<void>
  loadRecurringExpenses: (familyId: string) => Promise<void>
  loadSavingsGoals: (familyId: string) => Promise<void>
  loadAll: (familyId: string) => Promise<void>
  addTransaction: (tx: any) => Promise<{ error: any }>
  deleteTransaction: (id: string) => Promise<{ error: any }>
  updateTransaction: (id: string, updates: any) => Promise<{ error: any }>
}

const now = new Date()

export const useAppStore = create<AppState>((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  recurringExpenses: [],
  savingsGoals: [],
  selectedMonth: now.getMonth() + 1,
  selectedYear: now.getFullYear(),
  loading: false,

  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setSelectedYear: (year) => set({ selectedYear: year }),

  loadAccounts: async (familyId) => {
    const { data } = await supabase.from('accounts').select('*').eq('family_id', familyId).order('name')
    set({ accounts: data || [] })
  },

  loadCategories: async (familyId) => {
    const { data } = await supabase.from('categories').select('*').eq('family_id', familyId).order('name')
    set({ categories: data || [] })
  },

  loadTransactions: async (familyId, year, month) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('family_id', familyId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
    set({ transactions: data || [] })
  },

  loadBudgets: async (familyId, year) => {
    const { data } = await supabase.from('budgets').select('*').eq('family_id', familyId).eq('year', year)
    set({ budgets: data || [] })
  },

  loadRecurringExpenses: async (familyId) => {
    const { data } = await supabase.from('recurring_expenses').select('*').eq('family_id', familyId).eq('active', true)
    set({ recurringExpenses: data || [] })
  },

  loadSavingsGoals: async (familyId) => {
    const { data } = await supabase.from('savings_goals').select('*').eq('family_id', familyId)
    set({ savingsGoals: data || [] })
  },

  loadAll: async (familyId) => {
    set({ loading: true })
    const { selectedYear, selectedMonth } = get()
    await Promise.all([
      get().loadAccounts(familyId),
      get().loadCategories(familyId),
      get().loadTransactions(familyId, selectedYear, selectedMonth),
      get().loadBudgets(familyId, selectedYear),
      get().loadRecurringExpenses(familyId),
      get().loadSavingsGoals(familyId),
    ])
    set({ loading: false })
  },

  addTransaction: async (tx) => {
    const { data, error } = await supabase.from('transactions').insert(tx).select().single()
    if (!error && data) {
      set(state => ({ transactions: [data, ...state.transactions] }))
    }
    return { error }
  },

  deleteTransaction: async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      set(state => ({ transactions: state.transactions.filter(t => t.id !== id) }))
    }
    return { error }
  },

  updateTransaction: async (id, updates) => {
    const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single()
    if (!error && data) {
      set(state => ({ transactions: state.transactions.map(t => t.id === id ? data : t) }))
    }
    return { error }
  }
}))
