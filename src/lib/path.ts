import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { StudentPhase } from '../types'
import { useIsPreview } from './previewMode'

// Dati FINTI per l'anteprima (vedi previewMode). Percorso in fase Build.
const PREVIEW_DEFS: RawStepDef[] = [
  { id: 'pv1', phase: 'onboarding', step_key: 'onboarding.1', label: 'Setup account e piattaforma', position: 0 },
  { id: 'pv2', phase: 'onboarding', step_key: 'onboarding.2', label: 'Prima call con il coach', position: 1 },
  { id: 'pv3', phase: 'onboarding', step_key: 'onboarding.3', label: 'Definizione obiettivi 90 giorni', position: 2 },
  { id: 'pv4', phase: 'build', step_key: 'build.1', label: 'Piano di trading personale', position: 0 },
  { id: 'pv5', phase: 'build', step_key: 'build.2', label: 'Regole di risk management', position: 1 },
  { id: 'pv6', phase: 'build', step_key: 'build.3', label: 'Backtest della strategia', position: 2 },
  { id: 'pv7', phase: 'build', step_key: 'build.4', label: 'Journaling quotidiano', position: 3 },
  { id: 'pv8', phase: 'build', step_key: 'build.5', label: 'Review settimanale col coach', position: 4 },
]
const PREVIEW_DONE = new Set(['onboarding.1', 'onboarding.2', 'onboarding.3', 'build.1', 'build.2'])

// ─── Fasi fisse (metadata) ──────────────────────────────────────────────────────
// Le 4 fasi sono strutturali (mappano profiles.phase). Gli STEP dentro ogni fase
// sono invece personalizzabili dall'admin (tabella path_step_defs).

export const PHASE_ORDER: StudentPhase[] = ['onboarding', 'build', 'test', 'deploy']

export const PHASE_META: Record<StudentPhase, { label: string; icon: string }> = {
  onboarding: { label: 'Fase 1 — Onboarding', icon: '🚀' },
  build:      { label: 'Fase 2 — Build',      icon: '🔨' },
  test:       { label: 'Fase 3 — Test',       icon: '🧪' },
  deploy:     { label: 'Fase 4 — Deploy',     icon: '🎯' },
}

export type PhaseStatus = 'completed' | 'active' | 'locked'

export interface PathStep { key: string; label: string; done: boolean }
export interface PathPhase {
  id: StudentPhase; label: string; icon: string
  status: PhaseStatus; steps: PathStep[]
}

interface RawStepDef { id: string; phase: StudentPhase; step_key: string; label: string; position: number }

// Costruisce le fasi con stato (completata/in corso/bloccata) e passi (dal DB) spuntati.
function buildPhases(current: StudentPhase, doneKeys: Set<string>, defs: RawStepDef[]): PathPhase[] {
  const curIdx = PHASE_ORDER.indexOf(current)
  return PHASE_ORDER.map(id => {
    const idx = PHASE_ORDER.indexOf(id)
    const status: PhaseStatus = idx < curIdx ? 'completed' : idx === curIdx ? 'active' : 'locked'
    const steps = defs
      .filter(d => d.phase === id)
      .sort((a, b) => a.position - b.position)
      .map(d => ({ key: d.step_key, label: d.label, done: doneKeys.has(d.step_key) }))
    return { id, label: PHASE_META[id].label, icon: PHASE_META[id].icon, status, steps }
  })
}

// ─── Hook: legge fase + passi di uno studente, con mutazioni (per coach/admin) ──

export function usePath(userId: string) {
  const preview = useIsPreview()
  const [phase, setPhase] = useState<StudentPhase>(preview ? 'build' : 'onboarding')
  const [doneKeys, setDoneKeys] = useState<Set<string>>(preview ? PREVIEW_DONE : new Set())
  const [defs, setDefs] = useState<RawStepDef[]>(preview ? PREVIEW_DEFS : [])
  const [loading, setLoading] = useState(!preview)

  const load = useCallback(async () => {
    if (preview) return
    if (!userId) { setLoading(false); return }
    setLoading(true)
    const [profRes, stepsRes, defsRes] = await Promise.all([
      supabase.from('profiles').select('phase').eq('id', userId).maybeSingle(),
      supabase.from('path_steps').select('step_key').eq('user_id', userId),
      supabase.from('path_step_defs').select('id,phase,step_key,label,position').order('position'),
    ])
    setPhase(((profRes.data?.phase as StudentPhase) ?? 'onboarding'))
    setDoneKeys(new Set((stepsRes.data ?? []).map(r => r.step_key as string)))
    setDefs((defsRes.data as RawStepDef[]) ?? [])
    setLoading(false)
  }, [userId, preview])

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
    phases: buildPhases(phase, doneKeys, defs),
    loading,
    reload: load,
    setStudentPhase,
    toggleStep,
  }
}

// ─── Admin: CRUD degli step del percorso ────────────────────────────────────────

export interface AdminPathStep { id: string; phase: StudentPhase; step_key: string; label: string; position: number }

export function usePathAdmin() {
  const [steps, setSteps] = useState<AdminPathStep[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('path_step_defs')
      .select('id,phase,step_key,label,position').order('position')
    setSteps((data as AdminPathStep[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addStep = useCallback(async (phase: StudentPhase, label: string): Promise<boolean> => {
    const l = label.trim()
    if (!l) return false
    const position = steps.filter(s => s.phase === phase).length
    const step_key = `${phase}.${crypto.randomUUID().slice(0, 8)}`
    const { error } = await supabase.from('path_step_defs').insert({ phase, step_key, label: l, position })
    if (!error) await load()
    return !error
  }, [steps, load])

  const updateStep = useCallback(async (id: string, label: string): Promise<boolean> => {
    const l = label.trim()
    if (!l) return false
    const { error } = await supabase.from('path_step_defs').update({ label: l }).eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  const deleteStep = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('path_step_defs').delete().eq('id', id)
    if (!error) await load()
    return !error
  }, [load])

  // Sposta lo step su/giù scambiando la position con l'adiacente nella stessa fase.
  const moveStep = useCallback(async (id: string, dir: 'up' | 'down'): Promise<boolean> => {
    const step = steps.find(s => s.id === id)
    if (!step) return false
    const siblings = steps.filter(s => s.phase === step.phase).sort((a, b) => a.position - b.position)
    const idx = siblings.findIndex(s => s.id === id)
    const swapWith = dir === 'up' ? siblings[idx - 1] : siblings[idx + 1]
    if (!swapWith) return false
    const { error: e1 } = await supabase.from('path_step_defs').update({ position: swapWith.position }).eq('id', step.id)
    const { error: e2 } = await supabase.from('path_step_defs').update({ position: step.position }).eq('id', swapWith.id)
    if (!e1 && !e2) await load()
    return !e1 && !e2
  }, [steps, load])

  return { steps, loading, addStep, updateStep, deleteStep, moveStep, reload: load }
}
