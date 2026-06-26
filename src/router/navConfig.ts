import { User, UserRole } from '../types'

export interface NavItem {
  label: string
  shortLabel?: string
  path: string
  icon: string
}

export interface NavSection {
  role: UserRole
  label: string
  items: NavItem[]
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', path: '/student', icon: 'LayoutDashboard' },
  { label: 'Percorso', path: '/student/percorso', icon: 'Map' },
  { label: 'Videocorsi', shortLabel: 'Corsi', path: '/student/corsi', icon: 'BookOpen' },
  { label: 'Diario', path: '/student/diario', icon: 'BookMarked' },
  { label: 'Community', path: '/student/chat', icon: 'MessageCircle' },
  { label: 'Mental Coach', shortLabel: 'Mental', path: '/student/mental-coach', icon: 'Brain' },
  { label: 'Live & Replay', shortLabel: 'Live', path: '/student/live', icon: 'Radio' },
  { label: 'Progressi', path: '/student/progressi', icon: 'TrendingUp' },
  { label: 'Protocol Journal', shortLabel: 'Journal', path: '/student/journal', icon: 'ExternalLink' },
]

const COACH_NAV: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', path: '/coach', icon: 'LayoutDashboard' },
  { label: 'Studenti', path: '/coach/studenti', icon: 'Users' },
  { label: 'Review', path: '/coach/review', icon: 'ClipboardList' },
  { label: 'Segnalazioni', path: '/coach/segnalazioni', icon: 'AlertTriangle' },
]

const MENTAL_COACH_NAV: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', path: '/mental-coach', icon: 'LayoutDashboard' },
  { label: 'Studenti', path: '/mental-coach/studenti', icon: 'Users' },
  { label: 'Sessioni', path: '/mental-coach/sessioni', icon: 'CalendarDays' },
  { label: 'Note', path: '/mental-coach/note', icon: 'FileText' },
  { label: 'Chat', path: '/mental-coach/chat', icon: 'MessageCircle' },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', path: '/admin', icon: 'LayoutDashboard' },
  { label: 'Utenti', path: '/admin/utenti', icon: 'Users' },
  { label: 'Contenuti', path: '/admin/contenuti', icon: 'Package' },
  { label: 'Statistiche', path: '/admin/statistiche', icon: 'BarChart3' },
  { label: 'Chat', path: '/admin/chat', icon: 'MessageCircle' },
]

const NAV_MAP: Record<UserRole, NavItem[]> = {
  student:      STUDENT_NAV,
  coach:        COACH_NAV,
  mental_coach: MENTAL_COACH_NAV,
  admin:        ADMIN_NAV,
}

const ROLE_LABELS: Record<UserRole, string> = {
  student:      'Studente',
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  admin:        'Admin',
}

export function getNavItems(role: UserRole): NavItem[] {
  return NAV_MAP[role]
}

export function getNavSections(roles: UserRole[]): NavSection[] {
  return roles.map(role => ({
    role,
    label: ROLE_LABELS[role],
    items: NAV_MAP[role],
  }))
}

const STUDENT_MOBILE_PRIMARY = ['/student', '/student/corsi', '/student/chat', '/student/live']

export function getMobileNavConfig(user: User): { primary: NavItem[]; overflow: NavItem[] } {
  const roles = user.roles && user.roles.length > 0 ? user.roles : [user.role]

  if (roles[0] === 'student') {
    const primary  = STUDENT_MOBILE_PRIMARY.map(p => STUDENT_NAV.find(i => i.path === p)!).filter(Boolean)
    const overflow = STUDENT_NAV.filter(i => !STUDENT_MOBILE_PRIMARY.includes(i.path))
    return { primary, overflow }
  }

  // For multi-role: primary role's first 4 items, overflow = rest + other roles' items
  const primaryItems = NAV_MAP[roles[0]]
  const extraItems   = roles.slice(1).flatMap(r => NAV_MAP[r])
  const all          = [...primaryItems, ...extraItems]
  return { primary: all.slice(0, 4), overflow: all.slice(4) }
}
