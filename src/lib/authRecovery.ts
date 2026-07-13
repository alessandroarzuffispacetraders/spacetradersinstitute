import { Capacitor } from '@capacitor/core'

// ---------------------------------------------------------------------------
// Recupero password ("password dimenticata")
//
// Il link nell'email di Supabase riporta l'utente su <sito>/reset-password con
// i token nel FRAGMENT dell'URL (flow implicito):
//   /reset-password#access_token=...&refresh_token=...&type=recovery
// oppure, se il link è scaduto/già usato:
//   /reset-password#error=access_denied&error_code=otp_expired&error_description=...
//
// Due trappole, entrambe risolte qui:
//  1. `detectSessionInUrl: true` consuma il fragment e RIPULISCE l'URL
//     (history.replaceState) appena il client viene creato → quando React monta,
//     l'hash non c'è più.
//  2. L'evento PASSWORD_RECOVERY viene emesso durante l'inizializzazione del
//     client, quindi PUÒ arrivare prima che AuthProvider si iscriva a
//     onAuthStateChange (e auth-js non lo ri-emette agli iscritti tardivi).
//
// Perciò leggiamo l'URL una volta sola, SINCRONAMENTE, al primo import — e
// questo modulo è importato da lib/supabase.ts PRIMA di createClient(), così la
// lettura avviene di sicuro prima che il fragment sparisca.
// ---------------------------------------------------------------------------

export const RESET_PATH = '/reset-password'

type RecoveryUrl = {
  // Siamo su una schermata di recupero? (per il "pin" del router e per mostrare
  // l'eventuale errore). Vero anche per un link SCADUTO che atterra su /reset-password.
  isRecovery: boolean
  // Il link portava un TOKEN di recupero valido (`type=recovery`)? Solo questo
  // abilita davvero il form "nuova password". Un link scaduto NON lo porta.
  isRecoveryToken: boolean
  errorCode: string | null
  errorDescription: string | null
}

function readRecoveryUrl(): RecoveryUrl {
  if (typeof window === 'undefined') {
    return { isRecovery: false, isRecoveryToken: false, errorCode: null, errorDescription: null }
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(window.location.search)
  const get = (k: string) => hashParams.get(k) ?? queryParams.get(k)

  const onResetPath = window.location.pathname.startsWith(RESET_PATH)
  const errorCode = get('error_code') ?? (get('error') ? get('error') : null)
  const isRecoveryToken = get('type') === 'recovery'

  return {
    // Un link di recupero SCADUTO non porta `type=recovery` ma solo l'errore:
    // lo riconosciamo dal fatto che atterra sulla pagina di reset. Questo governa
    // solo il "pin" del router e la schermata d'errore, MAI l'abilitazione del
    // form (per quella conta isRecoveryToken / il flag durevole sotto).
    isRecovery: isRecoveryToken || (onResetPath && !!errorCode),
    isRecoveryToken,
    errorCode,
    errorDescription: get('error_description'),
  }
}

export const recoveryUrl: RecoveryUrl = readRecoveryUrl()

// ---------------------------------------------------------------------------
// Flag "recupero password in corso" — DUREVOLE per la vita della scheda.
//
// Perché serve, separato da recoveryUrl: dopo il primo caricamento, auth-js
// consuma il token e ripulisce l'URL. A un reload della pagina il token non c'è
// più, ma la sessione di recupero SÌ. Senza un flag persistente non potremmo
// distinguere "sono qui per un recupero legittimo" (mostra il form) da "ho una
// sessione normale e ho digitato /reset-password" (NON deve poter cambiare la
// password senza la password attuale). Usiamo sessionStorage — per-scheda ed
// effimero (si azzera alla chiusura): un flag di recupero non deve sopravvivere
// oltre la sessione del browser.
// ---------------------------------------------------------------------------
const RECOVERY_FLAG = 'ist:pw-recovery-active'

function safeSession(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null // private mode / storage inaccessibile
  }
}

export function markRecoveryActive(): void {
  safeSession()?.setItem(RECOVERY_FLAG, '1')
}
export function clearRecoveryActive(): void {
  safeSession()?.removeItem(RECOVERY_FLAG)
}
export function isRecoveryActive(): boolean {
  return safeSession()?.getItem(RECOVERY_FLAG) === '1'
}

// Arrivo da un link con TOKEN valido → il recupero è genuinamente in corso.
// Lo registriamo SUBITO (import sincrono, prima che detectSessionInUrl ripulisca
// l'URL) così sopravvive a un eventuale reload della pagina.
if (recoveryUrl.isRecoveryToken) markRecoveryActive()

// URL pubblico dell'app, usato come destinazione del link nell'email.
// • Web → l'origin corrente (funziona su localhost in dev e su Vercel in prod).
// • Nativo (Capacitor) → l'origin è `capacitor://localhost`/`http://localhost`,
//   inutilizzabile in un'email: serve il sito pubblico. L'utente reimposta la
//   password nel browser e poi rientra nell'app con quella nuova.
export function siteUrl(): string {
  if (!Capacitor.isNativePlatform()) return window.location.origin
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim()
  return configured || 'https://spacetradersinstitute.com'
}

export function passwordResetRedirectUrl(): string {
  return `${siteUrl().replace(/\/$/, '')}${RESET_PATH}`
}

// Messaggi d'errore di GoTrue → italiano leggibile.
export function friendlyAuthError(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('expired') || m.includes('access_denied') || m.includes('otp')) {
    return 'Il link di recupero è scaduto o è già stato usato. Richiedine uno nuovo.'
  }
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many requests')) {
    return 'Troppi tentativi ravvicinati. Riprova tra qualche minuto.'
  }
  if (m.includes('should be different') || m.includes('same as the old')) {
    return 'La nuova password deve essere diversa da quella precedente.'
  }
  if (m.includes('password should be at least') || m.includes('password is too short')) {
    return 'Password troppo corta: usa almeno 8 caratteri.'
  }
  if (m.includes('weak') || m.includes('pwned')) {
    return 'Password troppo debole: scegline una meno comune.'
  }
  if (m.includes('session') || m.includes('jwt') || m.includes('token')) {
    return 'Il link di recupero è scaduto o è già stato usato. Richiedine uno nuovo.'
  }
  return 'Operazione non riuscita. Riprova.'
}
