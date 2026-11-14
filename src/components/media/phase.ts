import { BookOpen, Compass, Layers, Rocket, Target, type LucideIcon } from 'lucide-react'

// Icona per fase del percorso (Onboarding → Build → Test → Deploy).
const PHASE_ICON: Record<string, LucideIcon> = {
  Onboarding: Compass, Build: Layers, Test: Target, Deploy: Rocket,
}

export function phaseIcon(phase: string): LucideIcon {
  return PHASE_ICON[phase] ?? BookOpen
}
