import { supabase } from './supabase'
import { logAuthEvent } from './authDebug'

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessione scaduta. Rifai il login.')
    this.name = 'SessionExpiredError'
  }
}

// Margine: se l'access_token scade entro questo tempo lo consideriamo "da
// rinnovare" prima di usarlo per una edge function.
const REFRESH_MARGIN_MS = 120_000 // 2 min

function expiringSoon(expiresAt?: number): boolean {
  if (!expiresAt) return true
  return expiresAt * 1000 - Date.now() < REFRESH_MARGIN_MS
}

// Ritorna un access_token valido, firmato con la chiave JWT corrente.
//
// IMPORTANTE (fix logout intermittenti): NON forziamo più un refresh a ogni
// chiamata. Un `refreshSession()` incondizionato RUOTA il refresh_token ogni
// volta; ogni rotazione in più allarga la finestra in cui un altro contesto
// (tab/PWA/app native) tiene un refresh_token ormai vecchio e, quando prova a
// rinnovare, riceve un errore hard → logout involontario. Perciò rinnoviamo SOLO
// quando serve davvero (token assente o in scadenza).
//
// La ragione storica del refresh forzato — dopo la migrazione a chiavi JWT
// asimmetriche (ES256, 2026-07-05) un token HS256 in cache non è scaduto ma le
// edge function lo rifiutano — è ormai estinta: gli access_token vivono ~1h,
// quindi ogni token HS256 residuo è scaduto da giorni. Un token NON scaduto
// restituito da getSession() è oggi garantito ES256 (firma corrente).
//
// Da usare PRIMA di ogni invocazione di edge function sensibile (admin-*,
// delete-own-account).
export async function getFreshAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()

  // Token presente e non in scadenza → usalo così com'è (nessuna rotazione).
  if (session?.access_token && !expiringSoon(session.expires_at)) {
    return session.access_token
  }

  // Token assente/scaduto/in scadenza → rinnova (usa il refresh_token opaco).
  // getSession() di norma rinnova già in autonomia entro il margine; qui siamo
  // la rete di sicurezza per le chiamate admin.
  logAuthEvent('manual_refresh', {
    from: 'getFreshAccessToken',
    hadSession: !!session,
    expiresIn: session?.expires_at ? Math.round(session.expires_at * 1000 - Date.now()) / 1000 | 0 : null,
  })
  const { data, error } = await supabase.auth.refreshSession()
  if (!error && data.session?.access_token) return data.session.access_token
  throw new SessionExpiredError()
}
