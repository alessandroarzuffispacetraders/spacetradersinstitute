import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// URL del questionario di onboarding (esterno). Override via env se serve.
export const QUESTIONNAIRE_URL =
  (import.meta.env.VITE_ONBOARDING_URL as string | undefined)?.trim() ||
  'https://protocoldatajournal.com/student-onboarding'

export interface WelcomeLesson { id: string; title: string; vimeoId: string | null }

// ─── Studente: stato dei "primi passi" (self-service) ───────────────────────────

export function useOnboarding(userId: string) {
  const [welcomeSeen, setWelcomeSeen] = useState(false)
  const [questionnaireDone, setQuestionnaireDone] = useState(false)
  const [tutorialDone, setTutorialDone] = useState(false)
  const [welcome, setWelcome] = useState<WelcomeLesson | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const [obRes, wlRes] = await Promise.all([
      supabase.from('student_onboarding').select('welcome_seen,questionnaire_done,tutorial_done').eq('user_id', userId).maybeSingle(),
      supabase.from('lessons').select('id,title,vimeo_id').eq('is_welcome', true).maybeSingle(),
    ])
    const ob = obRes.data as { welcome_seen: boolean; questionnaire_done: boolean; tutorial_done: boolean } | null
    setWelcomeSeen(ob?.welcome_seen ?? false)
    setQuestionnaireDone(ob?.questionnaire_done ?? false)
    setTutorialDone(ob?.tutorial_done ?? false)
    const wl = wlRes.data as { id: string; title: string; vimeo_id: string | null } | null
    setWelcome(wl ? { id: wl.id, title: wl.title, vimeoId: wl.vimeo_id } : null)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const setFlag = useCallback(async (
    patch: Partial<{ welcome_seen: boolean; questionnaire_done: boolean; tutorial_done: boolean }>,
  ) => {
    if (!userId) return
    if (patch.welcome_seen !== undefined) setWelcomeSeen(patch.welcome_seen)
    if (patch.questionnaire_done !== undefined) setQuestionnaireDone(patch.questionnaire_done)
    if (patch.tutorial_done !== undefined) setTutorialDone(patch.tutorial_done)
    await supabase.from('student_onboarding').upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  }, [userId])

  const markWelcomeSeen = useCallback(() => setFlag({ welcome_seen: true }), [setFlag])
  const setQuestionnaire = useCallback((done: boolean) => setFlag({ questionnaire_done: done }), [setFlag])
  const markTutorialDone = useCallback(() => setFlag({ tutorial_done: true }), [setFlag])

  // Se non c'è un video di benvenuto configurato, quel passo è auto-soddisfatto.
  const welcomeStepDone = welcome ? welcomeSeen : true
  const allDone = welcomeStepDone && questionnaireDone && tutorialDone

  return {
    welcome, welcomeSeen, questionnaireDone, tutorialDone,
    allDone, loading,
    markWelcomeSeen, setQuestionnaire, markTutorialDone, reload: load,
  }
}

// ─── Admin: scelta della lezione "video di benvenuto" ───────────────────────────

export interface AdminLessonOpt { id: string; title: string; is_welcome: boolean }

export function useWelcomeLessonAdmin() {
  const [lessons, setLessons] = useState<AdminLessonOpt[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('lessons').select('id,title,is_welcome').order('title')
    setLessons((data as AdminLessonOpt[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const currentId = lessons.find(l => l.is_welcome)?.id ?? ''

  // Solo una lezione può essere "benvenuto": azzera tutte, poi setta la scelta.
  const setWelcome = useCallback(async (lessonId: string): Promise<boolean> => {
    const clear = await supabase.from('lessons').update({ is_welcome: false }).eq('is_welcome', true)
    if (clear.error) return false
    if (lessonId) {
      const set = await supabase.from('lessons').update({ is_welcome: true }).eq('id', lessonId)
      if (set.error) return false
    }
    await load()
    return true
  }, [load])

  return { lessons, currentId, loading, setWelcome, reload: load }
}
