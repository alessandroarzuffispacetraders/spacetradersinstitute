import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { GradientCard } from '../../components/ui/Card'
import { BookOpen, MessageCircle, Radio, TrendingUp, Brain, CalendarDays } from 'lucide-react'
import { usePath } from '../../lib/path'
import { useStudentCatalog } from '../../lib/content'
import { useStudentBadges } from '../../lib/badges'
import { useLiveEvents, liveDateLabel } from '../../lib/live'
import { useStudentSessions } from '../../lib/coaching'
import LiveCalendar from '../../components/ui/LiveCalendar'

// ─── data ─────────────────────────────────────────────────────────────────────

const PHASES = [
  { label: 'Onboarding', key: 'onboarding' },
  { label: 'Build',      key: 'build' },
  { label: 'Test',       key: 'test' },
  { label: 'Deploy',     key: 'deploy' },
]

const PHASE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', build: 'Build', test: 'Test', deploy: 'Deploy',
}

// Palette gradienti per le card corsi (ciclata).
const GRADIENTS = [
  { gradient: 'from-[#5A9AB1] via-[#286680] to-[#0A3346]', blob1: 'bg-[#7CBBD0]/50', blob2: 'bg-[#155A72]/70' },
  { gradient: 'from-[#155A72] via-[#0F455C] to-[#061D2A]', blob1: 'bg-[#5A9AB1]/40', blob2: 'bg-[#0A3346]/80' },
  { gradient: 'from-[#286680] via-[#0A3346] to-[#070812]', blob1: 'bg-[#7CBBD0]/35', blob2: 'bg-[#0F455C]/80' },
]

// ─── progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ist-w10)" strokeWidth="10"/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#rg)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ - (pct/100) * circ}
        style={{ transition: 'stroke-dashoffset .7s ease', filter: 'drop-shadow(0 0 8px rgba(124,187,208,.55))' }}
      />
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7CBBD0"/>
          <stop offset="100%" stopColor="#286680"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── card shells ──────────────────────────────────────────────────────────────

function Card({ children, className = '', onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform duration-150' : ''} ${className}`}
      style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}
    >
      {children}
    </div>
  )
}

function PremiumCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl ${className}`}
      style={{ background: 'var(--ist-card-bg-premium)', border: '1px solid var(--ist-card-border-premium)', boxShadow: 'var(--ist-card-shadow-premium)' }}
    >
      {children}
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  const { phase, phases } = usePath(userId)
  const { categories } = useStudentCatalog(userId)
  const { stats } = useStudentBadges(userId)
  const { events } = useLiveEvents()
  const { sessions: mySessions } = useStudentSessions(userId)

  // created_at + nomi coach/mental (query leggere sul proprio profilo)
  const [meta, setMeta] = useState<{ createdAt: string | null; coachName: string | null; mentalName: string | null }>({ createdAt: null, coachName: null, mentalName: null })
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [own, co, me] = await Promise.all([
        supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
        user.assignedCoachId ? supabase.from('profiles').select('name').eq('id', user.assignedCoachId).maybeSingle() : Promise.resolve({ data: null as { name: string } | null }),
        user.assignedMentalCoachId ? supabase.from('profiles').select('name').eq('id', user.assignedMentalCoachId).maybeSingle() : Promise.resolve({ data: null as { name: string } | null }),
      ])
      if (!active) return
      setMeta({
        createdAt: (own.data as { created_at?: string } | null)?.created_at ?? null,
        coachName: (co.data as { name?: string } | null)?.name ?? null,
        mentalName: (me.data as { name?: string } | null)?.name ?? null,
      })
    })()
    return () => { active = false }
  }, [user])

  const firstName = user?.name?.split(' ')[0] ?? 'Trader'
  const initial   = user?.name?.charAt(0) ?? 'T'

  // Progresso reale dal percorso
  const allSteps  = phases.flatMap(p => p.steps)
  const doneSteps = allSteps.filter(s => s.done).length
  const progress  = allSteps.length ? Math.round((doneSteps / allSteps.length) * 100) : 0
  const phaseIdx  = Math.max(0, PHASES.findIndex(p => p.key === phase))
  const activePhase = phases.find(p => p.id === phase)
  const activeDone  = activePhase ? activePhase.steps.filter(s => s.done).length : 0
  const activeTotal = activePhase ? activePhase.steps.length : 0

  const programDay = meta.createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(meta.createdAt).getTime()) / 86_400_000) + 1)
    : null

  // Corsi della fase corrente (fallback: primi 3 in assoluto)
  const allCourses = categories.flatMap(c => c.courses)
  const phaseCourses = allCourses.filter(c => c.phase === PHASE_LABEL[phase])
  const courses = (phaseCourses.length ? phaseCourses : allCourses).slice(0, 3).map((c, i) => ({
    id: c.id,
    title: c.title,
    tag: `${c.phase} · Corso`,
    done: c.lessons.filter(l => l.done).length,
    lessons: c.lessons.length,
    ...GRADIENTS[i % GRADIENTS.length],
  }))

  const totalLessons = allCourses.reduce((n, c) => n + c.lessons.length, 0)
  const nextLive = events.find(e => e.status === 'live') ?? events.find(e => e.status === 'upcoming') ?? null
  const completedSessions = mySessions.filter(s => s.status === 'completed').length

  const QUICK = [
    { label: 'Videocorsi',    icon: BookOpen,      path: '/student/corsi',     desc: totalLessons ? `${totalLessons} lezioni disponibili` : 'Sfoglia i corsi' },
    { label: 'Community',     icon: MessageCircle, path: '/student/chat',      desc: 'Vai alla community' },
    { label: 'Sessioni Live', icon: Radio,         path: '/student/live',      desc: nextLive ? `Prossima: ${liveDateLabel(nextLive)}` : 'Nessuna in arrivo' },
    { label: 'Progressi',     icon: TrendingUp,    path: '/student/progressi', desc: `${stats.earnedCount} badge ottenuti` },
  ]

  return (
    <div className="min-h-screen">
      <div className="px-5 lg:px-10 pt-8 pb-32 lg:pb-12 space-y-6">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm mb-1" style={{ color: 'var(--ist-text-muted)' }}>
              {programDay ? `Giorno ${programDay} del programma` : 'Il tuo programma'}
            </p>
            <h1 className="text-3xl lg:text-4xl font-extrabold leading-none" style={{ color: 'var(--ist-text)' }}>
              Ciao, {firstName} 👋
            </h1>
          </div>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }}
          >
            {initial}
          </div>
        </header>

        {/* ── Main grid: left (content) + right (sidebar) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6">

          {/* ════ COLONNA SINISTRA ════ */}
          <div className="space-y-6">

            {/* PROGRESSO — card grande, protagonista */}
            <PremiumCard className="p-7 lg:p-8">
              <div className="flex items-center gap-6 mb-6">
                <div className="relative flex-shrink-0">
                  <ProgressRing pct={progress} size={104}/>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-2xl font-black"
                    style={{ color: 'var(--ist-text)' }}
                  >
                    {progress}%
                  </span>
                </div>
                <div>
                  <p className="text-xl lg:text-2xl font-extrabold leading-tight" style={{ color: 'var(--ist-text)' }}>
                    Percorso completato
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--ist-text-muted)' }}>
                    Fase <strong style={{ color: 'var(--ist-accent-text)' }}>{PHASE_LABEL[phase] ?? phase}</strong>
                    {activeTotal > 0 && <> · {activeDone}/{activeTotal} passi</>}
                  </p>
                  {stats.diaryStreak > 0 && (
                    <p className="text-xs mt-2 px-2.5 py-1 rounded-full inline-block" style={{ background: 'rgba(70,211,154,0.14)', color: '#46D39A' }}>
                      🔥 {stats.diaryStreak} {stats.diaryStreak === 1 ? 'giorno' : 'giorni'} consecutivi
                    </p>
                  )}
                </div>
              </div>

              {/* Barra progresso */}
              <div className="h-2 rounded-full overflow-hidden mb-6" style={{ background: 'var(--ist-w8)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7CBBD0, #286680)', boxShadow: '0 0 14px rgba(124,187,208,.45)', transition: 'width .7s ease' }}
                />
              </div>

              {/* Fasi del percorso */}
              <div className="flex items-center gap-0">
                {PHASES.map((p, i) => {
                  const done   = i < phaseIdx
                  const active = i === phaseIdx
                  return (
                    <div key={p.key} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={
                            done   ? { background: 'rgba(70,211,154,0.18)', color: '#46D39A' }
                            : active ? { background: 'rgba(90,154,177,0.25)', color: 'var(--ist-accent-text)', boxShadow: '0 0 12px rgba(90,154,177,.35)' }
                            : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }
                          }
                        >
                          {done ? '✓' : i + 1}
                        </div>
                        <span
                          className="text-xs font-semibold truncate w-full text-center"
                          style={{ color: done ? '#46D39A' : active ? 'var(--ist-accent-text)' : 'var(--ist-text-dim)' }}
                        >
                          {p.label}
                        </span>
                      </div>
                      {i < PHASES.length - 1 && (
                        <div className="h-px flex-1 mx-2 mb-4" style={{ background: done ? 'rgba(70,211,154,.35)' : 'var(--ist-w8)' }}/>
                      )}
                    </div>
                  )
                })}
              </div>
            </PremiumCard>

            {/* CORSI */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>Corsi in corso</h2>
                <button
                  onClick={() => navigate('/student/corsi')}
                  className="text-sm font-semibold"
                  style={{ color: 'var(--ist-accent-text)' }}
                >
                  Vedi tutti →
                </button>
              </div>

              {courses.length === 0 ? (
                <Card className="p-6">
                  <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Nessun corso ancora disponibile.</p>
                </Card>
              ) : (
                <>
                  {/* Mobile: scroll */}
                  <div className="flex lg:hidden gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
                    {courses.map(c => (
                      <div key={c.id} className="flex-shrink-0 w-56">
                        <GradientCard {...c} onClick={() => navigate('/student/corsi')} className="h-40">
                          <p className="text-white/60 text-xs mt-1">{c.done}/{c.lessons} lezioni</p>
                        </GradientCard>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: 3 colonne */}
                  <div className="hidden lg:grid grid-cols-3 gap-4">
                    {courses.map(c => (
                      <GradientCard key={c.id} {...c} onClick={() => navigate('/student/corsi')} className="h-44">
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
                            <div className="h-full rounded-full bg-white/70" style={{ width: c.lessons > 0 ? `${(c.done/c.lessons)*100}%` : '0%' }}/>
                          </div>
                          <span className="text-white/60 text-[11px]">{c.done}/{c.lessons}</span>
                        </div>
                      </GradientCard>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ACCESSO RAPIDO */}
            <div>
              <h2 className="text-base font-bold mb-3" style={{ color: 'var(--ist-text)' }}>Accesso rapido</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {QUICK.map(item => (
                  <Card key={item.path} className="p-5" onClick={() => navigate(item.path)}>
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.20)' }}
                    >
                      <item.icon size={19} strokeWidth={1.8} style={{ color: 'var(--ist-accent-text)' }}/>
                    </div>
                    <p className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>{item.label}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ist-text-muted)' }}>{item.desc}</p>
                  </Card>
                ))}
              </div>
            </div>

          </div>

          {/* ════ COLONNA DESTRA (sidebar) ════ */}
          <div className="space-y-4">

            {/* PROSSIMA LIVE */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>Live in arrivo</p>
              </div>
              {nextLive ? (
                <>
                  <p className="text-xl font-extrabold leading-tight mb-1" style={{ color: 'var(--ist-text)' }}>
                    {nextLive.title}
                  </p>
                  <div className="flex items-center gap-2 mb-5" style={{ color: 'var(--ist-text-muted)' }}>
                    <CalendarDays size={13} strokeWidth={2}/>
                    <p className="text-sm">{liveDateLabel(nextLive)}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/student/live/${nextLive.id}`)}
                    className="w-full py-3 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.09))', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171' }}
                  >
                    Vedi dettagli →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm mb-5" style={{ color: 'var(--ist-text-muted)' }}>
                    Nessuna live in programma al momento.
                  </p>
                  <button
                    onClick={() => navigate('/student/live')}
                    className="w-full py-3 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-muted)' }}
                  >
                    Vai alle Live →
                  </button>
                </>
              )}
            </Card>

            {/* CALENDARIO (compatto) */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ist-text-muted)' }}>
                  Calendario
                </p>
                <button onClick={() => navigate('/student/calendario')} className="text-xs font-semibold" style={{ color: 'var(--ist-accent-text)' }}>
                  Apri →
                </button>
              </div>
              <LiveCalendar events={events} compact onPickDay={(de) => de[0] && navigate(`/student/live/${de[0].id}`)} />
            </Card>

            {/* PERCORSO VERTICALE */}
            <Card className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--ist-text-muted)' }}>
                Il tuo percorso
              </p>
              <div className="space-y-0">
                {PHASES.map((p, i) => {
                  const done   = i < phaseIdx
                  const active = i === phaseIdx
                  const last   = i === PHASES.length - 1
                  return (
                    <div key={p.key} className="flex gap-4">
                      {/* Dot + line */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10"
                          style={
                            done   ? { background: 'rgba(70,211,154,0.18)', color: '#46D39A' }
                            : active ? { background: 'rgba(90,154,177,0.22)', color: 'var(--ist-accent-text)', boxShadow: '0 0 12px rgba(90,154,177,.35)' }
                            : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }
                          }
                        >
                          {done ? '✓' : i + 1}
                        </div>
                        {!last && (
                          <div className="w-px flex-1 my-1" style={{ background: done ? 'rgba(70,211,154,.30)' : 'var(--ist-w8)', minHeight: 20 }}/>
                        )}
                      </div>
                      {/* Label */}
                      <div className="pb-4">
                        <p
                          className="text-sm font-semibold leading-none mt-1"
                          style={{ color: done ? '#46D39A' : active ? 'var(--ist-text)' : 'var(--ist-text-dim)' }}
                        >
                          {p.label}
                        </p>
                        {active && activeTotal > 0 && (
                          <p className="text-xs mt-1" style={{ color: 'var(--ist-accent-text)' }}>
                            In corso · {activeDone}/{activeTotal} passi
                          </p>
                        )}
                        {done && (
                          <p className="text-xs mt-1" style={{ color: 'var(--ist-text-dim)' }}>Completata</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* MENTAL COACH */}
            <Card className="p-6" onClick={() => navigate('/student/mental-coach')}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.22)' }}
                >
                  <Brain size={17} strokeWidth={2} style={{ color: '#a78bfa' }}/>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Mental Coach</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>{meta.mentalName ?? 'Da assegnare'}</p>
                </div>
              </div>
              <div
                className="rounded-2xl p-3"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.14)' }}
              >
                <p className="text-xs leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
                  {completedSessions > 0
                    ? `${completedSessions} ${completedSessions === 1 ? 'sessione completata' : 'sessioni completate'}. Apri l'area Mental Coach per i dettagli.`
                    : 'Nessuna sessione ancora completata. Apri l\'area Mental Coach per iniziare.'}
                </p>
              </div>
            </Card>

            {/* COACH */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }}
                >
                  {meta.coachName?.charAt(0) ?? 'C'}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--ist-accent-text)' }}>
                    {meta.coachName ?? 'Coach da assegnare'} · Coach
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>Il tuo coach personale</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ist-text-muted)' }}>
                Hai domande sul percorso o sui tuoi trade? Scrivi al tuo coach in chat.
              </p>
              <button
                onClick={() => navigate('/student/chat', { state: { tab: 'direct' } })}
                className="w-full py-2.5 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(90,154,177,0.10)', border: '1px solid rgba(90,154,177,0.18)', color: 'var(--ist-accent-text)' }}
              >
                Apri la chat
              </button>
            </Card>

          </div>

        </div>
      </div>
    </div>
  )
}
