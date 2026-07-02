import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// URL del questionario di onboarding (esterno). Override via env se serve.
export const QUESTIONNAIRE_URL =
  (import.meta.env.VITE_ONBOARDING_URL as string | undefined)?.trim() ||
  'https://protocoldatajournal.com/student-onboarding'

const WELCOME_KEY = 'welcome_video_url'
// Video di benvenuto dedicato agli utenti gratuiti (lo vedono solo loro).
const WELCOME_FREE_KEY = 'welcome_video_free_url'
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

// Legge entrambi i video (completo + gratuito) in una sola query.
// Il componente sceglie quale mostrare in base al tier dell'utente.
export function useWelcomeVideo() {
  const [fullUrl, setFullUrl] = useState<string | null>(null)
  const [freeUrl, setFreeUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.from('app_settings').select('key,value').in('key', [WELCOME_KEY, WELCOME_FREE_KEY]).then(({ data }) => {
      if (!active) return
      const rows = (data as { key: string; value: string | null }[] | null) ?? []
      const pick = (k: string) => rows.find(r => r.key === k)?.value?.trim() || null
      setFullUrl(pick(WELCOME_KEY))
      setFreeUrl(pick(WELCOME_FREE_KEY))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { fullUrl, freeUrl, loading }
}

// ─── Admin: imposta il link del video di benvenuto (completo o gratuito) ─────────

export function useWelcomeVideoAdmin(free = false) {
  const key = free ? WELCOME_FREE_KEY : WELCOME_KEY
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
    setUrl((data as { value: string | null } | null)?.value ?? '')
    setLoading(false)
  }, [key])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (value: string): Promise<boolean> => {
    const { error } = await supabase.from('app_settings').upsert(
      { key, value: value.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    if (!error) await load()
    return !error
  }, [key, load])

  return { url, loading, save, reload: load }
}
