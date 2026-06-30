import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { StudentPhase } from '../types'

// ─── Definizione del percorso (fasi + passi) ────────────────────────────────────
// Le `key` dei passi sono stabili: sono ciò che viene salvato in path_steps.

export interface PathStepDef { key: string; label: string }
export interface PathPhaseDef { id: StudentPhase; label: string; icon: string; steps: PathStepDef[] }

export const PATH_PHASES: PathPhaseDef[] = [
  {
    id: 'onboarding', label: 'Fase 1 — Onboarding', icon: '🚀',
    steps: [
      { key: 'onboarding.profilo', label: 'Completa il profilo' },
      { key: 'onboarding.benvenuto', label: 'Video di benvenuto' },
      { key: 'onboarding.prima-sessione', label: 'Prima sessione con il Coach' },
      { key: 'onboarding.setup', label: 'Setup strumenti di trading' },
    ],
  },
  {
    id: 'build', label: 'Fase 2 — Build', icon: '🔨',
    steps: [
      { key: 'build.modulo1', label: 'Modulo 1: Fondamenta' },
      { key: 'build.modulo2', label: 'Modulo 2: Analisi Tecnica' },
      { key: 'build.modulo3', label: 'Modulo 3: Risk Management' },
      { key: 'build.modulo4', label: 'Modulo 4: Psicologia del Trading' },
      { key: 'build.mental1', label: 'Sessione Mental Coach #1' },
    ],
  },
  {
    id: 'test', label: 'Fase 3 — Test', icon: '🧪',
    steps: [
      { key: 'test.demo30', label: '30 trade in demo documentati' },
      { key: 'test.review', label: 'Review con il Coach' },
      { key: 'test.mental2', label: 'Sessione Mental Coach #2' },
      { key: 'test.performance', label: 'Analisi performance' },
    ],
  },
  {
    id: 'deploy', label: 'Fase 4 — Deploy', icon: '🎯',
    steps: [
      { key: 'deploy.live1', label: 'Prima settimana in live' },
      { key: 'deploy.report', label: 'Report settimanale' },
      { key: 'deploy.finale', label: 'Sessione finale con Coach' },
      { key: 'deploy.certificazione', label: 'Certificazione IST' },
    ],
  },
]

export const PHASE_ORDER: StudentPhase[] = ['onboarding', 'build', 'test', 'deploy']

export type PhaseStatus = 'completed' | 'active' | 'locked'

export interface PathStep extends PathStepDef { done: boolean }
export interface PathPhase {
  id: StudentPhase; label: string; icon: string
  status: PhaseStatus; steps: PathStep[]
}

// Costruisce le fasi con stato (completata/in corso/bloccata) e passi spuntati.
function buildPhases(current: StudentPhase, doneKeys: Set<string>): PathPhase[] {
  const curIdx = PHASE_ORDER.indexOf(current)
  return PATH_PHASES.map(p => {
    const idx = PHASE_ORDER.indexOf(p.id)
    const status: PhaseStatus = idx < curIdx ? 'completed' : idx === curIdx ? 'active' : 'locked'
    return {
      id: p.id, label: p.label, icon: p.icon, status,
      steps: p.steps.map(s => ({ ...s, done: doneKeys.has(s.key) })),
    }
  })
}

// ─── Hook: legge fase + passi di uno studente, con mutazioni (per coach/admin) ──

export function usePath(userId: string) {
  const [phase, setPhase] = useState<StudentPhase>('onboarding')
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const [profRes, stepsRes] = await Promise.all([
      supabase.from('profiles').select('phase').eq('id', userId).maybeSingle(),
      supabase.from('path_steps').select('step_key').eq('user_id', userId),
    ])
    setPhase(((profRes.data?.phase as StudentPhase) ?? 'onboarding'))
    setDoneKeys(new Set((stepsRes.data ?? []).map(r => r.step_key as string)))
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // Imposta la fase attuale (coach assegnato o admin per RLS/trigger).
  const setStudentPhase = useCallback(async (next: StudentPhase): Promise<boolean> => {
    const { error } = await supabase.from('profiles').update({ phase: next }).eq('id', userId)
    if (error) return false
    setPhase(next)
    return true
  }, [userId])

  // Spunta/despunta un passo.
  const toggleStep = useCallback(async (stepKey: string, done: boolean): Promise<boolean> => {
    if (done) {
      const { error } = await supabase.from('path_steps')
        .upsert({ user_id: userId, step_key: stepKey }, { onConflict: 'user_id,step_key' })
      if (error) return false
      setDoneKeys(prev => new Set(prev).add(stepKey))
    } else {
      const { error } = await supabase.from('path_steps')
        .delete().eq('user_id', userId).eq('step_key', stepKey)
      if (error) return false
      setDoneKeys(prev => { const n = new Set(prev); n.delete(stepKey); return n })
    }
    return true
  }, [userId])

  return {
    phase,
    phases: buildPhases(phase, doneKeys),
    loading,
    reload: load,
    setStudentPhase,
    toggleStep,
  }
}
