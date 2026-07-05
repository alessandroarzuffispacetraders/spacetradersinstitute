import { Capacitor } from '@capacitor/core'
import { User } from '../types'

// Utente gratuito = studente con tier 'free'. Unica fonte di verità lato client
// (il vero gating è comunque server-side via RLS / is_free_user()).
export function isFreeUser(user: Pick<User, 'role' | 'tier'> | null | undefined): boolean {
  return !!user && user.role === 'student' && user.tier === 'free'
}

// App Review Guideline 3.1.1: dentro l'app iOS NON possiamo mostrare inviti ad
// acquistare l'accesso completo con metodi diversi dall'In-App Purchase (banner
// "Sblocca", "Richiedi l'accesso completo", popup-esca, "contatta l'admin"...).
// L'app iOS è un "companion" al servizio di coaching 1:1 acquistato altrove:
// mostra i contenuti ma non vende nulla e non rimanda ad acquisti esterni.
// Il gating dei contenuti resta IDENTICO (RLS server-side): cambia solo la
// presentazione per l'utente free. Web e Android non sono soggetti alla regola
// Apple → il funnel di conversione lì resta invariato.
export function upsellSuppressed(): boolean {
  return Capacitor.getPlatform() === 'ios'
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
