// ────────────────────────────────────────────────────────────────────────────
// Storage della sessione Supabase, scelto in base alla piattaforma.
//
// Perché esiste: sull'app NATIVA (Capacitor/WKWebView su iOS, WebView su Android)
// la sessione Supabase viveva nel localStorage della webview. iOS può EVICTARE
// il localStorage della WKWebView (storage pressure, pulizia dati) → alla
// riapertura la sessione non c'è più → login. È una causa tipica dei "logout
// casuali" sull'app dello store, e non è risolvibile lato web.
//
// Fix: sul nativo persistiamo la sessione in Capacitor Preferences
// (UserDefaults su iOS, SharedPreferences su Android): storage NATIVO durevole,
// non soggetto all'eviction della webview. Con MIGRAZIONE una-tantum dal vecchio
// localStorage, così l'aggiornamento dell'app NON slogga chi era già dentro.
//
// Sul WEB restiamo su localStorage (chiave invariata: cambiarla sloggherebbe
// tutti) tramite l'adapter strumentato in authDebug.
// ────────────────────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import {
  loggingStorage,
  logAuthEvent,
  wasExplicitSignOut,
  isMainSessionKey,
  isSessionFamilyKey,
  shortStack,
} from './authDebug'

export const isNativePlatform = Capacitor.isNativePlatform()

// Adapter nativo: Preferences (durevole) + migrazione dal localStorage legacy.
// I metodi sono async: l'adapter storage di supabase-js supporta i Promise.
const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key })
      if (value != null) return value
    } catch (err) {
      logAuthEvent('native_storage_get_failed', { key, message: String(err) })
    }
    // Fallback + migrazione una-tantum: la build precedente teneva la sessione
    // nel localStorage della webview. Se è ancora lì, portala in Preferences così
    // l'utente resta loggato dopo l'update; da lì in poi è durevole.
    try {
      const legacy = typeof window !== 'undefined' ? window.localStorage?.getItem(key) ?? null : null
      if (legacy != null) {
        await Preferences.set({ key, value: legacy })
        if (isMainSessionKey(key)) logAuthEvent('native_storage_migrated', { key })
        return legacy
      }
    } catch { /* localStorage inaccessibile: niente da migrare */ }
    return null
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isMainSessionKey(key)) {
      logAuthEvent('storage_set_session', { key, size: value?.length ?? 0, store: 'native' })
    }
    try {
      await Preferences.set({ key, value })
    } catch (err) {
      logAuthEvent('native_storage_set_failed', { key, message: String(err) })
    }
  },
  async removeItem(key: string): Promise<void> {
    if (isSessionFamilyKey(key)) {
      logAuthEvent('storage_remove_session', {
        key,
        main: isMainSessionKey(key),
        explicit: wasExplicitSignOut(),
        store: 'native',
        stack: shortStack(),
      })
    }
    try {
      await Preferences.remove({ key })
      // Ripulisci anche l'eventuale copia legacy nel localStorage, così non
      // resuscita a un getItem futuro dopo una rimozione voluta.
      if (typeof window !== 'undefined') window.localStorage?.removeItem(key)
    } catch { /* noop */ }
  },
}

// Nativo → Preferences durevole. Web → localStorage strumentato.
export const authStorage = isNativePlatform ? nativeStorage : loggingStorage
