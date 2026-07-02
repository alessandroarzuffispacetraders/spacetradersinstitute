export type UserRole = 'student' | 'coach' | 'mental_coach' | 'admin'

export type StudentStatus = 'active' | 'pending' | 'expired' | 'blocked'

// Piano dello studente: 'full' = pagante (accesso completo), 'free' = utente
// gratuito (solo contenuti in vetrina). Ortogonale a StudentStatus.
export type UserTier = 'full' | 'free'

export type StudentPhase = 'onboarding' | 'build' | 'test' | 'deploy'

export interface UserPermissions {
  canGoLive?: boolean
  canUploadContent?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole            // primary role
  roles?: UserRole[]        // all roles (multi-role users, e.g. admin+coach)
  avatarPreset?: string
  avatarUrl?: string
  status?: StudentStatus
  tier?: UserTier           // 'free' = utente gratuito; assente/full = pagante
  phase?: StudentPhase
  permissions?: UserPermissions
  assignedCoachId?: string | null
  assignedMentalCoachId?: string | null
}

export interface NavItem {
  label: string
  path: string
  icon: string
}
