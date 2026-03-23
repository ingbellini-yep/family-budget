import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import BudgetPage from './pages/BudgetPage'
import AccountsPage from './pages/AccountsPage'
import SettingsPage from './pages/SettingsPage'
import RecurringPage from './pages/RecurringPage'
import GoalsPage from './pages/GoalsPage'
import InvitePage from './pages/InvitePage'
import Layout from './components/Layout'
import SetupFamilyPage from './pages/SetupFamilyPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  const { loadProfile, setUser, setLoading } = useAuthStore()
  // Tracks whether the initial session check has completed
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    // Step 1: getSession() is local (reads from storage) — never hangs
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Load profile from DB separately; loading flag is cleared inside loadProfile
        loadProfile()
      } else {
        setLoading(false)
      }
      setSessionChecked(true)
    })

    // Step 2: keep in sync with auth events (login, token refresh, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile()
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Don't render routes at all until we know the session state
  if (!sessionChecked) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/invite" element={<InvitePage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="setup" element={<SetupFamilyPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="recurring" element={<RecurringPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
