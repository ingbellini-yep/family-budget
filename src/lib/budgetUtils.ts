// ─── Budget utilities shared across BudgetPage and PDF export ──────────────

export type Recurrence = 'weekly' | 'monthly' | 'annual' | 'once' | 'quarterly'

export const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
export const MONTHS_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export function getMonthlyAmounts(item: any): number[] {
  const amounts = new Array(12).fill(0)
  if (!item.active) return amounts
  const amt = Number(item.amount)
  switch (item.recurrence as Recurrence) {
    case 'monthly': return new Array(12).fill(amt)
    case 'weekly':  return new Array(12).fill(Math.round(amt * 4.33 * 100) / 100)
    case 'annual':
      if (item.recurrence_month) amounts[item.recurrence_month - 1] = amt
      return amounts
    case 'once':
      if (item.recurrence_date) {
        const m = new Date(item.recurrence_date + 'T00:00:00').getMonth()
        amounts[m] = amt
      } else if (item.recurrence_month) {
        amounts[item.recurrence_month - 1] = amt
      }
      return amounts
    case 'quarterly': {
      const start = (item.recurrence_month ?? 1) - 1
      for (let i = 0; i < 4; i++) amounts[(start + i * 3) % 12] = amt
      return amounts
    }
    default: return amounts
  }
}

export function getAnnualAmount(item: any): number {
  return getMonthlyAmounts(item).reduce((s: number, a: number) => s + a, 0)
}

export function getRecurrenceLabel(item: any): string {
  const labels: Record<Recurrence, string> = {
    monthly: 'Mensile', weekly: 'Settimanale', annual: 'Annuale', once: 'Una tantum', quarterly: 'Trimestrale',
  }
  const base = labels[item.recurrence as Recurrence] || item.recurrence
  if (item.recurrence === 'annual' && item.recurrence_month)
    return `${base} (${MONTHS_IT[item.recurrence_month - 1]})`
  if (item.recurrence === 'quarterly' && item.recurrence_month)
    return `${base} (da ${MONTHS_IT[item.recurrence_month - 1]})`
  if (item.recurrence === 'once') {
    if (item.recurrence_date) {
      const d = new Date(item.recurrence_date + 'T00:00:00')
      return `${base} (${d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })})`
    }
    if (item.recurrence_month) return `${base} (${MONTHS_IT[item.recurrence_month - 1]})`
  }
  return base
}

export function getTransferAnnual(t: any): number {
  const amt = Number(t.amount)
  if (t.recurrence === 'monthly') return amt * 12
  if (t.recurrence === 'quarterly') return amt * 4
  return amt
}

export function fmtEur(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value)
}
