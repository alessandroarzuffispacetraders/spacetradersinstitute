import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { User } from '../types'
import { recordAccess } from '../lib/accessLog'

type ProfileUpdate = Partial<Pick<User, 'name' | 'avatarPreset' | 'avatarUrl'>>

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: string | null }>
  signup: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateProfile: (data: ProfileUpdate) => Promise<void>
  changePassword: (current: string, next: string) => Promise<{ error: string | null }>
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // true solo subito dopo un login esplicito → innesca l'animazione di ingresso.
  // NON viene settato su refresh/ripristino sessione.
  const [justLoggedIn, setJustLoggedIn] = useState(false)

  useEffect(() => {
    let mounted = true

    // Rete di sicurezza: se l'init auth si impianta (rete mobile instabile,
    // refresh token bloccato, storage inaccessibile in webview/incognito),
    // sblocca comunque la UI invece di restare sullo spinner all'infinito.
    const safety = setTimeout(() => { if (mounted) setLoading(false) }, 7000)
    const finish = () => { if (mounted) { clearTimeout(safety); setLoading(false) } }

    // Applica sessione + profilo. Il fetch del profilo (query DB) va tenuto FUORI
    // dal callback di onAuthStateChange: il client GoTrue tiene un lock durante il
    // callback e chiamare supabase.from() lì dentro provoca un DEADLOCK (query mai
    // risolta → lock mai rilasciato → tutta l'auth si blocca → "caricamento
    // infinito", pure il login successivo si impianta). Perciò lì deferiamo.
    const applySession = async (session: Session | null) => {
      // Authorize the realtime socket with the user's JWT so RLS-protected
      // postgres_changes (chat messages/reactions) are delivered live.
      supabase.realtime.setAuth(session?.access_token ?? null)
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        if (mounted) setUser(profile)
      } else if (mounted) {
        setUser(null)
      }
      finish()
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      // getSession può fallire/rifiutare su mobile: procedi come non loggato,
      // ma NON lasciare mai il loading appeso.
      .catch(() => finish())

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const signup = async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'student' } },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  const logout = async () => {
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

  // Cancellazione account self-service (obbligo App Store): elimina il PROPRIO
  // account via edge function (verifica il JWT lato server), poi chiude la sessione.
  const deleteAccount = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Non autenticato' }
    const { data, error } = await supabase.functions.invoke('delete-own-account', { body: {} })
    if (error) return { error: error.message || "Errore durante l'eliminazione dell'account" }
    if (data && (data as { error?: string }).error) return { error: (data as { error: string }).error }
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
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, changePassword, deleteAccount, isAuthenticated: !!user, loading, justLoggedIn, clearJustLoggedIn: () => setJustLoggedIn(false) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
