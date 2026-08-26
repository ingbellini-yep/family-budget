import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AppState {
  accounts: any[]
  categories: any[]
  transactions: any[]
  budgets: any[]
  recurringExpenses: any[]
  savingsGoals: any[]
  // Budget REV02
  budgetCategories: any[]
  budgetItems: any[]
  categoryBudgetMappings: any[]
  yearTransactions: any[]
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
  bulkDeleteTransactions: (filter: { familyId: string; dateFrom?: string; dateTo?: string; accountId?: string; all?: boolean }) => Promise<{ error: any; count?: number }>
  bulkUpdateTransactions: (ids: string[], updates: Record<string, any>) => Promise<{ error: any }>
  // Budget REV02
  loadBudgetCategories: (familyId: string) => Promise<void>
  loadBudgetItems: (familyId: string, year: number) => Promise<void>
  loadCategoryBudgetMappings: (familyId: string) => Promise<void>
  loadYearTransactions: (familyId: string, year: number) => Promise<void>
  addBudgetItem: (item: any) => Promise<{ error: any; data?: any }>
  updateBudgetItem: (id: string, updates: any) => Promise<{ error: any }>
  deleteBudgetItem: (id: string) => Promise<{ error: any }>
  addBudgetCategory: (cat: any) => Promise<{ error: any; data?: any }>
  updateBudgetCategory: (id: string, updates: any) => Promise<{ error: any }>
  deleteBudgetCategory: (id: string) => Promise<{ error: any }>
  saveCategoryBudgetMapping: (familyId: string, txCategoryId: string, budgetCategoryId: string | null) => Promise<{ error: any }>
}

const now = new Date()

export const useAppStore = create<AppState>((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  recurringExpenses: [],
  savingsGoals: [],
  budgetCategories: [],
  budgetItems: [],
  categoryBudgetMappings: [],
  yearTransactions: [],
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
      get().loadBudgetCategories(familyId),
      get().loadCategoryBudgetMappings(familyId),
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
  },

  bulkUpdateTransactions: async (ids, updates) => {
    const { error } = await supabase.from('transactions').update(updates).in('id', ids)
    if (!error) {
      set(state => ({
        transactions: state.transactions.map(t => ids.includes(t.id) ? { ...t, ...updates } : t),
      }))
    }
    return { error }
  },

  bulkDeleteTransactions: async ({ familyId, dateFrom, dateTo, accountId, all }) => {
    if (!accountId && !all && !(dateFrom && dateTo)) {
      return { error: new Error('Nessun filtro specificato') }
    }
    let query = supabase.from('transactions').delete().eq('family_id', familyId)
    if (accountId) query = query.eq('account_id', accountId)
    else if (dateFrom && dateTo) query = query.gte('date', dateFrom).lte('date', dateTo)
    const { error } = await query
    if (!error) {
      const { selectedYear, selectedMonth } = get()
      await get().loadTransactions(familyId, selectedYear, selectedMonth)
    }
    return { error }
  },

  // ── Budget REV02 ──────────────────────────────────────────

  loadBudgetCategories: async (familyId) => {
    const { data } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('family_id', familyId)
      .order('sort_order')
    set({ budgetCategories: data || [] })
  },

  loadBudgetItems: async (familyId, year) => {
    const { data } = await supabase
      .from('budget_items')
      .select('*')
      .eq('family_id', familyId)
      .eq('year', year)
      .order('created_at')
    set({ budgetItems: data || [] })
  },

  loadCategoryBudgetMappings: async (familyId) => {
    const { data } = await supabase
      .from('category_budget_mapping')
      .select('*')
      .eq('family_id', familyId)
    set({ categoryBudgetMappings: data || [] })
  },

  loadYearTransactions: async (familyId, year) => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('family_id', familyId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date', { ascending: false })
    set({ yearTransactions: data || [] })
  },

  addBudgetItem: async (item) => {
    const { data, error } = await supabase.from('budget_items').insert(item).select().single()
    return { error, data }
  },

  updateBudgetItem: async (id, updates) => {
    const { error } = await supabase.from('budget_items').update(updates).eq('id', id)
    return { error }
  },

  deleteBudgetItem: async (id) => {
    const { error } = await supabase.from('budget_items').delete().eq('id', id)
    if (!error) {
      set(state => ({ budgetItems: state.budgetItems.filter(i => i.id !== id) }))
    }
    return { error }
  },

  addBudgetCategory: async (cat) => {
    const { data, error } = await supabase.from('budget_categories').insert(cat).select().single()
    return { error, data }
  },

  updateBudgetCategory: async (id, updates) => {
    const { error } = await supabase.from('budget_categories').update(updates).eq('id', id)
    return { error }
  },

  deleteBudgetCategory: async (id) => {
    const { error } = await supabase.from('budget_categories').delete().eq('id', id)
    if (!error) {
      set(state => ({ budgetCategories: state.budgetCategories.filter(c => c.id !== id) }))
    }
    return { error }
  },

  saveCategoryBudgetMapping: async (familyId, txCategoryId, budgetCategoryId) => {
    if (!budgetCategoryId) {
      const { error } = await supabase
        .from('category_budget_mapping')
        .delete()
        .eq('family_id', familyId)
        .eq('transaction_category_id', txCategoryId)
      return { error }
    }
    const { error } = await supabase
      .from('category_budget_mapping')
      .upsert({ family_id: familyId, transaction_category_id: txCategoryId, budget_category_id: budgetCategoryId },
               { onConflict: 'family_id,transaction_category_id' })
    return { error }
  },
}))
