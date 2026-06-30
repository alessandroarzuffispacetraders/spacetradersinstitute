import { UserRole } from '../types'

export interface NavItem {
  label: string
  shortLabel?: string
  path: string
  icon: string
}

export type NavMode = 'use' | 'manage'

// ─── UTILIZZO ──────────────────────────────────────────────────────────────────
// Funzioni "d'uso" della piattaforma — uguali per tutti i ruoli (accesso completo).
const USE_NAV: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', path: '/student', icon: 'LayoutDashboard' },
  { label: 'Percorso', path: '/student/percorso', icon: 'Map' },
  { label: 'Videocorsi', shortLabel: 'Corsi', path: '/student/corsi', icon: 'BookOpen' },
  { label: 'Diario', path: '/student/diario', icon: 'BookMarked' },
  { label: 'Compiti', path: '/student/compiti', icon: 'ClipboardList' },
  { label: 'Community', path: '/student/chat', icon: 'MessageCircle' },
  { label: 'Mental Coach', shortLabel: 'Mental', path: '/student/mental-coach', icon: 'Brain' },
  { label: 'Live & Replay', shortLabel: 'Live', path: '/student/live', icon: 'Radio' },
  { label: 'Calendario', path: '/student/calendario', icon: 'CalendarDays' },
  { label: 'Progressi', path: '/student/progressi', icon: 'TrendingUp' },
  { label: 'Protocol Journal', shortLabel: 'Journal', path: '/student/journal', icon: 'ExternalLink' },
]
const USE_MOBILE_PRIMARY = ['/student', '/student/corsi', '/student/chat', '/student/live']

// ─── GESTIONE ──────────────────────────────────────────────────────────────────
// Strumenti gestionali per ciascun ruolo (esclusa la dashboard, gestita a parte).
const MANAGE_BY_ROLE: Record<UserRole, NavItem[]> = {
  student: [],
  coach: [
    { label: 'Studenti', path: '/coach/studenti', icon: 'Users' },
    { label: 'Compiti', path: '/coach/review', icon: 'ClipboardList' },
    { label: 'Segnalazioni', shortLabel: 'Segnal.', path: '/coach/segnalazioni', icon: 'AlertTriangle' },
  ],
  mental_coach: [
    { label: 'Studenti', path: '/mental-coach/studenti', icon: 'Users' },
    { label: 'Sessioni', path: '/mental-coach/sessioni', icon: 'CalendarDays' },
    { label: 'Note', path: '/mental-coach/note', icon: 'FileText' },
  ],
  admin: [
    { label: 'Utenti', path: '/admin/utenti', icon: 'Users' },
    { label: 'Contenuti', shortLabel: 'Contenuti', path: '/admin/contenuti', icon: 'Package' },
    { label: 'Statistiche', shortLabel: 'Stats', path: '/admin/statistiche', icon: 'BarChart3' },
    { label: 'Canali', path: '/admin/chat', icon: 'MessageCircle' },
  ],
}

// Dashboard gestionale per ruolo + ordine di priorità (per chi ha più ruoli)
const MANAGE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  coach: '/coach',
  mental_coach: '/mental-coach',
  student: '/student',
}
const MANAGE_PRIORITY: UserRole[] = ['admin', 'coach', 'mental_coach']

const ROLE_LABELS: Record<UserRole, string> = {
  student:      'Studente',
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  admin:        'Admin',
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role]
}

export function normalizeRoles(role: UserRole, roles?: UserRole[]): UserRole[] {
  return roles && roles.length > 0 ? roles : [role]
}

// Ha almeno un ruolo gestionale → vede il toggle e la modalità "Gestisci"
export function hasManagement(roles: UserRole[]): boolean {
  return roles.some(r => r === 'coach' || r === 'mental_coach' || r === 'admin')
}

export function getUseNav(): NavItem[] {
  return USE_NAV
}

export const USE_HOME = '/student'

// Home della modalità gestione, in base al ruolo gestionale di priorità più alta
export function getManageHome(roles: UserRole[]): string {
  const top = MANAGE_PRIORITY.find(r => roles.includes(r))
  return top ? MANAGE_HOME[top] : USE_HOME
}

// Voci gestione = Dashboard + unione deduplicata (per path) degli strumenti dei ruoli
export function getManageNav(roles: UserRole[]): NavItem[] {
  const items: NavItem[] = [
    { label: 'Dashboard', shortLabel: 'Home', path: getManageHome(roles), icon: 'LayoutDashboard' },
  ]
  const seen = new Set(items.map(i => i.path))
  for (const role of MANAGE_PRIORITY) {
    if (!roles.includes(role)) continue
    for (const item of MANAGE_BY_ROLE[role]) {
      if (seen.has(item.path)) continue
      seen.add(item.path)
      items.push(item)
    }
  }
  return items
}

export function getNavForMode(mode: NavMode, roles: UserRole[]): NavItem[] {
  return mode === 'manage' ? getManageNav(roles) : getUseNav()
}

export function getHomeForMode(mode: NavMode, roles: UserRole[]): string {
  return mode === 'manage' ? getManageHome(roles) : USE_HOME
}

// Config nav mobile per la modalità attiva: prime voci in barra, resto in "Altro"
export function getMobileNavConfig(mode: NavMode, roles: UserRole[]): { primary: NavItem[]; overflow: NavItem[] } {
  const items = getNavForMode(mode, roles)
  if (mode === 'use') {
    const primary  = USE_MOBILE_PRIMARY.map(p => items.find(i => i.path === p)).filter((i): i is NavItem => !!i)
    const overflow = items.filter(i => !USE_MOBILE_PRIMARY.includes(i.path))
    return { primary, overflow }
  }
  return { primary: items.slice(0, 4), overflow: items.slice(4) }
}
