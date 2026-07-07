import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
  MoreHorizontal, X, Sun, Moon, LogOut, Compass, SlidersHorizontal, Lock,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getMobileNavConfig, getHomeForMode, hasManagement, normalizeRoles,
  NavItem, NavMode,
} from '../../router/navConfig'
import { isPathLockedForFree } from '../../lib/freeTier'
import UserAvatar from '../ui/UserAvatar'
import { useNews, NewsDot } from '../../context/NewsContext'
import { Capacitor } from '@capacitor/core'

// Android edge-to-edge (targetSdk 36): la WebView si estende SOTTO la barra gesti
// di sistema → la bottom nav va sollevata di `safe-area-inset-bottom` per non
// accavallarsi ai controlli (home/indietro). iOS/web restano IDENTICI (20/96).
const IS_ANDROID = Capacitor.getPlatform() === 'android'
const NAV_BOTTOM: number | string = IS_ANDROID ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 20
const SHEET_BOTTOM: number | string = IS_ANDROID ? 'calc(96px + env(safe-area-inset-bottom, 0px))' : 96

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="lg:hidden fixed z-50 left-4 right-4"
        style={{
          bottom: SHEET_BOTTOM,
          borderRadius: '2rem',
          background: 'var(--ist-nav-bg)',
          border: '1px solid var(--ist-nav-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.30)',
          animation: 'slideUpSheet 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--ist-w8)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>Altro</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Mode switch — only for management roles */}
        {canManage && (
          <div className="px-4 pt-3">
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--ist-w6)' }}>
              <SheetModeButton active={navMode === 'use'} icon={<Compass size={15} strokeWidth={2} />} label="Usa" onClick={() => onSwitchMode('use')} />
              <SheetModeButton active={navMode === 'manage'} icon={<SlidersHorizontal size={15} strokeWidth={2} />} label="Gestisci" onClick={() => onSwitchMode('manage')} />
            </div>
          </div>
        )}

        {/* Items grid */}
        <div className="p-4 grid grid-cols-3 gap-2">
          {items.map((item) => (
            <button
              key={item.path}
              data-tour={item.path}
              onClick={() => { navigate(item.path); onClose() }}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-[0.95]"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
            >
              <div
                className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.18)' }}
              >
                <NavIcon name={item.icon} size={18} locked={isPathLockedForFree(item.path, user)} />
                {hasNews(item.path) && <NewsDot />}
              </div>
              <span
                className="text-[10px] font-medium text-center leading-tight"
                style={{ color: 'var(--ist-text-muted)' }}
              >
                {item.shortLabel ?? item.label}
              </span>
            </button>
          ))}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-[0.95]"
            style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.18)' }}
            >
              {theme === 'dark'
                ? <Sun size={18} strokeWidth={2} style={{ color: 'var(--ist-nav-text)' }} />
                : <Moon size={18} strokeWidth={2} style={{ color: 'var(--ist-nav-text)' }} />
              }
            </div>
            <span
              className="text-[10px] font-medium text-center leading-tight"
              style={{ color: 'var(--ist-text-muted)' }}
            >
              {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
            </span>
          </button>

          {/* Profile */}
          {user && (
            <button
              onClick={() => { setProfileOpen(true); onClose() }}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-[0.95]"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.18)' }}
              >
                <UserAvatar user={user} size={40} />
              </div>
              <span
                className="text-[10px] font-medium text-center leading-tight"
                style={{ color: 'var(--ist-text-muted)' }}
              >
                Profilo
              </span>
            </button>
          )}
        </div>

        {/* Logout — small, at the bottom */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={() => { logout(); onClose() }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl transition-colors"
            style={{
              background: 'rgba(255,107,122,0.06)',
              border: '1px solid rgba(255,107,122,0.14)',
              color: 'rgba(255,107,122,0.70)',
            }}
          >
            <LogOut size={13} strokeWidth={2} />
            <span className="text-xs font-medium">Esci dall'account</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUpSheet {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

function SheetModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
      style={active
        ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
        : { color: 'var(--ist-text-muted)' }
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
  const [moreOpen, setMoreOpen] = useState(false)

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
  const { primary, overflow } = getMobileNavConfig(mode, roles)
  const homePath = primary[0]?.path
  const hasOverflow = overflow.length > 0 || canManage
  const overflowHasNews = overflow.some(i => hasNews(i.path))

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
        className={`lg:hidden fixed z-50 transition-transform duration-300 ease-in-out ${hideBottomNav ? 'translate-y-[200%]' : 'translate-y-0'}`}
        style={{ bottom: NAV_BOTTOM, left: 16, right: 16 }}
      >
        <div
          className="flex items-center justify-around h-[68px] px-1"
          style={{
            borderRadius: 999,
            background: 'var(--ist-nav-bg)',
            border: '1px solid var(--ist-nav-border)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.44)',
          }}
        >
          {primary.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-tour={item.path}
              end={item.path === homePath}
              className="flex flex-col items-center gap-1 py-1 px-2 transition-all duration-150"
              style={({ isActive }) => ({ color: isActive ? '#7CBBD0' : 'var(--ist-nav-text)' })}
            >
              <NavIcon name={item.icon} size={20} dot={hasNews(item.path)} locked={isPathLockedForFree(item.path, user)} />
              <span className="text-[9px] font-medium truncate max-w-[52px] text-center leading-none">
                {item.shortLabel ?? item.label}
              </span>
            </NavLink>
          ))}

          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(o => !o)}
              data-tour="__more__"
              className="flex flex-col items-center gap-1 py-1 px-2 transition-all duration-150"
              style={{ color: moreOpen ? '#7CBBD0' : 'var(--ist-nav-text)' }}
            >
              <span className="relative inline-flex">
                <MoreHorizontal size={20} strokeWidth={2} />
                {overflowHasNews && <NewsDot />}
              </span>
              <span className="text-[9px] font-medium leading-none">Altro</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
