export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          family_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          family_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          family_id?: string | null
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          family_id: string
          name: string
          type: 'corrente' | 'carta' | 'investimento' | 'risparmio'
          bank_name: string | null
          color: string | null
          icon: string | null
          balance: number
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          type: 'corrente' | 'carta' | 'investimento' | 'risparmio'
          bank_name?: string | null
          color?: string | null
          icon?: string | null
          balance?: number
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          type?: 'corrente' | 'carta' | 'investimento' | 'risparmio'
          bank_name?: string | null
          color?: string | null
          icon?: string | null
          balance?: number
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          family_id: string
          name: string
          type: 'entrata' | 'uscita' | 'risparmio'
          color: string | null
          icon: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          type: 'entrata' | 'uscita' | 'risparmio'
          color?: string | null
          icon?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          type?: 'entrata' | 'uscita' | 'risparmio'
          color?: string | null
          icon?: string | null
          is_default?: boolean
          created_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          family_id: string
          category_id: string
          account_id: string | null
          year: number
          month: number | null
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          category_id: string
          account_id?: string | null
          year: number
          month?: number | null
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          category_id?: string
          account_id?: string | null
          year?: number
          month?: number | null
          amount?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          family_id: string
          account_id: string
          category_id: string
          date: string
          amount: number
          type: 'entrata' | 'uscita'
          description: string
          original_description: string | null
          note: string | null
          source: 'manuale' | 'pdf' | 'screenshot' | 'csv'
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          account_id: string
          category_id: string
          date: string
          amount: number
          type: 'entrata' | 'uscita'
          description: string
          original_description?: string | null
          note?: string | null
          source?: 'manuale' | 'pdf' | 'screenshot' | 'csv'
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          account_id?: string
          category_id?: string
          date?: string
          amount?: number
          type?: 'entrata' | 'uscita'
          description?: string
          original_description?: string | null
          note?: string | null
          source?: 'manuale' | 'pdf' | 'screenshot' | 'csv'
          created_by?: string
          created_at?: string
        }
      }
      recurring_expenses: {
        Row: {
          id: string
          family_id: string
          account_id: string
          category_id: string
          name: string
          amount: number
          frequency: 'mensile' | 'annuale' | 'settimanale'
          due_day: number
          next_due_date: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          account_id: string
          category_id: string
          name: string
          amount: number
          frequency: 'mensile' | 'annuale' | 'settimanale'
          due_day: number
          next_due_date: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          account_id?: string
          category_id?: string
          name?: string
          amount?: number
          frequency?: 'mensile' | 'annuale' | 'settimanale'
          due_day?: number
          next_due_date?: string
          active?: boolean
          created_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          family_id: string
          name: string
          target_amount: number
          current_amount: number
          target_date: string | null
          color: string | null
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          target_amount: number
          current_amount?: number
          target_date?: string | null
          color?: string | null
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          color?: string | null
          icon?: string | null
          created_at?: string
        }
      }
      import_logs: {
        Row: {
          id: string
          family_id: string
          user_id: string
          source_type: 'pdf' | 'screenshot' | 'csv'
          bank_name: string | null
          file_name: string | null
          status: 'pending' | 'completed' | 'failed'
          transactions_imported: number
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          source_type: 'pdf' | 'screenshot' | 'csv'
          bank_name?: string | null
          file_name?: string | null
          status?: 'pending' | 'completed' | 'failed'
          transactions_imported?: number
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          source_type?: 'pdf' | 'screenshot' | 'csv'
          bank_name?: string | null
          file_name?: string | null
          status?: 'pending' | 'completed' | 'failed'
          transactions_imported?: number
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
