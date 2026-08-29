import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

// Normalize a transaction description for use as a learned-mapping key.
// Lowercases, collapses whitespace, and strips trailing digits/dates so that
// "PAGAMENTO POS 15/07 ESSELUNGA" and "PAGAMENTO POS 03/08 ESSELUNGA" both
// map to the same key.
export function normalizeDescriptionKey(desc: string): string {
  return desc.trim().toLowerCase().replace(/\s+/g, ' ')
}
