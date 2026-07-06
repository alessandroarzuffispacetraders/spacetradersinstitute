import { supabase } from './supabase'

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessione scaduta. Rifai il login.')
    this.name = 'SessionExpiredError'
  }
}

// Ritorna un access_token FRESCO, firmato con la chiave JWT corrente.
//
// Perché serve: dopo la migrazione alle chiavi JWT asimmetriche (ES256), un token
// rimasto in cache nella sessione (firmato con la vecchia chiave HS256) NON è
// scaduto, quindi getSession() lo restituisce e l'autoRefresh non scatta — ma le
// edge function lo rifiutano con "Token non valido" (getUser ne verifica la firma).
// refreshSession() usa il refresh_token (token opaco, ancora valido) per emettere
// un access_token nuovo firmato con la chiave attuale. È un no-op sicuro quando il
// token è già valido. Da chiamare PRIMA di ogni invocazione di edge function
// sensibile (admin-*, delete-own-account).
export async function getFreshAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.refreshSession()
  if (!error && data.session?.access_token) return data.session.access_token
  throw new SessionExpiredError()
}
