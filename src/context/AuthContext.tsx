import { createContext, useContext, useState, ReactNode } from 'react'
import { User, UserRole } from '../types'

type ProfileUpdate = Partial<Pick<User, 'name' | 'avatarPreset' | 'avatarUrl'>>

const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Marco Rossi',
    email: 'studente@ist.com',
    role: 'student',
    status: 'active',
    phase: 'build',
    avatarPreset: 'blue',
  },
  {
    id: '2',
    name: 'Laura Bianchi',
    email: 'coach@ist.com',
    role: 'coach',
    avatarPreset: 'purple',
  },
  {
    id: '3',
    name: 'Sofia Verdi',
    email: 'mentalcoach@ist.com',
    role: 'mental_coach',
    avatarPreset: 'green',
  },
  {
    id: '4',
    name: 'Admin IST',
    email: 'admin@ist.com',
    role: 'admin',
    roles: ['admin', 'coach'],
    avatarPreset: 'gold',
  },
]

interface AuthContextType {
  user: User | null
  login: (role: UserRole) => void
  logout: () => void
  updateProfile: (data: ProfileUpdate) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = (role: UserRole) => {
    const mockUser = MOCK_USERS.find(u => u.role === role)
    if (mockUser) setUser(mockUser)
  }

  const logout = () => setUser(null)

  const updateProfile = (data: ProfileUpdate) => {
    setUser(prev => prev ? { ...prev, ...data } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
