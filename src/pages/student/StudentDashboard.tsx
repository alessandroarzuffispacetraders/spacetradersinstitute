import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Brain, CalendarDays, MessageCircle } from 'lucide-react'
import { usePath } from '../../lib/path'
import { useStudentBadges } from '../../lib/badges'
import { useLiveEvents, liveDateLabel } from '../../lib/live'
import { useStudentSessions } from '../../lib/coaching'
import { useDmUsers, useUnreadCounts, dmChannelId } from '../../lib/chat'
import { UserRole } from '../../types'
import LiveCalendar from '../../components/ui/LiveCalendar'
import OnboardingCard from '../../components/onboarding/OnboardingCard'
import WelcomeVideoHero from '../../components/onboarding/WelcomeVideoHero'
import UserAvatar from '../../components/ui/UserAvatar'
import { useUI } from '../../context/UIContext'

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

const DM_GRAD: Record<string, string> = {
  coach: 'linear-gradient(135deg,#5A9AB1,#286680)',
  mental_coach: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
  admin: 'linear-gradient(135deg,#5A9AB1,#286680)',
  student: 'linear-gradient(135deg,#374151,#6b7280)',
}

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
  const { setProfileOpen } = useUI()
  const navigate = useNavigate()
  const userId = user?.id ?? ''
  const userRole = (user?.role ?? 'student') as UserRole

  const { phase, phases } = usePath(userId)
  const { stats } = useStudentBadges(userId)
  const { events } = useLiveEvents()
  const { sessions: mySessions } = useStudentSessions(userId)

  // Messaggi privati non letti
  const dmUsers = useDmUsers(userId, userRole)
  const dmIds = dmUsers.map(u => dmChannelId(userId, u.id))
  const { counts: dmCounts } = useUnreadCounts(userId, dmIds, null)
  const unreadByUser = dmUsers
    .map(u => ({ u, n: dmCounts[dmChannelId(userId, u.id)] ?? 0 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
  const totalUnread = unreadByUser.reduce((s, x) => s + x.n, 0)

  // created_at + nomi coach/mental
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

  const nextLive = events.find(e => e.status === 'live') ?? events.find(e => e.status === 'upcoming') ?? null
  const completedSessions = mySessions.filter(s => s.status === 'completed').length

  // Apre direttamente la chat privata (DM) col coach / mental coach assegnato;
  // se non assegnato, ripiega sulla scheda chat privati.
  const openCoachChat = () => navigate('/student/chat', {
    state: user?.assignedCoachId ? { openDm: user.assignedCoachId } : { tab: 'direct' },
  })
  const openMentalChat = () => navigate('/student/chat', {
    state: user?.assignedMentalCoachId ? { openDm: user.assignedMentalCoachId } : { tab: 'direct' },
  })

  return (
    <div className="min-h-screen">
      <div className="px-5 lg:px-10 pt-8 pb-32 lg:pb-12 space-y-6">

        {/* ── Onboarding: video di benvenuto (prima settimana) + primi passi ── */}
        {user?.role === 'student' && <WelcomeVideoHero registeredAt={meta.createdAt} />}
        <OnboardingCard />

        {/* ── Header (sticky su mobile, con sfumatura sotto durante lo scroll) ── */}
        <div className="home-greeting-bar -mx-5 lg:mx-0">
          <div className="home-greeting-bar-bg">
            <header className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--ist-text-muted)' }}>
                  {programDay ? `Giorno ${programDay} del programma` : 'Il tuo programma'}
                </p>
                <h1 className="text-3xl lg:text-4xl font-extrabold leading-none" style={{ color: 'var(--ist-text)' }}>
                  Ciao, {firstName} 👋
                </h1>
              </div>
              <button
                onClick={() => setProfileOpen(true)}
                className="flex-shrink-0 rounded-full transition-transform active:scale-95"
                title="Profilo"
                aria-label="Apri profilo"
              >
                <UserAvatar user={{ name: user?.name ?? 'Trader', avatarPreset: user?.avatarPreset, avatarUrl: user?.avatarUrl }} size={48} />
              </button>
            </header>
          </div>
          <div className="home-greeting-fade" />
        </div>

        {/* ── HERO: progresso percorso ── */}
        <PremiumCard className="p-7 lg:p-8">
          <div className="flex items-center gap-6 mb-6">
            <div className="relative flex-shrink-0">
              <ProgressRing pct={progress} size={104}/>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-black" style={{ color: 'var(--ist-text)' }}>
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
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {stats.diaryStreak > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(70,211,154,0.14)', color: '#46D39A' }}>
                    🔥 {stats.diaryStreak} {stats.diaryStreak === 1 ? 'giorno' : 'giorni'}
                  </span>
                )}
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(90,154,177,0.14)', color: 'var(--ist-accent-text)' }}>
                  🏆 {stats.earnedCount} badge
                </span>
              </div>
            </div>
          </div>

          {/* Barra progresso */}
          <div className="h-2 rounded-full overflow-hidden mb-6" style={{ background: 'var(--ist-w8)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7CBBD0, #286680)', boxShadow: '0 0 14px rgba(124,187,208,.45)', transition: 'width .7s ease' }}/>
          </div>

          {/* Fasi */}
          <div className="flex items-center gap-0">
            {PHASES.map((p, i) => {
              const done = i < phaseIdx
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
                    <span className="text-xs font-semibold truncate w-full text-center" style={{ color: done ? '#46D39A' : active ? 'var(--ist-accent-text)' : 'var(--ist-text-dim)' }}>
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

        {/* ── PRIORITÀ: messaggi · live · calendario ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* MESSAGGI PRIVATI */}
          <Card className="p-6" onClick={() => navigate('/student/chat', { state: { tab: 'direct' } })}>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle size={15} strokeWidth={2} style={{ color: 'var(--ist-accent-text)' }} />
              <p className="text-xs font-bold uppercase tracking-widest flex-1" style={{ color: 'var(--ist-text-muted)' }}>Messaggi privati</p>
              {totalUnread > 0 && (
                <span className="text-[10px] font-bold text-white px-1.5 rounded-full min-w-[18px] text-center leading-[18px]" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
                  {totalUnread}
                </span>
              )}
            </div>
            {unreadByUser.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Nessun messaggio non letto.</p>
            ) : (
              <div className="space-y-2.5">
                {unreadByUser.slice(0, 3).map(({ u, n }) => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: DM_GRAD[u.role] ?? DM_GRAD.student }}>
                      {u.name.charAt(0)}
                    </div>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--ist-text)' }}>{u.name}</span>
                    <span className="text-[10px] font-bold text-white px-1.5 rounded-full min-w-[18px] text-center leading-[18px]" style={{ background: '#FF6B7A' }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* PROSSIMA LIVE */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>Live in arrivo</p>
            </div>
            {nextLive ? (
              <>
                <p className="text-lg font-extrabold leading-tight mb-1" style={{ color: 'var(--ist-text)' }}>{nextLive.title}</p>
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
                <p className="text-sm mb-5" style={{ color: 'var(--ist-text-muted)' }}>Nessuna live in programma al momento.</p>
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

          {/* CALENDARIO */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--ist-text-muted)' }}>Calendario</p>
              <button onClick={() => navigate('/student/calendario')} className="text-xs font-semibold" style={{ color: 'var(--ist-accent-text)' }}>Apri →</button>
            </div>
            <LiveCalendar events={events} compact onPickDay={(de) => de[0] && navigate(`/student/live/${de[0].id}`)} />
          </Card>

        </div>

        {/* ── SECONDARIE: mental coach · coach ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* MENTAL COACH — apre la chat privata col mental coach */}
          <Card className="p-6" onClick={openMentalChat}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.22)' }}>
                <Brain size={17} strokeWidth={2} style={{ color: '#a78bfa' }}/>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Mental Coach</p>
                <p className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>{meta.mentalName ?? 'Da assegnare'}</p>
              </div>
            </div>
            <div className="rounded-2xl p-3 flex items-center gap-2" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.14)' }}>
              <MessageCircle size={14} strokeWidth={2} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
                {completedSessions > 0
                  ? `${completedSessions} ${completedSessions === 1 ? 'sessione completata' : 'sessioni completate'}. Scrivi al tuo mental coach.`
                  : 'Scrivi al tuo mental coach in chat privata.'}
              </p>
            </div>
          </Card>

          {/* COACH */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }}>
                {meta.coachName?.charAt(0) ?? 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--ist-accent-text)' }}>
                  {meta.coachName ?? 'Coach da assegnare'} · Coach
                </p>
                <p className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>Il tuo coach personale</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ist-text-muted)' }}>
              Domande sul percorso o sui tuoi trade? Scrivi al tuo coach in chat.
            </p>
            <button
              onClick={openCoachChat}
              className="w-full py-2.5 rounded-2xl text-sm font-semibold"
              style={{ background: 'rgba(90,154,177,0.10)', border: '1px solid rgba(90,154,177,0.18)', color: 'var(--ist-accent-text)' }}
            >
              Apri la chat
            </button>
          </Card>

        </div>
      </div>
    </div>
  )
}
