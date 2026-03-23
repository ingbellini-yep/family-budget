export type Database = {
  public: {
    Tables: {
      families: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      profiles: {
        Row: { id: string; email: string; full_name: string | null; family_id: string | null; created_at: string }
        Insert: { id: string; email: string; full_name?: string | null; family_id?: string | null; created_at?: string }
        Update: { id?: string; email?: string; full_name?: string | null; family_id?: string | null; created_at?: string }
        Relationships: []
      }
      accounts: {
        Row: { id: string; family_id: string; name: string; type: 'corrente' | 'carta' | 'investimento' | 'risparmio'; bank_name: string | null; color: string | null; icon: string | null; balance: number; owner: string; initial_balance: number; active: boolean; notes: string | null; is_default: boolean; created_at: string }
        Insert: { id?: string; family_id: string; name: string; type: 'corrente' | 'carta' | 'investimento' | 'risparmio'; bank_name?: string | null; color?: string | null; icon?: string | null; balance?: number; owner?: string; initial_balance?: number; active?: boolean; notes?: string | null; is_default?: boolean; created_at?: string }
        Update: { id?: string; family_id?: string; name?: string; type?: 'corrente' | 'carta' | 'investimento' | 'risparmio'; bank_name?: string | null; color?: string | null; icon?: string | null; balance?: number; owner?: string; initial_balance?: number; active?: boolean; notes?: string | null; is_default?: boolean; created_at?: string }
        Relationships: []
      }
      categories: {
        Row: { id: string; family_id: string; name: string; type: 'entrata' | 'uscita' | 'risparmio'; color: string | null; icon: string | null; is_default: boolean; created_at: string }
        Insert: { id?: string; family_id: string; name: string; type: 'entrata' | 'uscita' | 'risparmio'; color?: string | null; icon?: string | null; is_default?: boolean; created_at?: string }
        Update: { id?: string; family_id?: string; name?: string; type?: 'entrata' | 'uscita' | 'risparmio'; color?: string | null; icon?: string | null; is_default?: boolean; created_at?: string }
        Relationships: []
      }
      budgets: {
        Row: { id: string; family_id: string; category_id: string; account_id: string | null; year: number; month: number | null; amount: number; created_at: string }
        Insert: { id?: string; family_id: string; category_id: string; account_id?: string | null; year: number; month?: number | null; amount: number; created_at?: string }
        Update: { id?: string; family_id?: string; category_id?: string; account_id?: string | null; year?: number; month?: number | null; amount?: number; created_at?: string }
        Relationships: []
      }
      transactions: {
        Row: { id: string; family_id: string; account_id: string; category_id: string; budget_category_id: string | null; date: string; amount: number; type: 'entrata' | 'uscita'; description: string; original_description: string | null; note: string | null; source: 'manuale' | 'pdf' | 'screenshot' | 'csv'; created_by: string; created_at: string }
        Insert: { id?: string; family_id: string; account_id: string; category_id: string; budget_category_id?: string | null; date: string; amount: number; type: 'entrata' | 'uscita'; description: string; original_description?: string | null; note?: string | null; source?: 'manuale' | 'pdf' | 'screenshot' | 'csv'; created_by: string; created_at?: string }
        Update: { id?: string; family_id?: string; account_id?: string; category_id?: string; budget_category_id?: string | null; date?: string; amount?: number; type?: 'entrata' | 'uscita'; description?: string; original_description?: string | null; note?: string | null; source?: 'manuale' | 'pdf' | 'screenshot' | 'csv'; created_by?: string; created_at?: string }
        Relationships: []
      }
      recurring_expenses: {
        Row: { id: string; family_id: string; account_id: string; category_id: string; name: string; amount: number; frequency: 'mensile' | 'annuale' | 'settimanale'; due_day: number; next_due_date: string; active: boolean; created_at: string }
        Insert: { id?: string; family_id: string; account_id: string; category_id: string; name: string; amount: number; frequency: 'mensile' | 'annuale' | 'settimanale'; due_day: number; next_due_date: string; active?: boolean; created_at?: string }
        Update: { id?: string; family_id?: string; account_id?: string; category_id?: string; name?: string; amount?: number; frequency?: 'mensile' | 'annuale' | 'settimanale'; due_day?: number; next_due_date?: string; active?: boolean; created_at?: string }
        Relationships: []
      }
      savings_goals: {
        Row: { id: string; family_id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; color: string | null; icon: string | null; created_at: string }
        Insert: { id?: string; family_id: string; name: string; target_amount: number; current_amount?: number; target_date?: string | null; color?: string | null; icon?: string | null; created_at?: string }
        Update: { id?: string; family_id?: string; name?: string; target_amount?: number; current_amount?: number; target_date?: string | null; color?: string | null; icon?: string | null; created_at?: string }
        Relationships: []
      }
      import_logs: {
        Row: { id: string; family_id: string; user_id: string; source_type: 'pdf' | 'screenshot' | 'csv'; bank_name: string | null; file_name: string | null; status: 'pending' | 'completed' | 'failed'; transactions_imported: number; created_at: string }
        Insert: { id?: string; family_id: string; user_id: string; source_type: 'pdf' | 'screenshot' | 'csv'; bank_name?: string | null; file_name?: string | null; status?: 'pending' | 'completed' | 'failed'; transactions_imported?: number; created_at?: string }
        Update: { id?: string; family_id?: string; user_id?: string; source_type?: 'pdf' | 'screenshot' | 'csv'; bank_name?: string | null; file_name?: string | null; status?: 'pending' | 'completed' | 'failed'; transactions_imported?: number; created_at?: string }
        Relationships: []
      }
      budget_categories: {
        Row: { id: string; family_id: string; name: string; icon: string | null; color: string | null; sort_order: number; is_default: boolean; active: boolean; created_at: string }
        Insert: { id?: string; family_id: string; name: string; icon?: string | null; color?: string | null; sort_order?: number; is_default?: boolean; active?: boolean; created_at?: string }
        Update: { id?: string; family_id?: string; name?: string; icon?: string | null; color?: string | null; sort_order?: number; is_default?: boolean; active?: boolean; created_at?: string }
        Relationships: []
      }
      budget_items: {
        Row: { id: string; family_id: string; budget_category_id: string | null; planned_account_id: string | null; year: number; type: 'income' | 'expense' | 'saving_goal'; description: string; recurrence: 'weekly' | 'monthly' | 'annual' | 'once' | 'quarterly'; recurrence_month: number | null; recurrence_day: number | null; recurrence_date: string | null; amount: number; is_variable: boolean; notes: string | null; active: boolean; target_amount: number | null; target_date: string | null; account_id: string | null; created_at: string }
        Insert: { id?: string; family_id: string; budget_category_id?: string | null; planned_account_id?: string | null; year: number; type: 'income' | 'expense' | 'saving_goal'; description: string; recurrence: 'weekly' | 'monthly' | 'annual' | 'once' | 'quarterly'; recurrence_month?: number | null; recurrence_day?: number | null; recurrence_date?: string | null; amount: number; is_variable?: boolean; notes?: string | null; active?: boolean; target_amount?: number | null; target_date?: string | null; account_id?: string | null; created_at?: string }
        Update: { id?: string; family_id?: string; budget_category_id?: string | null; planned_account_id?: string | null; year?: number; type?: 'income' | 'expense' | 'saving_goal'; description?: string; recurrence?: 'weekly' | 'monthly' | 'annual' | 'once' | 'quarterly'; recurrence_month?: number | null; recurrence_day?: number | null; recurrence_date?: string | null; amount?: number; is_variable?: boolean; notes?: string | null; active?: boolean; target_amount?: number | null; target_date?: string | null; account_id?: string | null; created_at?: string }
        Relationships: []
      }
      category_budget_mapping: {
        Row: { id: string; family_id: string; transaction_category_id: string; budget_category_id: string }
        Insert: { id?: string; family_id: string; transaction_category_id: string; budget_category_id: string }
        Update: { id?: string; family_id?: string; transaction_category_id?: string; budget_category_id?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
