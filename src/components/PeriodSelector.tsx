import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export default function PeriodSelector() {
  const {
    viewMode, setViewMode,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    customDateFrom, customDateTo, setCustomDates,
    reloadTransactions,
  } = useAppStore()
  const { profile } = useAuthStore()

  const [localFrom, setLocalFrom] = useState(customDateFrom || '')
  const [localTo, setLocalTo] = useState(customDateTo || '')

  const familyId = profile?.family_id

  const handleModeChange = (mode: 'month' | 'year' | 'custom') => {
    setViewMode(mode)
    if (mode !== 'custom' && familyId) {
      // set() is synchronous; reloadTransactions will see the new viewMode
      reloadTransactions(familyId)
    }
  }

  const prevMonth = () => {
    const newMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const newYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    if (familyId) reloadTransactions(familyId)
  }

  const nextMonth = () => {
    const newMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const newYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    if (familyId) reloadTransactions(familyId)
  }

  const prevYear = () => {
    setSelectedYear(selectedYear - 1)
    if (familyId) reloadTransactions(familyId)
  }

  const nextYear = () => {
    setSelectedYear(selectedYear + 1)
    if (familyId) reloadTransactions(familyId)
  }

  const applyCustom = () => {
    if (!localFrom || !localTo || localFrom > localTo) return
    setCustomDates(localFrom, localTo)
    if (familyId) reloadTransactions(familyId)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mode tabs */}
      <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
        {(['month', 'year', 'custom'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {mode === 'month' ? 'Mese' : mode === 'year' ? 'Anno' : 'Periodo'}
          </button>
        ))}
      </div>

      {/* Month navigator */}
      {viewMode === 'month' && (
        <div className="flex items-center gap-1 bg-white border rounded-xl px-2 py-1.5 shadow-sm">
          <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 p-0.5">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[130px] text-center">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 p-0.5">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Year navigator */}
      {viewMode === 'year' && (
        <div className="flex items-center gap-1 bg-white border rounded-xl px-2 py-1.5 shadow-sm">
          <button onClick={prevYear} className="text-gray-400 hover:text-gray-700 p-0.5">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[60px] text-center">{selectedYear}</span>
          <button onClick={nextYear} className="text-gray-400 hover:text-gray-700 p-0.5">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Custom date range */}
      {viewMode === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={localFrom}
            onChange={e => setLocalFrom(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={localTo}
            onChange={e => setLocalTo(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={applyCustom}
            disabled={!localFrom || !localTo || localFrom > localTo}
            className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Applica
          </button>
        </div>
      )}
    </div>
  )
}
