import { createClient } from '@supabase/supabase-js'
import { loggingFetch, loggingStorage, installAuthDebug } from './authDebug'

// .trim() guards against a stray trailing newline/space in the env var,
// which would corrupt the Realtime WebSocket apikey (sent as a URL param).
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Sono i default espliciti (persistenza sessione + auto-refresh): li fissiamo
    // per chiarezza. NON impostiamo `storageKey`: lasciarlo di default
    // (`sb-<ref>-auth-token`) è obbligatorio, cambiarlo sloggherebbe tutti al deploy.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Storage strumentato: traccia scritture/rimozioni della chiave di sessione e
    // gestisce localStorage inaccessibile (iOS/webview) senza cambiare la chiave.
    // Serve a diagnosticare i logout intermittenti: vedi src/lib/authDebug.ts.
    storage: loggingStorage,
  },
  // fetch strumentato: cattura il CORPO esatto delle risposte fallite di
  // /auth/v1/token (es. "Invalid Refresh Token: Already Used"), passando tutto
  // il resto invariato.
  global: { fetch: loggingFetch },
})

// Attiva canary anti-eviction, listener online/offline e window.__istAuth.
installAuthDebug()
