import { createClient } from '@supabase/supabase-js'
import { loggingFetch, installAuthDebug, logAuthEvent } from './authDebug'
import { authStorage, isNativePlatform } from './authStorage'

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
    // Storage della sessione, scelto per piattaforma (vedi src/lib/authStorage.ts):
    // • NATIVO → Capacitor Preferences (UserDefaults/SharedPreferences): durevole,
    //   sopravvive all'eviction del localStorage della WKWebView → fix dei logout
    //   casuali sull'app dello store. Migrazione una-tantum dal localStorage.
    // • WEB → localStorage strumentato (chiave invariata) per diagnosi.
    storage: authStorage,
  },
  // fetch strumentato: cattura il CORPO esatto delle risposte fallite di
  // /auth/v1/token (es. "Invalid Refresh Token: Already Used"), passando tutto
  // il resto invariato.
  global: { fetch: loggingFetch },
})

// Attiva canary anti-eviction, listener online/offline e window.__istAuth.
installAuthDebug()
logAuthEvent('client_init', { store: isNativePlatform ? 'native-preferences' : 'web-localStorage' })
