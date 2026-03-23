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
        Row: { id: string; email: string; full_name: string | null; family_id: string | null; role: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'; created_at: string }
        Insert: { id: string; email: string; full_name?: string | null; family_id?: string | null; role?: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'; created_at?: string }
        Update: { id?: string; email?: string; full_name?: string | null; family_id?: string | null; role?: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'; created_at?: string }
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
      planned_transfers: {
        Row: { id: string; family_id: string; from_account_id: string; to_account_id: string; amount: number; recurrence: 'monthly' | 'annual' | 'once' | 'quarterly'; recurrence_month: number | null; recurrence_date: string | null; description: string | null; year: number; active: boolean; created_at: string }
        Insert: { id?: string; family_id: string; from_account_id: string; to_account_id: string; amount: number; recurrence?: 'monthly' | 'annual' | 'once' | 'quarterly'; recurrence_month?: number | null; recurrence_date?: string | null; description?: string | null; year: number; active?: boolean; created_at?: string }
        Update: { id?: string; family_id?: string; from_account_id?: string; to_account_id?: string; amount?: number; recurrence?: 'monthly' | 'annual' | 'once' | 'quarterly'; recurrence_month?: number | null; recurrence_date?: string | null; description?: string | null; year?: number; active?: boolean; created_at?: string }
        Relationships: []
      }
      residual_distribution: {
        Row: { id: string; family_id: string; year: number; label: string; account_id: string | null; savings_goal_id: string | null; percentage: number; sort_order: number; created_at: string }
        Insert: { id?: string; family_id: string; year: number; label: string; account_id?: string | null; savings_goal_id?: string | null; percentage: number; sort_order?: number; created_at?: string }
        Update: { id?: string; family_id?: string; year?: number; label?: string; account_id?: string | null; savings_goal_id?: string | null; percentage?: number; sort_order?: number; created_at?: string }
        Relationships: []
      }
      family_invites: {
        Row: { id: string; family_id: string; invited_by: string; email: string; role: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'; token: string | null; status: 'pending' | 'accepted' | 'expired' | 'revoked'; created_at: string; expires_at: string | null; accepted_at: string | null }
        Insert: { id?: string; family_id: string; invited_by: string; email: string; role?: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'; token?: string | null; status?: 'pending' | 'accepted' | 'expired' | 'revoked'; created_at?: string; expires_at?: string | null; accepted_at?: string | null }
        Update: { id?: string; family_id?: string; invited_by?: string; email?: string; role?: 'admin' | 'editor' | 'viewer' | 'dependent' | 'readonly'; token?: string | null; status?: 'pending' | 'accepted' | 'expired' | 'revoked'; created_at?: string; expires_at?: string | null; accepted_at?: string | null }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
