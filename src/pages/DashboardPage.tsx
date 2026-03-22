import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

export default function DashboardPage() {
  const { transactions, categories, budgets, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, loadTransactions } = useAppStore()
  const { profile } = useAuthStore()
  const [historicalData, setHistoricalData] = useState<any[]>([])

  // Summary for selected month
  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'entrata').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'uscita').reduce((s, t) => s + t.amount, 0)
    const balance = income - expenses
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0
    return { income, expenses, balance, savingsRate }
  }, [transactions])

  // Budget status per category
  const budgetStatus = useMemo(() => {
    const expenseCategories = categories.filter(c => c.type === 'uscita')
    return expenseCategories.map(cat => {
      const catBudget = budgets.find(b => b.category_id === cat.id && (b.month === selectedMonth || b.month === null))
      const spent = transactions
        .filter(t => t.type === 'uscita' && t.category_id === cat.id)
        .reduce((s, t) => s + t.amount, 0)
      const budgeted = catBudget?.amount || 0
      const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0
      const status = percentage >= 100 ? 'red' : percentage >= 80 ? 'yellow' : 'green'
      return { categoryId: cat.id, categoryName: cat.name, color: cat.color || '#94a3b8', budgeted, spent, remaining: budgeted - spent, percentage, status }
    }).filter(b => b.budgeted > 0 || b.spent > 0)
  }, [categories, budgets, transactions, selectedMonth])

  // Pie chart data
  const pieData = useMemo(() => {
    const byCat: Record<string, { name: string; value: number; color: string }> = {}
    transactions.filter(t => t.type === 'uscita').forEach(t => {
      const cat = categories.find(c => c.id === t.category_id)
      if (!cat) return
      if (!byCat[cat.id]) byCat[cat.id] = { name: cat.name, value: 0, color: cat.color || '#94a3b8' }
      byCat[cat.id].value += t.amount
    })
    return Object.values(byCat).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [transactions, categories])

  // Load historical data (last 12 months)
  useEffect(() => {
    if (!profile?.family_id) return
    const loadHistorical = async () => {
      const results = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(selectedYear, selectedMonth - 1 - i, 1)
        const y = d.getFullYear()
        const m = d.getMonth() + 1
        const startDate = `${y}-${String(m).padStart(2, '0')}-01`
        const endDate = new Date(y, m, 0).toISOString().split('T')[0]
        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('family_id', profile.family_id)
          .gte('date', startDate)
          .lte('date', endDate)
        const income = (data || []).filter(t => t.type === 'entrata').reduce((s: number, t: any) => s + t.amount, 0)
        const expenses = (data || []).filter(t => t.type === 'uscita').reduce((s: number, t: any) => s + t.amount, 0)
        results.push({ month: MONTHS_IT[m - 1], income, expenses, balance: income - expenses })
      }
      setHistoricalData(results)
    }
    loadHistorical()
  }, [profile?.family_id, selectedMonth, selectedYear])

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1) }
    else setSelectedMonth(selectedMonth - 1)
    if (profile?.family_id) loadTransactions(profile.family_id, selectedMonth === 1 ? selectedYear - 1 : selectedYear, selectedMonth === 1 ? 12 : selectedMonth - 1)
  }

  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1) }
    else setSelectedMonth(selectedMonth + 1)
    if (profile?.family_id) loadTransactions(profile.family_id, selectedMonth === 12 ? selectedYear + 1 : selectedYear, selectedMonth === 12 ? 1 : selectedMonth + 1)
  }

  const statusColors = { green: 'bg-green-100 text-green-700', yellow: 'bg-yellow-100 text-yellow-700', red: 'bg-red-100 text-red-700' }
  const barStatusColors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Panoramica finanziaria</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm">
          <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Entrate</span>
          </div>
          <div className="text-xl font-bold text-green-600">{formatCurrency(summary.income)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Uscite</span>
          </div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(summary.expenses)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Saldo</span>
          </div>
          <div className={`text-xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(summary.balance)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Risparmio</span>
          </div>
          <div className="text-xl font-bold text-purple-600">{summary.savingsRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Budget Status */}
      {budgetStatus.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h2 className="text-base font-semibold mb-4">Stato Budget</h2>
          <div className="space-y-3">
            {budgetStatus.map(b => (
              <div key={b.categoryId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.color }}></div>
                    <span className="text-sm text-gray-700">{b.categoryName}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColors[b.status]}`}>
                      {b.status === 'green' ? 'OK' : b.status === 'yellow' ? 'Attenzione' : 'Sforato'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barStatusColors[b.status]}`}
                    style={{ width: `${Math.min(b.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bar chart: income vs expenses */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h2 className="text-base font-semibold mb-4">Entrate vs Uscite (12 mesi)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={historicalData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="income" name="Entrate" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Uscite" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: expenses by category */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h2 className="text-base font-semibold mb-4">Uscite per Categoria</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="40%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              Nessuna uscita questo mese
            </div>
          )}
        </div>

        {/* Line chart: balance trend */}
        <div className="bg-white rounded-xl p-4 shadow-sm border md:col-span-2">
          <h2 className="text-base font-semibold mb-4">Andamento Saldo (12 mesi)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historicalData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="balance" name="Saldo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
