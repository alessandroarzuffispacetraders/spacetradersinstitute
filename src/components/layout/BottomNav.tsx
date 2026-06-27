import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
  MoreHorizontal, X, Sun, Moon, LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useTheme } from '../../context/ThemeContext'
import { getMobileNavConfig, NavItem } from '../../router/navConfig'
import UserAvatar from '../ui/UserAvatar'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Map, BookOpen, BookMarked, MessageCircle,
  Brain, Radio, TrendingUp, ExternalLink, Users, ClipboardList,
  AlertTriangle, CalendarDays, FileText, Package, BarChart3,
}

function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name]
  return Icon ? <Icon size={size} strokeWidth={2} /> : null
}

function OverflowSheet({
  items,
  onClose,
}: {
  items: NavItem[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const { setProfileOpen } = useUI()

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
          bottom: 'calc(max(4px, env(safe-area-inset-bottom, 0px)) + 76px)',
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

        {/* Items grid */}
        <div className="p-4 grid grid-cols-3 gap-2">
          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose() }}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-[0.95]"
              style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.18)' }}
              >
                <NavIcon name={item.icon} size={18} />
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

export default function BottomNav() {
  const { user } = useAuth()
  const { hideBottomNav } = useUI()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!user) return null

  const { primary, overflow } = getMobileNavConfig(user)
  const homePath = primary[0]?.path
  const hasOverflow = overflow.length > 0

  return (
    <>
      {moreOpen && overflow.length > 0 && (
        <OverflowSheet items={overflow} onClose={() => setMoreOpen(false)} />
      )}

      <nav
        className={`lg:hidden fixed z-50 transition-transform duration-300 ease-in-out ${hideBottomNav ? 'translate-y-[200%]' : 'translate-y-0'}`}
        style={{ bottom: 'max(4px, env(safe-area-inset-bottom, 0px))', left: 16, right: 16 }}
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
              end={item.path === homePath}
              className="flex flex-col items-center gap-1 py-1 px-2 transition-all duration-150"
              style={({ isActive }) => ({ color: isActive ? '#7CBBD0' : 'var(--ist-nav-text)' })}
            >
              <NavIcon name={item.icon} size={20} />
              <span className="text-[9px] font-medium truncate max-w-[52px] text-center leading-none">
                {item.shortLabel ?? item.label}
              </span>
            </NavLink>
          ))}

          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(o => !o)}
              className="flex flex-col items-center gap-1 py-1 px-2 transition-all duration-150"
              style={{ color: moreOpen ? '#7CBBD0' : 'var(--ist-nav-text)' }}
            >
              <MoreHorizontal size={20} strokeWidth={2} />
              <span className="text-[9px] font-medium leading-none">Altro</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
