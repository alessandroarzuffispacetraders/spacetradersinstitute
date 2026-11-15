import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { Category, Lesson, useStudentCatalog } from './content'
import { useStudentSessions, MentalSession } from './coaching'
import { useWelcomeVideo } from './onboarding'
import { useIsPreview } from './previewMode'
import { StudentPhase } from '../types'

// ─── Percorso interattivo ─────────────────────────────────────────────────────
// Il percorso non lo imposta più il coach: si costruisce da solo, in ordine,
// da ciò che c'è da fare e si spunta man mano che lo studente lo fa.
//  • profilo completo (foto) e video di benvenuto
//  • i video di ogni sezione di corsi, nella sua fase (Onboarding → Deploy)
//  • i video del Mental Coach e le due sessioni col Mental Coach
//  • le attività scritte dall'admin (Admin → Programma) che non sono video:
//    le segna lo studente stesso quando le ha fatte
// La fase attuale è quella del primo passo ancora da fare.

export const JOURNEY_PHASES: { id: StudentPhase; label: string; tagline: string }[] = [
  { id: 'onboarding', label: 'Onboarding', tagline: 'Le basi: profilo, metodo quantitativo e piattaforma' },
  { id: 'build', label: 'Build', tagline: 'Costruisci la tua strategia' },
  { id: 'test', label: 'Test', tagline: 'Valida e ottimizza quello che hai costruito' },
  { id: 'deploy', label: 'Deploy', tagline: 'Porta il portfolio a mercato' },
]

export type StepKind = 'profile' | 'welcome' | 'videos' | 'session' | 'task'
export type StepAction =
  | { type: 'lesson'; lessonId: string }
  | { type: 'section'; categoryId: string }
  | { type: 'mental-chat' }
  | { type: 'profile' }
  | { type: 'welcome' }
  | { type: 'self-check' }

export interface JourneyStep {
  key: string
  kind: StepKind
  phase: StudentPhase
  title: string
  detail: string            // cosa fare, in una frase
  done: boolean
  progress: number          // 0..1
  doneCount?: number
  total?: number
  image?: string | null     // locandina/copertina (passi video)
  imageLight?: string | null
  action: StepAction
  cta: string               // testo del pulsante
  status?: string           // es. "Fissata per il 20 nov"
}

export interface JourneyPhase {
  id: StudentPhase
  label: string
  tagline: string
  steps: JourneyStep[]
  done: number
  total: number
  state: 'completed' | 'active' | 'upcoming'
}

export interface Journey {
  phases: JourneyPhase[]
  steps: JourneyStep[]
  next: JourneyStep | null
  phase: StudentPhase
  progress: number          // 0..100
  doneSteps: number
  totalSteps: number
}

interface TaskDef { phase: StudentPhase; step_key: string; label: string; position: number }

// Attività dell'admin già coperte da passi automatici (o non più usate).
const REPLACED: RegExp[] = [/questionari/i, /benvenuto/i, /profilo/i, /video.*mental|sezione mental/i, /sessione.*mental|mental.*sessione/i, /propedeutic/i]

// Per l'admin: questa attività è già un passo automatico del percorso?
export const isAutoStepLabel = (label: string) => REPLACED.some(r => r.test(label))

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

function lessonsOf(c: Category): Lesson[] {
  return c.courses.filter(co => co.published !== false).flatMap(co => co.lessons)
}

// Sezioni gemelle (stesso titolo, es. versione aperta + interna): una sola,
// quella con più lezioni viste.
function dedupe(cats: Category[]): Category[] {
  const by = new Map<string, Category>()
  for (const c of cats) {
    const k = c.title.trim().toLowerCase()
    const prev = by.get(k)
    const seen = (x: Category) => lessonsOf(x).filter(l => l.done).length
    if (!prev || seen(c) > seen(prev)) by.set(k, c)
  }
  return cats.filter(c => by.get(c.title.trim().toLowerCase()) === c)
}

function videoStep(c: Category, key: string, title: string): JourneyStep | null {
  const ls = lessonsOf(c)
  if (!ls.length) return null
  const doneCount = ls.filter(l => l.done).length
  const nextLesson = ls.find(l => !l.done)
  const started = doneCount > 0 || ls.some(l => l.lastPositionSeconds > 0)
  const i = nextLesson ? ls.indexOf(nextLesson) + 1 : ls.length
  return {
    key, kind: 'videos', phase: (c.phase || 'onboarding').toLowerCase() as StudentPhase,
    title, done: doneCount === ls.length, progress: doneCount / ls.length, doneCount, total: ls.length,
    detail: nextLesson ? `Lezione ${i} di ${ls.length}: «${nextLesson.title}»` : `Hai visto tutte le ${ls.length} lezioni`,
    image: c.posterUrl ?? nextLesson?.coverUrl ?? null, imageLight: c.posterUrlLight ?? null,
    action: nextLesson ? { type: 'lesson', lessonId: nextLesson.id } : { type: 'section', categoryId: c.id },
    cta: nextLesson ? (started ? 'Continua' : 'Inizia') : 'Rivedi',
  }
}

function sessionStep(n: 1 | 2, phase: StudentPhase, s: MentalSession | undefined, hasMental: boolean, image: string | null, imageLight: string | null): JourneyStep {
  const done = s?.status === 'completed' || s?.status === 'scheduled'
  const status = s?.status === 'completed' ? 'Completata' : s?.status === 'scheduled' && s.scheduled_at ? `Fissata per ${fmtDay(s.scheduled_at)}` : undefined
  return {
    key: `session.${n}`, kind: 'session', phase,
    title: n === 1 ? 'Organizza la prima sessione con il Mental Coach' : 'Organizza la seconda sessione con il Mental Coach',
    detail: done ? (status ?? 'Organizzata') : hasMental
      ? (n === 1 ? 'Scrivi al tuo Mental Coach e fissate la valutazione iniziale' : 'Scrivi al tuo Mental Coach e fissate il follow-up')
      : 'Il Mental Coach ti verrà assegnato a breve: poi potrai scrivergli da qui',
    done, progress: done ? 1 : 0, status, image, imageLight, action: { type: 'mental-chat' }, cta: done ? 'Scrivi' : 'Scrivi al Mental Coach',
  }
}

export function buildJourney(input: {
  categories: Category[]
  sessions: MentalSession[]
  hasPhoto: boolean
  hasWelcomeVideo: boolean
  doneKeys: Set<string>
  tasks: TaskDef[]
  hasMentalCoach: boolean
}): Journey {
  const { categories, sessions, hasPhoto, hasWelcomeVideo, doneKeys, tasks, hasMentalCoach } = input
  const trading = dedupe(categories.filter(c => c.section !== 'mental' && c.published !== false))
  const mental = categories.filter(c => c.section === 'mental' && c.published !== false)
  const ses = (n: number) => sessions.find(s => s.session_number === n)
  const mentalImg = mental[0]?.posterUrl ?? null, mentalImgLight = mental[0]?.posterUrlLight ?? null
  const keepTask = (t: TaskDef) => !REPLACED.some(r => r.test(t.label))
  const taskStep = (t: TaskDef): JourneyStep => {
    const done = doneKeys.has(t.step_key)
    return {
      key: t.step_key, kind: 'task', phase: t.phase, title: t.label,
      detail: done ? 'Fatto' : 'Quando l\'hai fatto, segnalo qui',
      done, progress: done ? 1 : 0, action: { type: 'self-check' }, cta: done ? 'Fatto' : 'Segna come fatto',
    }
  }
  const sectionsOf = (ph: StudentPhase) => trading
    .filter(c => (c.phase || 'onboarding').toLowerCase() === ph)
    .map(c => videoStep(c, `section.${c.id}`, `Guarda «${c.title}»`))
    .filter((s): s is JourneyStep => !!s)
  const tasksOf = (ph: StudentPhase) => tasks.filter(t => t.phase === ph && keepTask(t)).sort((a, b) => a.position - b.position).map(taskStep)

  const byPhase: Record<StudentPhase, JourneyStep[]> = { onboarding: [], build: [], test: [], deploy: [] }

  // Onboarding: profilo → benvenuto → video Mental Coach → 1ª sessione → sezioni → attività
  byPhase.onboarding.push({
    key: 'profile', kind: 'profile', phase: 'onboarding', title: 'Completa il profilo',
    detail: hasPhoto ? 'Fatto' : 'Aggiungi una foto e controlla i tuoi dati',
    done: hasPhoto, progress: hasPhoto ? 1 : 0, action: { type: 'profile' }, cta: hasPhoto ? 'Apri' : 'Completa il profilo',
  })
  if (hasWelcomeVideo) {
    const done = doneKeys.has('auto.welcome')
    byPhase.onboarding.push({
      key: 'auto.welcome', kind: 'welcome', phase: 'onboarding', title: 'Guarda il video di benvenuto',
      detail: done ? 'Visto' : 'Due minuti per capire come funziona il programma',
      done, progress: done ? 1 : 0, action: { type: 'welcome' }, cta: done ? 'Rivedi' : 'Guarda il video',
    })
  }
  for (const c of mental) {
    const s = videoStep(c, `section.${c.id}`, mental.length > 1 ? `Guarda «${c.title}»` : 'Guarda i video del Mental Coach')
    if (s) byPhase.onboarding.push({ ...s, phase: 'onboarding' })
  }
  byPhase.onboarding.push(sessionStep(1, 'onboarding', ses(1), hasMentalCoach, mentalImg, mentalImgLight))
  byPhase.onboarding.push(...sectionsOf('onboarding'), ...tasksOf('onboarding'))

  // Build: sezioni → attività → 2ª sessione col Mental Coach
  byPhase.build.push(...sectionsOf('build'), ...tasksOf('build'), sessionStep(2, 'build', ses(2), hasMentalCoach, mentalImg, mentalImgLight))
  byPhase.test.push(...sectionsOf('test'), ...tasksOf('test'))
  byPhase.deploy.push(...sectionsOf('deploy'), ...tasksOf('deploy'))

  const steps = JOURNEY_PHASES.flatMap(p => byPhase[p.id])
  const next = steps.find(s => !s.done) ?? null
  const current = next?.phase ?? 'deploy'
  const curIdx = JOURNEY_PHASES.findIndex(p => p.id === current)
  const phases: JourneyPhase[] = JOURNEY_PHASES.map((p, i) => {
    const st = byPhase[p.id]
    const done = st.filter(s => s.done).length
    return {
      ...p, steps: st, done, total: st.length,
      state: !next || i < curIdx ? 'completed' : i === curIdx ? 'active' : 'upcoming',
    }
  })
  const progress = steps.length ? Math.round((steps.reduce((a, s) => a + s.progress, 0) / steps.length) * 100) : 0
  return { phases, steps, next, phase: current, progress, doneSteps: steps.filter(s => s.done).length, totalSteps: steps.length }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Le attività spuntate dallo studente (e "video di benvenuto visto") stanno in
// path_steps; se il database non lo permette ancora (migrazione da applicare)
// restano salvate su questo dispositivo.

const LOCAL_KEY = (uid: string) => `ist-journey-done-${uid}`
function readLocal(uid: string): string[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY(uid)) || '[]') } catch { return [] }
}
function writeLocal(uid: string, keys: string[]) {
  try { localStorage.setItem(LOCAL_KEY(uid), JSON.stringify(keys)) } catch { /* ignore */ }
}

const PREVIEW_JOURNEY_TASKS: TaskDef[] = [
  { phase: 'test', step_key: 'pv.t1', label: 'Backtest', position: 0 },
  { phase: 'test', step_key: 'pv.t2', label: 'Ottimizzazione', position: 1 },
  { phase: 'deploy', step_key: 'pv.d1', label: 'Deploy del portfolio a mercato', position: 0 },
]

export function useJourney(userId: string, opts: { hasPhoto: boolean; hasMentalCoach: boolean }) {
  const preview = useIsPreview()
  const { categories, loading: catLoading } = useStudentCatalog(userId, 'all')
  const { sessions } = useStudentSessions(userId)
  const welcome = useWelcomeVideo()
  const [tasks, setTasks] = useState<TaskDef[]>(preview ? PREVIEW_JOURNEY_TASKS : [])
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(!preview)

  const load = useCallback(async () => {
    if (preview || !userId) { setLoading(false); return }
    const [defs, done] = await Promise.all([
      supabase.from('path_step_defs').select('phase,step_key,label,position').order('position'),
      supabase.from('path_steps').select('step_key').eq('user_id', userId),
    ])
    setTasks(((defs.data ?? []) as TaskDef[]))
    setDoneKeys(new Set([...((done.data ?? []) as { step_key: string }[]).map(r => r.step_key), ...readLocal(userId)]))
    setLoading(false)
  }, [userId, preview])
  useEffect(() => { void load() }, [load])

  // Segna/togli un'attività (o il video di benvenuto) come fatta.
  const setDone = useCallback(async (key: string, done: boolean) => {
    setDoneKeys(prev => { const n = new Set(prev); if (done) n.add(key); else n.delete(key); return n })
    if (!userId || preview) return
    const res = done
      ? await supabase.from('path_steps').upsert({ user_id: userId, step_key: key }, { onConflict: 'user_id,step_key' })
      : await supabase.from('path_steps').delete().eq('user_id', userId).eq('step_key', key)
    const local = new Set(readLocal(userId))
    if (res.error) { if (done) local.add(key); else local.delete(key) } else local.delete(key)
    writeLocal(userId, [...local])
  }, [userId, preview])

  const journey = useMemo(() => buildJourney({
    categories, sessions, tasks, doneKeys,
    hasPhoto: opts.hasPhoto, hasMentalCoach: opts.hasMentalCoach,
    hasWelcomeVideo: !!(welcome.fullUrl || welcome.freeUrl),
  }), [categories, sessions, tasks, doneKeys, opts.hasPhoto, opts.hasMentalCoach, welcome.fullUrl, welcome.freeUrl])

  return { journey, categories, loading: loading || catLoading, setDone, welcomeUrl: welcome.fullUrl || welcome.freeUrl, reload: load }
}
