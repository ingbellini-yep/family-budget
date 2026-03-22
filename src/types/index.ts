export type { Database } from './database'

export type AccountType = 'corrente' | 'carta' | 'investimento' | 'risparmio'
export type CategoryType = 'entrata' | 'uscita' | 'risparmio'
export type TransactionType = 'entrata' | 'uscita'
export type TransactionSource = 'manuale' | 'pdf' | 'screenshot' | 'csv'
export type Frequency = 'mensile' | 'annuale' | 'settimanale'

export interface BudgetStatus {
  categoryId: string
  categoryName: string
  color: string
  budgeted: number
  spent: number
  remaining: number
  percentage: number
  status: 'green' | 'yellow' | 'red'
}
