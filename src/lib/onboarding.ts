import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// URL del questionario di onboarding (esterno). Override via env se serve.
export const QUESTIONNAIRE_URL =
  (import.meta.env.VITE_ONBOARDING_URL as string | undefined)?.trim() ||
  'https://protocoldatajournal.com/student-onboarding'

const WELCOME_KEY = 'welcome_video_url'
// Giorni per cui il video di benvenuto resta in home dopo la registrazione.
export const WELCOME_WINDOW_DAYS = 7

// ─── Studente: stato dei "primi passi" (questionario + tour) ────────────────────

export function useOnboarding(userId: string) {
  const [questionnaireDone, setQuestionnaireDone] = useState(false)
  const [tutorialDone, setTutorialDone] = useState(false)
  const [tutorialPrompted, setTutorialPrompted] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('student_onboarding')
      .select('questionnaire_done,tutorial_done,tutorial_prompted')
      .eq('user_id', userId)
      .maybeSingle()
    const ob = data as { questionnaire_done: boolean; tutorial_done: boolean; tutorial_prompted: boolean } | null
    setQuestionnaireDone(ob?.questionnaire_done ?? false)
    setTutorialDone(ob?.tutorial_done ?? false)
    setTutorialPrompted(ob?.tutorial_prompted ?? false)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const setFlag = useCallback(async (
    patch: Partial<{ questionnaire_done: boolean; tutorial_done: boolean; tutorial_prompted: boolean }>,
  ) => {
    if (!userId) return
    if (patch.questionnaire_done !== undefined) setQuestionnaireDone(patch.questionnaire_done)
    if (patch.tutorial_done !== undefined) setTutorialDone(patch.tutorial_done)
    if (patch.tutorial_prompted !== undefined) setTutorialPrompted(patch.tutorial_prompted)
    await supabase.from('student_onboarding').upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  }, [userId])

  const setQuestionnaire = useCallback((done: boolean) => setFlag({ questionnaire_done: done }), [setFlag])
  const markTutorialDone = useCallback(() => setFlag({ tutorial_done: true }), [setFlag])
  const markTutorialPrompted = useCallback(() => setFlag({ tutorial_prompted: true }), [setFlag])

  const allDone = questionnaireDone && tutorialDone

  return {
    questionnaireDone, tutorialDone, tutorialPrompted,
    allDone, loading,
    setQuestionnaire, markTutorialDone, markTutorialPrompted, reload: load,
  }
}

// ─── Video di benvenuto (impostato dall'admin, link diretto) ────────────────────

export function useWelcomeVideo() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.from('app_settings').select('value').eq('key', WELCOME_KEY).maybeSingle().then(({ data }) => {
      if (!active) return
      setUrl((data as { value: string | null } | null)?.value?.trim() || null)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { url, loading }
}

// ─── Admin: imposta il link del video di benvenuto ──────────────────────────────

export function useWelcomeVideoAdmin() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', WELCOME_KEY).maybeSingle()
    setUrl((data as { value: string | null } | null)?.value ?? '')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (value: string): Promise<boolean> => {
    const { error } = await supabase.from('app_settings').upsert(
      { key: WELCOME_KEY, value: value.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    if (!error) await load()
    return !error
  }, [load])

  return { url, loading, save, reload: load }
}
