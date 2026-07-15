import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { User, UserRole } from '../types'
import { recordAccess } from '../lib/accessLog'
import { logAuthEvent, markExplicitSignOut, wasExplicitSignOut } from '../lib/authDebug'
import {
  recoveryUrl,
  passwordResetRedirectUrl,
  friendlyAuthError,
  isRecoveryActive,
  markRecoveryActive,
  clearRecoveryActive,
} from '../lib/authRecovery'

// Secondi alla scadenza dell'access_token della sessione (per la diagnostica).
function expiresInSeconds(session: Session | null): number | null {
  if (!session?.expires_at) return null
  return Math.round(session.expires_at * 1000 - Date.now()) / 1000 | 0
}

type ProfileUpdate = Partial<Pick<User, 'name' | 'avatarPreset' | 'avatarUrl'>>

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: string | null }>
  signup: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateProfile: (data: ProfileUpdate) => Promise<void>
  changePassword: (current: string, next: string) => Promise<{ error: string | null }>
  // "Password dimenticata": invia l'email col link di recupero.
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  // Imposta la nuova password usando la sessione creata dal link di recupero.
  completePasswordReset: (next: string) => Promise<{ error: string | null }>
  // true quando l'utente è entrato da un link di recupero: l'app "pinna" la
  // schermata /reset-password (router) finché non completa o annulla.
  recoveryMode: boolean
  // true SOLO con un vero token di recupero (o evento PASSWORD_RECOVERY): è ciò
  // che abilita davvero il form "nuova password". Distinto da recoveryMode così
  // una sessione NORMALE (o un URL d'errore fabbricato) non può cambiare la
  // password scavalcando la ri-autenticazione di changePassword.
  recoveryActive: boolean
  // Errore arrivato nell'URL del link (es. link scaduto/già usato), se presente.
  recoveryError: string | null
  cancelPasswordReset: () => Promise<void>
  deleteAccount: () => Promise<{ error: string | null }>
  isAuthenticated: boolean
  loading: boolean
  justLoggedIn: boolean
  clearJustLoggedIn: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

async function fetchProfile(userId: string): Promise<User | null> {
  // Timeout di sicurezza: se la query si impianta (rete instabile) non lasciamo
  // mai il caricamento appeso — meglio null (→ verrà ritentato) che spinner eterno.
  const result = await Promise.race([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    new Promise<{ data: null; error: unknown }>(resolve =>
      setTimeout(() => resolve({ data: null, error: 'timeout' }), 6000),
    ),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = result as { data: any; error: unknown }

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    roles: data.roles ?? undefined,
    avatarPreset: data.avatar_preset ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
    status: data.status ?? undefined,
    tier: data.tier ?? undefined,
    phase: data.phase ?? undefined,
    permissions: data.permissions ?? undefined,
    assignedCoachId: data.assigned_coach_id ?? null,
    assignedMentalCoachId: data.assigned_mental_coach_id ?? null,
  }
}

// Profilo MINIMO ricavato dalla sessione. Usato SOLO come rete di sicurezza quando
// la sessione è valida ma il profilo non è raggiungibile (query lenta/timeout al
// risveglio): così l'app resta accessibile e non rimbalza al login. Viene sostituito
// dal profilo reale appena la query va a buon fine.
function minimalUserFromSession(session: Session): User {
  const m = (session.user.user_metadata ?? {}) as { name?: string; full_name?: string; role?: string }
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: m.name || m.full_name || session.user.email?.split('@')[0] || 'Utente',
    role: (m.role as UserRole) || 'student',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Copia sincrona di `user` per le decisioni dentro l'init auth (safety timeout,
  // "sono già dentro?") senza dipendere dal ciclo di render.
  const userRef = useRef<User | null>(null)
  useEffect(() => { userRef.current = user }, [user])
  // true solo subito dopo un login esplicito → innesca l'animazione di ingresso.
  // NON viene settato su refresh/ripristino sessione.
  const [justLoggedIn, setJustLoggedIn] = useState(false)

  // Recupero password. Il valore iniziale viene dall'URL letto SINCRONAMENTE
  // all'avvio (vedi lib/authRecovery): l'evento PASSWORD_RECOVERY può scattare
  // prima che questo provider si iscriva, quindi non possiamo dipendere solo da
  // lui. Il listener sotto lo tiene comunque come seconda rete di sicurezza.
  const [recoveryMode, setRecoveryMode] = useState(recoveryUrl.isRecovery)
  // Abilita il form: vero token adesso, OPPURE flag durevole già impostato
  // (es. l'utente ha ricaricato /reset-password e l'URL non ha più il token).
  const [recoveryActive, setRecoveryActive] = useState(recoveryUrl.isRecoveryToken || isRecoveryActive())
  const [recoveryError] = useState<string | null>(
    recoveryUrl.errorCode ? friendlyAuthError(recoveryUrl.errorDescription || recoveryUrl.errorCode) : null,
  )

  useEffect(() => {
    let mounted = true
    let latestSession: Session | null = null

    // Rete di sicurezza: se l'init auth si impianta (rete mobile instabile,
    // refresh token bloccato, storage inaccessibile in webview/incognito),
    // sblocca comunque la UI invece di restare sullo spinner all'infinito.
    // MA: se esiste una sessione valida senza profilo caricato, NON mostrare il
    // login — entra con un profilo minimo (il vero bug del "rifai login": una
    // query profilo fallita non deve MAI sloggare chi ha una sessione valida).
    const safety = setTimeout(() => {
      if (!mounted) return
      if (latestSession?.user && userRef.current === null) {
        setUser(minimalUserFromSession(latestSession))
      }
      setLoading(false)
    }, 7000)
    const finish = () => { if (mounted) { clearTimeout(safety); setLoading(false) } }

    // Applica sessione + profilo. Il fetch del profilo (query DB) va tenuto FUORI
    // dal callback di onAuthStateChange: il client GoTrue tiene un lock durante il
    // callback e chiamare supabase.from() lì dentro provoca un DEADLOCK (query mai
    // risolta → lock mai rilasciato → tutta l'auth si blocca → "caricamento
    // infinito", pure il login successivo si impianta). Perciò lì deferiamo.
    const applySession = async (session: Session | null) => {
      latestSession = session
      // Authorize the realtime socket with the user's JWT so RLS-protected
      // postgres_changes (chat messages/reactions) are delivered live.
      supabase.realtime.setAuth(session?.access_token ?? null)

      if (!session?.user) {
        // Sessione REALMENTE assente (logout / storage vuoto) → login legittimo.
        // Diagnostica: registra il MOMENTO in cui la sessione diventa null e se è
        // stato un logout VOLONTARIO (nostro signOut) o INVOLONTARIO (refresh
        // fallito / storage svuotato) — insieme a chi era loggato prima.
        logAuthEvent('session_became_null', {
          explicit: wasExplicitSignOut(),
          hadUserBefore: !!userRef.current,
          prevUserId: userRef.current?.id ?? null,
        })
        if (mounted) setUser(null)
        finish()
        return
      }

      // Se siamo già dentro (es. refresh token in background durante l'uso),
      // sblocca subito la UI: nessuno spinner e nessun rischio di logout su un
      // semplice refresh.
      if (userRef.current) finish()

      // Ritenta il profilo con backoff: al risveglio/rete lenta la prima query può
      // fallire o andare in timeout. Con una sessione valida NON si slogga MAI.
      for (let attempt = 0; mounted && attempt < 6; attempt++) {
        const profile = await fetchProfile(session.user.id)
        // Se nel frattempo la sessione è cambiata (nuovo refresh) o è arrivato un
        // logout, abbandona: un loop "vecchio" non deve riscrivere lo stato.
        if (!mounted || latestSession !== session) return
        if (profile) { setUser(profile); finish(); return }
        // Dopo un paio di tentativi a vuoto entra comunque con un profilo minimo,
        // così l'app è subito utilizzabile; i tentativi proseguono e lo rimpiazzano
        // col profilo reale appena la rete risponde.
        if (attempt >= 1) { setUser(prev => prev ?? minimalUserFromSession(session)); finish() }
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        if (!mounted || latestSession !== session) return
      }
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      // getSession può fallire/rifiutare su mobile: procedi come non loggato,
      // ma NON lasciare mai il loading appeso.
      .catch(() => finish())

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Diagnostica logout intermittenti: registra OGNI evento auth col tipo
      // (SIGNED_OUT/TOKEN_REFRESHED/SIGNED_IN/INITIAL_SESSION/USER_UPDATED) e
      // l'expiry residuo. Un SIGNED_OUT che NON è un nostro logout esplicito è la
      // firma del logout involontario. NB: solo scrittura in localStorage, niente
      // chiamate Supabase qui dentro (il callback tiene il lock del client).
      logAuthEvent('onAuthStateChange', {
        event,
        hasSession: !!session?.user,
        expiresIn: expiresInSeconds(session),
        explicit: event === 'SIGNED_OUT' ? wasExplicitSignOut() : undefined,
      })
      // L'utente è entrato da un link "password dimenticata" → l'app deve
      // mostrargli solo la schermata "nuova password" (vedi AppRouter). Questo è
      // l'UNICO evento (oltre al token nell'URL) che abilita il form: lo marchiamo
      // durevole così sopravvive a un reload della pagina.
      if (event === 'PASSWORD_RECOVERY' && mounted) {
        markRecoveryActive()
        setRecoveryMode(true)
        setRecoveryActive(true)
      }
      // setTimeout(0): esce dal callback (rilascia il lock del client) PRIMA di
      // toccare il DB → evita il deadlock del caricamento infinito.
      setTimeout(() => { if (mounted) applySession(session) }, 0)
    })

    return () => { mounted = false; clearTimeout(safety); subscription.unsubscribe() }
  }, [])

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    setJustLoggedIn(true)
    recordAccess() // registra IP/geo dell'accesso (fire & forget)
    return { error: null }
  }

  const signup = async (email: string, password: string, name: string, phone: string): Promise<{ error: string | null }> => {
    // `phone` finisce nei user_metadata: il trigger handle_new_user lo salva in
    // profiles_private (tabella riservata, leggibile solo da self+admin).
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone: phone.trim(), role: 'student' } },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  const logout = async () => {
    markExplicitSignOut() // così la strumentazione sa che il SIGNED_OUT è VOLUTO
    await supabase.auth.signOut()
    setUser(null)
  }

  const changePassword = async (current: string, next: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Non autenticato' }
    // Verifica la password attuale ri-autenticando (updateUser non la controlla).
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (reauthErr) return { error: 'La password attuale non è corretta' }
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) return { error: error.message }
    return { error: null }
  }

  // "Password dimenticata": Supabase manda un'email con un link a /reset-password.
  // NB: la risposta è volutamente identica sia che l'email esista sia che non
  // esista (Supabase non rivela quali indirizzi sono registrati) → il messaggio
  // mostrato all'utente deve restare neutro.
  const requestPasswordReset = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: passwordResetRedirectUrl(),
    })
    if (error) return { error: friendlyAuthError(error.message) }
    return { error: null }
  }

  // Imposta la nuova password. Funziona perché il link di recupero ha già creato
  // una sessione (quella "di recovery"): updateUser la usa per autenticarsi.
  const completePasswordReset = async (next: string): Promise<{ error: string | null }> => {
    // Difesa in profondità: cambiare password QUI (senza la password attuale) è
    // lecito SOLO dentro un flusso di recupero genuino. Una sessione normale deve
    // passare da changePassword (che ri-autentica). Il flag è impostato solo da un
    // vero token / evento PASSWORD_RECOVERY.
    if (!isRecoveryActive()) {
      return { error: 'Sessione di recupero non valida. Richiedi un nuovo link.' }
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Il link di recupero è scaduto o è già stato usato. Richiedine uno nuovo.' }
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) return { error: friendlyAuthError(error.message) }
    // Password impostata: usciamo dalla modalità recupero e l'utente prosegue
    // nell'app già autenticato con la sessione appena aggiornata.
    clearRecoveryActive()
    setRecoveryActive(false)
    setRecoveryMode(false)
    recordAccess()
    return { error: null }
  }

  // Annulla il recupero: la sessione di recovery va chiusa, altrimenti si
  // resterebbe loggati con un link email (che è di fatto una credenziale usa e getta).
  const cancelPasswordReset = async () => {
    clearRecoveryActive()
    setRecoveryActive(false)
    setRecoveryMode(false)
    markExplicitSignOut()
    await supabase.auth.signOut().catch(() => {/* nessuna sessione: va bene così */})
    setUser(null)
  }

  // Cancellazione account self-service (obbligo App Store): elimina il PROPRIO
  // account via edge function (verifica il JWT lato server), poi chiude la sessione.
  const deleteAccount = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Non autenticato' }
    // Token FRESCO prima dell'invoke: dopo la migrazione a chiavi JWT asimmetriche
    // la sessione in cache può essere firmata con la vecchia chiave → l'edge
    // function la rifiuta ("Token non valido"). refreshSession la rigenera.
    const { error: refreshErr } = await supabase.auth.refreshSession()
    if (refreshErr) return { error: 'Sessione scaduta. Rifai il login.' }
    const { data, error } = await supabase.functions.invoke('delete-own-account', { body: {} })
    if (error) return { error: error.message || "Errore durante l'eliminazione dell'account" }
    if (data && (data as { error?: string }).error) return { error: (data as { error: string }).error }
    markExplicitSignOut() // SIGNED_OUT voluto
    await supabase.auth.signOut().catch(() => {/* sessione già invalidata lato server */})
    setUser(null)
    return { error: null }
  }

  const updateProfile = async (data: ProfileUpdate) => {
    if (!user) return

    const updates: Record<string, unknown> = {}
    if (data.name) updates.name = data.name
    if (data.avatarPreset !== undefined) updates.avatar_preset = data.avatarPreset
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl

    await supabase.from('profiles').update(updates).eq('id', user.id)
    setUser(prev => prev ? { ...prev, ...data } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, changePassword, requestPasswordReset, completePasswordReset, cancelPasswordReset, recoveryMode, recoveryActive, recoveryError, deleteAccount, isAuthenticated: !!user, loading, justLoggedIn, clearJustLoggedIn: () => setJustLoggedIn(false) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
