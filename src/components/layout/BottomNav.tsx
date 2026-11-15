import { useState, useEffect, type ElementType } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
  MoreHorizontal, X, Sun, Moon, LogOut, Compass, SlidersHorizontal, Lock, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getMobileNavConfig, getHomeForMode, hasManagement, normalizeRoles,
  NavItem, NavMode,
} from '../../router/navConfig'
import { isPathLockedForFree } from '../../lib/freeTier'
import { useSpaceQuantAccess } from '../../lib/spacequant'
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

function NavIcon({ name, size = 20, dot = false, locked = false }: { name: string; size?: number; dot?: boolean; locked?: boolean }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return (
    <span className="relative inline-flex">
      <Icon size={size} strokeWidth={2} />
      {dot && <NewsDot />}
      {locked && (
        <span
          className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full flex items-center justify-center"
          style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)' }}
        >
          <Lock size={8} strokeWidth={2.6} style={{ color: '#F6C85F' }} />
        </span>
      )}
    </span>
  )
}

function OverflowSheet({
  items,
  canManage,
  navMode,
  onSwitchMode,
  onClose,
}: {
  items: NavItem[]
  canManage: boolean
  navMode: NavMode
  onSwitchMode: (m: NavMode) => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const { setProfileOpen } = useUI()
  const { hasNews } = useNews()
  const { pathname } = useLocation()

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'fadeInBackdrop 0.2s ease' }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="nav-glass nav-scope lg:hidden fixed z-50 left-3 right-3 rounded-[2rem] overflow-hidden"
        style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom, 0px) + 4px) + 72px)', animation: 'slideUpSheet 0.22s cubic-bezier(0.22,1,0.36,1)' }}
      >
        {/* Profilo */}
        <div className="flex items-center gap-3 pl-4 pr-2 pt-3.5 pb-3">
          {user && (
            <button onClick={() => { setProfileOpen(true); onClose() }} className="flex-1 min-w-0 flex items-center gap-3 text-left active:opacity-70">
              <UserAvatar user={user} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate" style={{ color: 'var(--ist-text)' }}>{user.name}</span>
                <span className="flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--ist-nav-text)' }}>Profilo <ChevronRight size={12} strokeWidth={2.2} /></span>
              </span>
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--ist-nav-text)' }} aria-label="Chiudi">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Usa / Gestisci — solo ruoli di gestione */}
        {canManage && (
          <div className="px-4 pb-2">
            <div className="flex p-0.5 rounded-xl" style={{ background: 'var(--ist-w6)' }}>
              <SheetModeButton active={navMode === 'use'} icon={<Compass size={14} strokeWidth={2} />} label="Usa" onClick={() => onSwitchMode('use')} />
              <SheetModeButton active={navMode === 'manage'} icon={<SlidersHorizontal size={14} strokeWidth={2} />} label="Gestisci" onClick={() => onSwitchMode('manage')} />
            </div>
          </div>
        )}

        <div className="nav-divider mx-4" />

        {/* Sezioni */}
        <div className="px-2 py-2 grid grid-cols-4">
          {items.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + '/')
            return (
              <button
                key={item.path}
                data-tour={item.path}
                onClick={() => { navigate(item.path); onClose() }}
                className="nav-tile flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl active:scale-[0.94]"
                style={{ color: active ? 'var(--ist-nav-active-icon)' : 'var(--ist-text)' }}
              >
                <span className="relative inline-flex">
                  <NavIcon name={item.icon} size={20} locked={isPathLockedForFree(item.path, user)} />
                  {hasNews(item.path) && <NewsDot />}
                </span>
                <span className={`text-[10.5px] text-center leading-tight ${active ? 'font-semibold' : 'font-medium'}`} style={{ color: active ? 'var(--ist-nav-active-text)' : 'var(--ist-nav-text)' }}>
                  {item.shortLabel ?? item.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="nav-divider mx-4" />

        {/* Tema ed esci */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <button onClick={toggleTheme} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium active:opacity-60" style={{ color: 'var(--ist-nav-text)' }}>
            {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
            {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          </button>
          <button onClick={() => { logout(); onClose() }} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium active:opacity-60" style={{ color: '#E07A85' }}>
            <LogOut size={14} strokeWidth={2} />
            Esci
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUpSheet {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInBackdrop { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  )
}

function SheetModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[10px] text-xs font-medium transition-colors"
      style={active
        ? { background: 'var(--ist-nav-pill)', color: 'var(--ist-nav-active-text)' }
        : { color: 'var(--ist-nav-text)' }
      }
    >
      {icon}
      {label}
    </button>
  )
}

export default function BottomNav() {
  const { user } = useAuth()
  const { hideBottomNav, navMode, setNavMode } = useUI()
  const { hasNews } = useNews()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const spaceQuantAccess = useSpaceQuantAccess()

  // Il tour interattivo apre/chiude il pannello "Altro" tramite eventi.
  useEffect(() => {
    const open = () => setMoreOpen(true)
    const close = () => setMoreOpen(false)
    window.addEventListener('ist:tour-open-more', open)
    window.addEventListener('ist:tour-close-more', close)
    return () => {
      window.removeEventListener('ist:tour-open-more', open)
      window.removeEventListener('ist:tour-close-more', close)
    }
  }, [])

  if (!user) return null

  const roles     = normalizeRoles(user.role, user.roles)
  const canManage = hasManagement(roles)
  const mode      = canManage ? navMode : 'use'
  const { primary: primaryBase, overflow: overflowAll } = getMobileNavConfig(mode, roles)

  // Beta ristretta "Quant-Brain": chi ha accesso la vede al posto di "Live &
  // Replay" nella barra primaria mobile (Live scende nel menu "Altro"); chi
  // non ha accesso vede la barra di sempre e Quant-Brain resta invisibile
  // ovunque, nemmeno in "Altro" (verificato server-side).
  const quantBrain = overflowAll.find(i => i.path === '/student/spacequant')
  const scambioAttivo = mode === 'use' && spaceQuantAccess && !!quantBrain
  const primary = scambioAttivo
    ? primaryBase.map(i => (i.path === '/student/live' ? quantBrain! : i))
    : primaryBase
  const overflow = scambioAttivo
    ? overflowAll.filter(i => i.path !== '/student/spacequant').concat(primaryBase.find(i => i.path === '/student/live')!)
    : overflowAll.filter(i => i.path !== '/student/spacequant' || spaceQuantAccess)
  const homePath = primary[0]?.path
  const hasOverflow = overflow.length > 0 || canManage
  const overflowHasNews = overflow.some(i => hasNews(i.path))

  const path = location.pathname
  const matchIdx = primary.findIndex(i => (i.path === homePath ? path === i.path : path === i.path || path.startsWith(i.path + '/')))
  const inOverflow = overflow.some(i => path === i.path || path.startsWith(i.path + '/'))
  const activeIdx = moreOpen && hasOverflow ? primary.length : matchIdx >= 0 ? matchIdx : inOverflow && hasOverflow ? primary.length : -1

  const switchMode = (target: NavMode) => {
    if (target !== mode) {
      setNavMode(target)
      navigate(getHomeForMode(target, roles))
    }
    setMoreOpen(false)
  }

  return (
    <>
      {moreOpen && (
        <OverflowSheet
          items={overflow}
          canManage={canManage}
          navMode={mode}
          onSwitchMode={switchMode}
          onClose={() => setMoreOpen(false)}
        />
      )}

      <nav
        className={`nav-scope lg:hidden fixed z-50 transition-transform duration-300 ease-in-out ${hideBottomNav ? 'translate-y-[200%]' : 'translate-y-0'}`}
        style={{ left: 12, right: 12, bottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 4px))' }}
      >
        <div className="nav-glass relative flex items-stretch h-[62px] px-2 rounded-full">
          {primary.map((item, i) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-tour={item.path}
              end={item.path === homePath}
              className={`nav-item relative z-[1] flex-1 min-w-0 flex flex-col items-center justify-center gap-[5px] transition-transform active:scale-[0.92] ${i === activeIdx ? 'is-active' : ''}`}
              style={{ color: i === activeIdx ? 'var(--ist-nav-active-text)' : 'var(--ist-nav-text)' }}
            >
              <NavIcon name={item.icon} size={20} dot={hasNews(item.path)} locked={isPathLockedForFree(item.path, user)} />
              <span className={`text-[10px] truncate max-w-full px-0.5 text-center leading-none ${i === activeIdx ? 'font-bold' : 'font-medium'}`}>
                {item.shortLabel ?? item.label}
              </span>
            </NavLink>
          ))}

          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(o => !o)}
              data-tour="__more__"
              className={`nav-item relative z-[1] flex-1 min-w-0 flex flex-col items-center justify-center gap-[5px] transition-transform active:scale-[0.92] ${activeIdx === primary.length ? 'is-active' : ''}`}
              aria-expanded={moreOpen}
              style={{ color: activeIdx === primary.length ? 'var(--ist-nav-active-text)' : 'var(--ist-nav-text)' }}
            >
              <span className="relative inline-flex">
                <MoreHorizontal size={20} strokeWidth={2} />
                {overflowHasNews && <NewsDot />}
              </span>
              <span className={`text-[10px] leading-none ${activeIdx === primary.length ? 'font-bold' : 'font-medium'}`}>Altro</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
