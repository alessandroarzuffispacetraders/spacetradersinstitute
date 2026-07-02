import { User } from '../types'

// Utente gratuito = studente con tier 'free'. Unica fonte di verità lato client
// (il vero gating è comunque server-side via RLS / is_free_user()).
export function isFreeUser(user: Pick<User, 'role' | 'tier'> | null | undefined): boolean {
  return !!user && user.role === 'student' && user.tier === 'free'
}

// Funzioni riservate ai paganti: per l'utente gratuito sono visibili ma bloccate
// (schermata di upsell). Prefissi di path — match esatto o come sottopercorso.
export const FREE_LOCKED_PREFIXES = [
  '/student/percorso',
  '/student/mental-coach',
  '/student/compiti',
  '/student/live',
  '/student/calendario',
  '/student/diario',
  '/student/journal',
]

export function isPathLockedForFree(
  path: string,
  user: Pick<User, 'role' | 'tier'> | null | undefined,
): boolean {
  if (!isFreeUser(user)) return false
  return FREE_LOCKED_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
}

// Il "passa al completo" non è un pagamento in-app: apre una chat privata con
// l'admin (vedi useContactAdmin in lib/upgradeContact).
