import type { ElementType } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
  LogOut, Sun, Moon, Compass, SlidersHorizontal, Lock,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useUI } from '../../context/UIContext'
import {
  getNavForMode, getHomeForMode, hasManagement, normalizeRoles,
} from '../../router/navConfig'
import { isPathLockedForFree } from '../../lib/freeTier'
import { useSpaceQuantAccess } from '../../lib/spacequant'
import ISTLogo from '../ui/ISTLogo'
import UserAvatar from '../ui/UserAvatar'
import QuantBrainIcon from '../icons/QuantBrainIcon'
import { useNews, NewsDot } from '../../context/NewsContext'

// ElementType (non LucideIcon) perché QuantBrainIcon è un'icona custom SVG,
// non un'icona della libreria Lucide.
const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3, QuantBrain: QuantBrainIcon,
}

function NavIcon({ name, dot = false, locked = false }: { name: string; dot?: boolean; locked?: boolean }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return (
    <span className="relative inline-flex">
      <Icon size={18} strokeWidth={2} />
      {dot && <NewsDot />}
      {locked && <LockBadge />}
    </span>
  )
}

// Piccolo lucchetto d'angolo per le voci riservate ai paganti (utente gratuito).
function LockBadge() {
  return (
    <span
      className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full flex items-center justify-center"
      style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)' }}
    >
      <Lock size={8} strokeWidth={2.6} style={{ color: '#F6C85F' }} />
    </span>
  )
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
  const { hasNews } = useNews()
  const navigate = useNavigate()
  const spaceQuantAccess = useSpaceQuantAccess()
  if (!user) return null

  const roles     = normalizeRoles(user.role, user.roles)
  const canManage = hasManagement(roles)
  const mode      = canManage ? navMode : 'use'
  // Beta ristretta: la voce compare solo per chi ha accesso (verificato server-side).
  const items     = getNavForMode(mode, roles).filter(i => i.path !== '/student/spacequant' || spaceQuantAccess)

  const switchMode = (target: 'use' | 'manage') => {
    if (target === mode) return
    setNavMode(target)
    navigate(getHomeForMode(target, roles))
  }

  return (
    <aside className="nav-glass nav-scope hidden lg:flex flex-col fixed top-4 left-4 bottom-4 w-[76px] z-40 rounded-[28px] overflow-hidden">
      {/* Logo */}
      <div className="flex justify-center pt-5 pb-3">
        <ISTLogo size={26} />
      </div>

      {/* Avatar: apre il profilo */}
      <button
        onClick={() => setProfileOpen(true)}
        className="side-avatar group flex flex-col items-center gap-1.5 pt-1 pb-3 w-full"
        title="Impostazioni profilo"
      >
        <span className="relative rounded-full transition-opacity group-hover:opacity-80">
          <UserAvatar user={user} size={34} />
          {user.status && (
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
              style={{ background: STATUS_COLORS[user.status] ?? '#8495A3', boxShadow: '0 0 0 2px var(--ist-nav-bg)' }}
            />
          )}
        </span>
        <span className="text-[10px] font-semibold truncate w-full text-center px-1.5 leading-none" style={{ color: 'var(--ist-text)' }}>
          {user.name.split(' ')[0]}
        </span>
      </button>

      {/* Modalità (solo ruoli di gestione) */}
      {canManage && (
        <div className="mx-2 mb-1 p-0.5 flex flex-col gap-0.5 rounded-[16px]" style={{ background: 'var(--ist-w6)' }}>
          <ModeButton active={mode === 'use'} icon={<Compass size={16} strokeWidth={2} />} label="Usa" onClick={() => switchMode('use')} />
          <ModeButton active={mode === 'manage'} icon={<SlidersHorizontal size={16} strokeWidth={2} />} label="Gestisci" onClick={() => switchMode('manage')} />
        </div>
      )}

      <div className="side-divider mx-4 my-1.5" />

      {/* Voci della modalità attiva */}
      <nav className="side-list flex-1 min-h-0 py-1 px-2 flex flex-col gap-1 overflow-y-auto no-scrollbar">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            data-tour={item.path}
            end={HOME_PATHS.has(item.path)}
            title={item.label}
            className={({ isActive }) => `side-item relative flex flex-col items-center gap-1 px-1 py-2.5 rounded-[18px] ${isActive ? 'is-active' : ''}`}
          >
            <NavIcon name={item.icon} dot={hasNews(item.path)} locked={isPathLockedForFree(item.path, user)} />
            <span className="side-label text-[9.5px] truncate w-full text-center leading-none">
              {item.shortLabel ?? item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="side-divider mx-4 my-1.5" />

      {/* Tema ed esci */}
      <div className="px-2 pb-3 pt-1 flex flex-col gap-1">
        <button onClick={toggleTheme} className="side-item flex flex-col items-center gap-1 px-1 py-2.5 rounded-[18px]" title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>
          {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          <span className="side-label text-[9.5px] leading-none">Tema</span>
        </button>
        <button onClick={logout} className="side-item side-item-danger flex flex-col items-center gap-1 px-1 py-2.5 rounded-[18px]" title="Esci">
          <LogOut size={18} strokeWidth={2} />
          <span className="side-label text-[9.5px] leading-none">Esci</span>
        </button>
      </div>
    </aside>
  )
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-1 py-2 rounded-[14px] transition-colors duration-200"
      style={active
        ? { background: 'var(--ist-nav-pill)', color: 'var(--ist-nav-active-text)' }
        : { color: 'var(--ist-nav-text)' }
      }
    >
      {icon}
      <span className="text-[9.5px] font-semibold leading-none">{label}</span>
    </button>
  )
}
