// ────────────────────────────────────────────────────────────────────────────
// Strumentazione auth per diagnosticare i logout INTERMITTENTI ("a volte rientro
// e mi ritrovo al login pur non avendo fatto logout").
//
// Perché serve: è intermittente, quindi non si può tirare a indovinare. auth-js
// slogga (emette SIGNED_OUT → svuota lo storage) solo quando un refresh del token
// fallisce con un errore HARD mentre l'access_token è già scaduto. Quel refresh
// fallito NON lascia traccia sul DB (non crea una riga refresh_token). L'unico
// modo per vedere la CAUSA VERA è catturarla sul client, e siccome capita quando
// non stiamo guardando, va PERSISTITA con timestamp.
//
// Cosa cattura (tutto in un ring buffer in localStorage `ist_auth_events`):
//  • ogni risposta FALLITA dell'endpoint /auth/v1/token (refresh/login) col
//    CORPO ESATTO del server → es. {"error":"invalid_grant","error_description":
//    "Invalid Refresh Token: Already Used"} ← questa è la pistola fumante
//  • ogni RIMOZIONE della chiave di sessione dallo storage, con stack: distingue
//    un signOut esplicito (nostro) da un `_removeSession` interno di auth-js
//    (refresh fallito) da uno storage svuotato dall'OS
//  • se localStorage è inaccessibile/svuotato (iOS ITP, webview, storage pressure)
//  • un "canary" per capire se è sparita SOLO la sessione (rotazione/signOut) o
//    TUTTO lo storage (eviction dell'OS)
//
// Per leggerlo: in console apri  window.__istAuth.dump()  (o .table()).
//
// authDebug NON importa nulla del progetto (viene importato da supabase.ts):
// deve restare senza dipendenze per non creare cicli.
// ────────────────────────────────────────────────────────────────────────────

const EVENTS_KEY = 'ist_auth_events'
const CANARY_KEY = 'ist_auth_canary'
const MAX_EVENTS = 80
// Finestra durante la quale una rimozione di sessione è considerata "voluta"
// (subito dopo che login()/deleteAccount() hanno chiamato signOut).
const EXPLICIT_SIGNOUT_WINDOW_MS = 8000

export interface AuthEvent {
  t: string // ISO timestamp
  kind: string
  [k: string]: unknown
}

let explicitSignOutAt = 0

// ── accesso grezzo a localStorage, con probe di disponibilità ────────────────
function rawLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const probe = '__ist_ls_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

// ── ring buffer eventi (persistito) ──────────────────────────────────────────
function readEvents(): AuthEvent[] {
  const ls = rawLocalStorage()
  if (!ls) return []
  try {
    const raw = ls.getItem(EVENTS_KEY)
    return raw ? (JSON.parse(raw) as AuthEvent[]) : []
  } catch {
    return []
  }
}

export function logAuthEvent(kind: string, detail: Record<string, unknown> = {}): void {
  const ev: AuthEvent = {
    t: new Date().toISOString(),
    kind,
    vis: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
    online: typeof navigator !== 'undefined' ? navigator.onLine : 'n/a',
    ...detail,
  }
  // Sempre in console (livello basso) così è visibile anche live in devtools.
  try {
    // eslint-disable-next-line no-console
    console.debug('[auth]', kind, detail)
  } catch { /* noop */ }

  const ls = rawLocalStorage()
  if (!ls) return
  try {
    const events = readEvents()
    events.push(ev)
    while (events.length > MAX_EVENTS) events.shift()
    ls.setItem(EVENTS_KEY, JSON.stringify(events))
  } catch { /* storage pieno/inaccessibile: pazienza */ }
}

export function getAuthEvents(): AuthEvent[] {
  return readEvents()
}

// È la firma di un logout INVOLONTARIO? (per warn automatico + why())
function isInvoluntaryLogout(e: AuthEvent): boolean {
  if (e.kind === 'session_became_null' && e.explicit === false && e.hadUserBefore === true) return true
  if (e.kind === 'onAuthStateChange' && e.event === 'SIGNED_OUT' && e.explicit === false) return true
  if (e.kind === 'startup' && e.diagnosis === 'whole_storage_cleared_or_first_run' && e.hadCanary === true) return true
  return false
}

// Indice dell'ULTIMO logout involontario nel buffer, o -1.
function lastInvoluntaryLogoutIndex(events: AuthEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (isInvoluntaryLogout(events[i])) return i
  }
  return -1
}

// ── distinzione logout volontario vs involontario ────────────────────────────
export function markExplicitSignOut(): void {
  explicitSignOutAt = Date.now()
  logAuthEvent('explicit_signout_marked')
}
export function wasExplicitSignOut(): boolean {
  return Date.now() - explicitSignOutAt < EXPLICIT_SIGNOUT_WINDOW_MS
}

// ── fetch strumentato: cattura i fallimenti dell'endpoint auth ───────────────
// Passa TUTTO invariato; ispeziona solo le risposte non-ok di /auth/v1/token.
export const loggingFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url ?? String(input)

  const isTokenEndpoint = url.includes('/auth/v1/token')
  const grant = isTokenEndpoint
    ? url.includes('grant_type=refresh_token')
      ? 'refresh_token'
      : url.includes('grant_type=password')
        ? 'password'
        : 'other'
    : null

  let res: Response
  try {
    res = await fetch(input, init)
  } catch (err) {
    // Errore di RETE (fetch rejected): auth-js NON slogga in questo caso, ma è
    // utile saperlo (rientro offline, DNS, ecc.).
    if (isTokenEndpoint) {
      logAuthEvent('token_fetch_network_error', { grant, message: String(err) })
    }
    throw err
  }

  if (isTokenEndpoint && !res.ok) {
    // Leggi il corpo da un clone (non consumare quello vero).
    let body = ''
    try {
      body = await res.clone().text()
    } catch { /* body non leggibile */ }
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(body)
    } catch { /* non-JSON */ }
    logAuthEvent('token_endpoint_failed', {
      grant,
      status: res.status,
      // Estrai i campi d'errore GoTrue tipici; fallback al corpo grezzo troncato.
      error: parsed?.error ?? parsed?.error_code ?? parsed?.code ?? null,
      error_description:
        parsed?.error_description ?? parsed?.msg ?? parsed?.message ?? (body ? body.slice(0, 300) : null),
    })
  }
  return res
}

// ── storage strumentato: traccia scritture/rimozioni della chiave sessione ───
// storageKey di default = `sb-<ref>-auth-token` (+ suffissi -user / -code-verifier).
// NON cambiamo la chiave (cambiarla sloggherebbe tutti al deploy): solo proxy.
const memoryFallback = new Map<string, string>()
let warnedNoStorage = false

function isMainSessionKey(key: string): boolean {
  return key.endsWith('-auth-token')
}
function isSessionFamilyKey(key: string): boolean {
  return key.includes('-auth-token')
}
function shortStack(): string {
  try {
    const s = new Error().stack ?? ''
    // Tieni qualche frame utile (dove auth-js chiama removeItem: _removeSession,
    // _callRefreshToken, signOut, _recoverAndRefresh…).
    return s.split('\n').slice(2, 8).join(' | ')
  } catch {
    return ''
  }
}

export const loggingStorage = {
  getItem(key: string): string | null {
    const ls = rawLocalStorage()
    if (!ls) {
      if (!warnedNoStorage) {
        warnedNoStorage = true
        logAuthEvent('storage_unavailable', { op: 'getItem', key })
      }
      return memoryFallback.get(key) ?? null
    }
    try {
      return ls.getItem(key)
    } catch {
      return memoryFallback.get(key) ?? null
    }
  },
  setItem(key: string, value: string): void {
    if (isMainSessionKey(key)) {
      logAuthEvent('storage_set_session', { key, size: value?.length ?? 0 })
    }
    const ls = rawLocalStorage()
    if (!ls) {
      if (!warnedNoStorage) {
        warnedNoStorage = true
        logAuthEvent('storage_unavailable', { op: 'setItem', key })
      }
      memoryFallback.set(key, value)
      return
    }
    try {
      ls.setItem(key, value)
    } catch (err) {
      // Storage pieno / quota / privacy: la sessione NON verrà persistita al
      // reload → possibile causa di "rientro = login". Loggalo e tieni in memoria.
      logAuthEvent('storage_set_failed', { key, message: String(err) })
      memoryFallback.set(key, value)
    }
  },
  removeItem(key: string): void {
    if (isSessionFamilyKey(key)) {
      logAuthEvent('storage_remove_session', {
        key,
        main: isMainSessionKey(key),
        explicit: wasExplicitSignOut(),
        stack: shortStack(),
      })
    }
    const ls = rawLocalStorage()
    if (!ls) {
      memoryFallback.delete(key)
      return
    }
    try {
      ls.removeItem(key)
    } catch { /* noop */ }
    memoryFallback.delete(key)
  },
}

// ── install: canary + API di lettura in console + listener utili ─────────────
let installed = false
export function installAuthDebug(): void {
  if (installed) return
  installed = true

  const ls = rawLocalStorage()

  // Canary: distingue "sparita solo la sessione" da "sparito tutto lo storage".
  if (ls) {
    let hadAuthToken = false
    try {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i)
        if (k && isMainSessionKey(k)) { hadAuthToken = true; break }
      }
    } catch { /* noop */ }
    const prevCanary = (() => { try { return ls.getItem(CANARY_KEY) } catch { return null } })()
    logAuthEvent('startup', {
      hadAuthToken,
      hadCanary: !!prevCanary,
      prevCanaryAt: prevCanary,
      // canary c'era ma il token no → sessione rimossa selettivamente (signOut/rotazione).
      // né canary né token → storage svuotato dall'OS (eviction/pressure/privacy).
      diagnosis: !hadAuthToken
        ? (prevCanary ? 'session_removed_storage_intact' : 'whole_storage_cleared_or_first_run')
        : 'session_present',
    })
    try { ls.setItem(CANARY_KEY, new Date().toISOString()) } catch { /* noop */ }
  } else {
    logAuthEvent('startup', { storage: 'unavailable' })
  }

  // Correla i logout con rete/visibilità.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => logAuthEvent('net_online'))
    window.addEventListener('offline', () => logAuthEvent('net_offline'))
    // Espone un'API leggibile in console per l'utente.
    ;(window as unknown as { __istAuth?: unknown }).__istAuth = {
      dump: () => getAuthEvents(),
      table: () => {
        // eslint-disable-next-line no-console
        console.table(getAuthEvents())
        return `${getAuthEvents().length} eventi`
      },
      // why(): stampa in JSON COMPLETO (console.table tronca) gli eventi attorno
      // all'ultimo logout involontario → la causa vera, copiabile e da inviare.
      why: () => {
        const evs = getAuthEvents()
        const idx = lastInvoluntaryLogoutIndex(evs)
        const slice = idx >= 0 ? evs.slice(Math.max(0, idx - 10), idx + 3) : evs.slice(-13)
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(slice, null, 2))
        return idx >= 0
          ? '⚠️ Logout involontario trovato — copia il JSON qui sopra e invialo.'
          : 'Nessun logout involontario ancora. Sopra gli ultimi eventi.'
      },
      clear: () => {
        const s = rawLocalStorage()
        try { s?.removeItem(EVENTS_KEY) } catch { /* noop */ }
        return 'cleared'
      },
    }

    // Avviso automatico: se all'avvio il buffer contiene già un logout
    // involontario, segnalalo forte così l'utente sa di eseguire why().
    if (lastInvoluntaryLogoutIndex(getAuthEvents()) >= 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '⚠️ [auth] Rilevato un LOGOUT INVOLONTARIO nella cronologia. ' +
        'Esegui  window.__istAuth.why()  e invia il JSON.',
      )
    }
  }
}
