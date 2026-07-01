import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
  LogOut, Sun, Moon, Compass, SlidersHorizontal, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useUI } from '../../context/UIContext'
import {
  getNavForMode, getHomeForMode, hasManagement, normalizeRoles,
} from '../../router/navConfig'
import ISTLogo from '../ui/ISTLogo'
import UserAvatar from '../ui/UserAvatar'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
}

function NavIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name]
  return Icon ? <Icon size={18} strokeWidth={2} /> : null
}

const HOME_PATHS = new Set(['/student', '/coach', '/mental-coach', '/admin'])

const STATUS_COLORS: Record<string, string> = {
  active: '#46D39A',
  pending: '#7CBBD0',
  expired: '#F6C85F',
  blocked: '#FF6B7A',
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { setProfileOpen, navMode, setNavMode } = useUI()
  const navigate = useNavigate()
  if (!user) return null

  const roles     = normalizeRoles(user.role, user.roles)
  const canManage = hasManagement(roles)
  const mode      = canManage ? navMode : 'use'
  const items     = getNavForMode(mode, roles)

  const switchMode = (target: 'use' | 'manage') => {
    if (target === mode) return
    setNavMode(target)
    navigate(getHomeForMode(target, roles))
  }

  return (
    <aside
      className="hidden lg:flex flex-col fixed top-4 left-4 bottom-4 w-[76px] z-40 rounded-[28px] overflow-hidden"
      style={{
        background: 'var(--ist-nav-bg)',
        border: '1px solid var(--ist-nav-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      }}
    >
      {/* Logo */}
      <div className="flex justify-center py-4" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
        <ISTLogo size={26} />
      </div>

      {/* User avatar — click to open profile */}
      <button
        onClick={() => setProfileOpen(true)}
        className="flex flex-col items-center gap-1 py-3 w-full transition-opacity hover:opacity-80 active:opacity-60"
        style={{ borderBottom: '1px solid var(--ist-w8)' }}
        title="Impostazioni profilo"
      >
        <UserAvatar user={user} size={32} />
        <p className="text-[9px] font-semibold truncate w-full text-center px-1 leading-none" style={{ color: 'var(--ist-text)' }}>
          {user.name.split(' ')[0]}
        </p>
        {user.status && (
          <div
            className="w-1.5 h-1.5 rounded-full mt-0.5"
            style={{ background: STATUS_COLORS[user.status] ?? '#8495A3' }}
          />
        )}
      </button>

      {/* Mode switch — only for users with a management role */}
      {canManage && (
        <div className="px-1.5 pt-2 pb-1 flex flex-col gap-1" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
          <ModeButton
            active={mode === 'use'}
            icon={<Compass size={16} strokeWidth={2} />}
            label="Usa"
            onClick={() => switchMode('use')}
          />
          <ModeButton
            active={mode === 'manage'}
            icon={<SlidersHorizontal size={16} strokeWidth={2} />}
            label="Gestisci"
            onClick={() => switchMode('manage')}
          />
        </div>
      )}

      {/* Nav for the active mode (deduplicated) */}
      <nav className="flex-1 py-2 overflow-y-auto no-scrollbar">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            data-tour={item.path}
            end={HOME_PATHS.has(item.path)}
            style={({ isActive }) => isActive ? {
              background: 'var(--ist-nav-active-bg)',
              border: '1px solid var(--ist-nav-active-border)',
              color: 'var(--ist-nav-active-text)',
            } : {
              color: 'var(--ist-nav-text)',
              border: '1px solid transparent',
            }}
            className="flex flex-col items-center gap-0.5 mx-1.5 px-1 py-2 rounded-2xl transition-all duration-150 w-[calc(100%-12px)]"
          >
            <NavIcon name={item.icon} />
            <span className="text-[9px] font-medium truncate w-full text-center leading-none mt-0.5">
              {item.shortLabel ?? item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="py-2" style={{ borderTop: '1px solid var(--ist-w8)' }}>
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-0.5 mx-1.5 px-1 py-2 rounded-2xl transition-all duration-150 w-[calc(100%-12px)] hover:bg-white/5"
          style={{ color: 'var(--ist-nav-text)' }}
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          <span className="text-[9px] font-medium leading-none mt-0.5">Tema</span>
        </button>
        <button
          onClick={logout}
          className="flex flex-col items-center gap-0.5 mx-1.5 px-1 py-2 rounded-2xl transition-all duration-150 w-[calc(100%-12px)] hover:bg-red-500/5 hover:text-red-400"
          style={{ color: 'var(--ist-nav-text)' }}
        >
          <LogOut size={18} strokeWidth={2} />
          <span className="text-[9px] font-medium leading-none mt-0.5">Esci</span>
        </button>
      </div>
    </aside>
  )
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-2xl transition-all duration-150"
      style={active
        ? { background: 'var(--ist-nav-active-bg)', border: '1px solid var(--ist-nav-active-border)', color: 'var(--ist-nav-active-text)' }
        : { background: 'var(--ist-w6)', border: '1px solid transparent', color: 'var(--ist-nav-text)' }
      }
    >
      {icon}
      <span className="text-[9px] font-semibold leading-none mt-0.5">{label}</span>
    </button>
  )
}
