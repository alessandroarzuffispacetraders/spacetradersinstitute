import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '../types'

type ProfileUpdate = Partial<Pick<User, 'name' | 'avatarPreset' | 'avatarUrl'>>

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: string | null }>
  signup: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  updateProfile: (data: ProfileUpdate) => Promise<void>
  changePassword: (current: string, next: string) => Promise<{ error: string | null }>
  isAuthenticated: boolean
  loading: boolean
  justLoggedIn: boolean
  clearJustLoggedIn: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Authorize the realtime socket with the user's JWT so RLS-protected
      // postgres_changes (chat messages/reactions) are delivered live.
      supabase.realtime.setAuth(session?.access_token ?? null)
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      supabase.realtime.setAuth(session?.access_token ?? null)
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    setJustLoggedIn(true)
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
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, changePassword, isAuthenticated: !!user, loading, justLoggedIn, clearJustLoggedIn: () => setJustLoggedIn(false) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
