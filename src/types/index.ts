export type UserRole = 'student' | 'coach' | 'mental_coach' | 'admin'

export type StudentStatus = 'active' | 'pending' | 'expired' | 'blocked'

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
