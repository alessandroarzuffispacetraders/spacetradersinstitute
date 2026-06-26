import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
  LogOut, Sun, Moon, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useUI } from '../../context/UIContext'
import { getNavSections } from '../../router/navConfig'
import { UserRole } from '../../types'
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
  expired: '#F6C85F',
  blocked: '#FF6B7A',
}

const SECTION_ACCENT: Record<UserRole, string> = {
  admin:        '#46D39A',
  coach:        '#7CBBD0',
  mental_coach: '#A078FF',
  student:      '#5A9AB1',
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { setProfileOpen } = useUI()
  if (!user) return null

  const roles   = user.roles && user.roles.length > 0 ? user.roles : [user.role]
  const sections = getNavSections(roles)
  const isMultiRole = sections.length > 1

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

      {/* Nav — grouped by role section when multi-role */}
      <nav className="flex-1 py-2 overflow-y-auto no-scrollbar">
        {sections.map((section, si) => (
          <div key={section.role}>
            {/* Section divider for multi-role */}
            {isMultiRole && si > 0 && (
              <div className="mx-3 my-1.5 flex items-center gap-1.5">
                <div className="flex-1 h-px" style={{ background: 'var(--ist-w8)' }} />
                <span
                  className="text-[7px] font-bold uppercase tracking-widest px-1"
                  style={{ color: SECTION_ACCENT[section.role] }}
                >
                  {section.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--ist-w8)' }} />
              </div>
            )}

            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
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
          </div>
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
