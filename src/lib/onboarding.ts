import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const WELCOME_KEY = 'welcome_video_url'
// Video di benvenuto dedicato agli utenti gratuiti (lo vedono solo loro).
const WELCOME_FREE_KEY = 'welcome_video_free_url'
// Giorni per cui il video di benvenuto resta in home dopo la registrazione.
export const WELCOME_WINDOW_DAYS = 7

// ─── Studente: stato dei "primi passi" (tour della piattaforma) ─────────────────
// Il questionario di onboarding non si usa più: resta solo il tour.

export function useOnboarding(userId: string) {
  const [tutorialDone, setTutorialDone] = useState(false)
  const [tutorialPrompted, setTutorialPrompted] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('student_onboarding')
      .select('tutorial_done,tutorial_prompted')
      .eq('user_id', userId)
      .maybeSingle()
    const ob = data as { tutorial_done: boolean; tutorial_prompted: boolean } | null
    setTutorialDone(ob?.tutorial_done ?? false)
    setTutorialPrompted(ob?.tutorial_prompted ?? false)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const setFlag = useCallback(async (patch: Partial<{ tutorial_done: boolean; tutorial_prompted: boolean }>) => {
    if (!userId) return
    if (patch.tutorial_done !== undefined) setTutorialDone(patch.tutorial_done)
    if (patch.tutorial_prompted !== undefined) setTutorialPrompted(patch.tutorial_prompted)
    await supabase.from('student_onboarding').upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  }, [userId])

  const markTutorialDone = useCallback(() => setFlag({ tutorial_done: true }), [setFlag])
  const markTutorialPrompted = useCallback(() => setFlag({ tutorial_prompted: true }), [setFlag])

  return {
    tutorialDone, tutorialPrompted, allDone: tutorialDone, loading,
    markTutorialDone, markTutorialPrompted, reload: load,
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

// Il video di benvenuto da mostrare in Home: solo nei primi WELCOME_WINDOW_DAYS
// giorni dalla registrazione; i gratuiti vedono il loro (mai su iOS, dove
// l'invito al percorso completo non è ammesso: vedi upsellSuppressed).
export function welcomeVideoFor(
  v: { fullUrl: string | null; freeUrl: string | null; loading: boolean },
  registeredAt: string | null, isFree: boolean, upsellBlocked: boolean,
): string | null {
  if (v.loading || !registeredAt) return null
  if (isFree && upsellBlocked) return null
  const days = (Date.now() - new Date(registeredAt).getTime()) / 86_400_000
  if (!Number.isFinite(days) || days >= WELCOME_WINDOW_DAYS) return null
  return (isFree ? v.freeUrl : v.fullUrl) || null
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
