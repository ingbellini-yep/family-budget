import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { useEffect, useState } from 'react'
import { LayoutDashboard, ArrowLeftRight, PieChart, Wallet, Settings, LogOut, Menu, X, RefreshCw, Target } from 'lucide-react'
import { cn } from '../lib/utils'

const ALL_NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',    section: 'dashboard'    as const },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Transazioni',  section: 'transactions' as const },
  { to: '/budget',       icon: PieChart,        label: 'Budget',       section: 'budget'       as const },
  { to: '/accounts',     icon: Wallet,          label: 'Conti',        section: 'accounts'     as const },
  { to: '/recurring',    icon: RefreshCw,       label: 'Ricorrenti',   section: 'recurring'    as const },
  { to: '/goals',        icon: Target,          label: 'Obiettivi',    section: 'goals'        as const },
  { to: '/settings',     icon: Settings,        label: 'Impostazioni', section: 'settings'     as const },
]

export default function Layout() {
  const { profile, signOut, canAccessSection } = useAuthStore()
  const { loadAll } = useAppStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Filter nav items by role
  const navItems = ALL_NAV_ITEMS.filter(item => canAccessSection(item.section))

  useEffect(() => {
    if (profile?.family_id) {
      loadAll(profile.family_id)
    } else if (profile && !profile.family_id) {
      navigate('/setup')
    }
  }, [profile?.family_id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const roleBadge = () => {
    const role = profile?.role
    if (!role || role === 'admin') return null
    const map: Record<string, { label: string; color: string }> = {
      editor:    { label: 'Editor',     color: 'bg-purple-100 text-purple-700' },
      viewer:    { label: 'Viewer',     color: 'bg-gray-100 text-gray-600' },
      readonly:  { label: 'Readonly',   color: 'bg-slate-100 text-slate-600' },
      dependent: { label: 'Dipendente', color: 'bg-orange-100 text-orange-700' },
    }
    const m = map[role]
    if (!m) return null
    return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.color}`}>{m.label}</span>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200 shadow-sm">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary">💰 FamilyBudget</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground truncate">{profile?.full_name || profile?.email}</p>
            {roleBadge()}
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100')
            }>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-primary">💰 FamilyBudget</h1>
          {roleBadge()}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-white p-4 space-y-1 pt-16" onClick={e => e.stopPropagation()}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100')
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors mt-4"
            >
              <LogOut className="h-4 w-4" />
              Esci
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav — show up to 4 accessible items */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex">
        {navItems.slice(0, 4).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            cn('flex-1 flex flex-col items-center py-2 text-xs', isActive ? 'text-primary' : 'text-gray-500')
          }>
            <Icon className="h-5 w-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
