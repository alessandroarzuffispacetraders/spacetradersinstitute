import { useEffect, useMemo, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Info, Play, Radio, RotateCcw, Sparkles, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useCinemaMode } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { usePath } from '../../lib/path'
import { useStudentBadges } from '../../lib/badges'
import { useLiveEvents, liveDateLabel, LiveEvent } from '../../lib/live'
import { useStudentSessions } from '../../lib/coaching'
import { useDmUsers, useUnreadCounts, dmChannelId } from '../../lib/chat'
import { useStudentCatalog, getCategoryStats } from '../../lib/content'
import { flattenLessons, continueWatching, pickResume, watchedFraction, remainingLabel, RESUME_CTA, RESUME_EYEBROW } from '../../lib/catalogView'
import { useWelcomeVideo, welcomeVideoFor } from '../../lib/onboarding'
import { isFreeUser, upsellSuppressed } from '../../lib/freeTier'
import { UserRole } from '../../types'
import HeroCarousel, { HeroSlide } from '../../components/media/HeroCarousel'
import { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaRow from '../../components/media/MediaRow'
import LessonCard from '../../components/media/LessonCard'
import SeriesCard from '../../components/media/SeriesCard'
import ReplayCard from '../../components/media/ReplayCard'
import UpcomingCard, { hostLabel } from '../../components/media/UpcomingCard'
import { phaseIcon } from '../../components/media/phase'
import UserAvatar from '../../components/ui/UserAvatar'
import UpgradeBanner from '../../components/ui/UpgradeBanner'
import OnboardingCard from '../../components/onboarding/OnboardingCard'
import PathStrip from '../../components/home/PathStrip'
import TeamRow, { TeamPerson } from '../../components/home/TeamRow'
import WeekStrip from '../../components/home/WeekStrip'
import WelcomeVideoModal from '../../components/home/WelcomeVideoModal'
import { Reveal, useCountUp, useNow, countdownLabel } from '../../components/home/motion'

// Conto alla rovescia isolato: si aggiorna ogni secondo senza ridisegnare la Home.
function Countdown({ iso }: { iso: string | null }) {
  const now = useNow(1000)
  const label = countdownLabel(iso, now)
  return label ? <HeroTag>{label}</HeroTag> : null
}

function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-3 cinema-px mb-3 lg:mb-4">
      <h2 className="text-[22px] lg:text-[28px] font-extrabold tracking-tight leading-tight" style={{ color: 'var(--ist-text)' }}>{children}</h2>
      {action && onAction && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-xs lg:text-sm font-semibold mb-0.5 lg:mb-1 transition-opacity hover:opacity-70" style={{ color: 'var(--ist-text-muted)' }}>
          {action} <ChevronRight size={15} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}

const byStart = (a: LiveEvent, b: LiveEvent) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime()

// Home in stile streaming (pagina "cinema", sempre scura):
//  1. banner rotante: live in diretta / prossima (con conto alla rovescia),
//     lezione da riprendere, ultimo replay, video di benvenuto (prima settimana)
//  2. il percorso in una riga, poi righe di contenuti come Videocorsi e Live
//  3. il tuo team (coach, mental coach, messaggi) e la settimana
export default function StudentDashboard() {
  useCinemaMode()
  const { user } = useAuth()
  const { setProfileOpen } = useUI()
  const navigate = useNavigate()
  const userId = user?.id ?? ''
  const userRole = (user?.role ?? 'student') as UserRole
  const free = isFreeUser(user)

  const { phase, phases } = usePath(userId)
  const { stats } = useStudentBadges(userId)
  const { events: allEvents } = useLiveEvents()
  // Le live del mental coach vivono nell'Area Mental Coach; i promemoria
  // compaiono comunque (qualunque ruolo li abbia creati).
  const events = allEvents.filter(e => e.hostRole !== 'mental_coach' || e.eventType === 'reminder')
  const { sessions: mySessions } = useStudentSessions(userId)
  const { categories } = useStudentCatalog(userId, 'all')
  const welcome = useWelcomeVideo()

  // Messaggi privati non letti
  const dmUsers = useDmUsers(userId, userRole)
  const dmIds = dmUsers.map(u => dmChannelId(userId, u.id))
  const { counts: dmCounts } = useUnreadCounts(userId, dmIds, null)
  const unreadOf = (id?: string | null) => (id ? dmCounts[dmChannelId(userId, id)] ?? 0 : 0)

  // Data di registrazione + coach e mental coach (nome e avatar)
  const [meta, setMeta] = useState<{ createdAt: string | null; coach: TeamPerson; mental: TeamPerson }>({ createdAt: null, coach: { name: null }, mental: { name: null } })
  useEffect(() => {
    if (!user) return
    let active = true
    const person = (id?: string | null) => id
      ? supabase.from('profiles_public').select('id, name, avatar_url, avatar_preset').eq('id', id).maybeSingle()
      : Promise.resolve({ data: null })
    ;(async () => {
      const [own, co, me] = await Promise.all([
        supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
        person(user.assignedCoachId), person(user.assignedMentalCoachId),
      ])
      if (!active) return
      const toPerson = (d: unknown): TeamPerson => {
        const r = d as { id?: string; name?: string; avatar_url?: string | null; avatar_preset?: string | null } | null
        return { id: r?.id ?? null, name: r?.name ?? null, avatarUrl: r?.avatar_url ?? null, avatarPreset: r?.avatar_preset ?? null }
      }
      setMeta({ createdAt: (own.data as { created_at?: string } | null)?.created_at ?? null, coach: toPerson(co.data), mental: toPerson(me.data) })
    })()
    return () => { active = false }
  }, [user])

  const firstName = user?.name?.split(' ')[0] ?? 'Trader'
  const programDay = meta.createdAt ? Math.max(1, Math.floor((Date.now() - new Date(meta.createdAt).getTime()) / 86_400_000) + 1) : 0
  const dayCount = useCountUp(programDay, 900)

  // Percorso
  const allSteps = phases.flatMap(p => p.steps)
  const progress = allSteps.length ? Math.round((allSteps.filter(s => s.done).length / allSteps.length) * 100) : 0
  const activePhase = phases.find(p => p.id === phase)
  const activeDone = activePhase ? activePhase.steps.filter(s => s.done).length : 0
  const activeTotal = activePhase ? activePhase.steps.length : 0

  // Contenuti
  const entries = useMemo(() => flattenLessons(categories), [categories])
  const resume = useMemo(() => pickResume(entries), [entries])
  const continuing = useMemo(() => continueWatching(entries), [entries])
  const series = useMemo(() => categories.filter(c => c.section !== 'mental'), [categories])
  const currentSeries = series.findIndex(c => getCategoryStats(c).pct < 100)
  const lives = events.filter(e => e.eventType !== 'reminder')
  const liveNow = lives.find(e => e.status === 'live') ?? null
  const upcoming = lives.filter(e => e.status === 'upcoming' && (!e.startsAt || new Date(e.startsAt).getTime() > Date.now() - 3 * 3600_000)).sort(byStart)
  const replays = lives.filter(e => e.status === 'replay').sort((a, b) => byStart(b, a))
  const nextLive = upcoming[0] ?? null
  const completedSessions = mySessions.filter(s => s.status === 'completed').length

  const welcomeUrl = user?.role === 'student' ? welcomeVideoFor(welcome, meta.createdAt, free, upsellSuppressed()) : null
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  const openLesson = (id: string) => navigate(`/student/corsi/lezione/${id}`)
  const openCategory = (id: string, courseId?: string) => navigate(`/student/corsi/${id}${courseId ? `?corso=${courseId}` : ''}`)
  const openLive = (id: string) => navigate(`/student/live/${id}`)
  const openDm = (id?: string | null) => navigate('/student/chat', { state: id ? { openDm: id } : { tab: 'direct' } })

  // Slide del banner, in ordine di priorità
  const slides: HeroSlide[] = []
  if (welcomeUrl) slides.push({
    key: 'welcome', vimeoId: welcomeUrl, accent: '#5A9AB1', icon: Sparkles,
    eyebrow: <HeroTag tone="accent">Benvenuto</HeroTag>,
    title: free ? `Scopri IST, ${firstName}` : `Benvenuto in IST, ${firstName}`,
    description: free ? 'Guarda il video e scopri cosa ti aspetta nel percorso completo.' : 'Guarda il video di benvenuto per partire con il piede giusto.',
    actions: <HeroButton icon={Play} onClick={() => setWelcomeOpen(true)}>Guarda il video</HeroButton>,
  })
  if (liveNow) slides.push({
    key: `live-${liveNow.id}`, imageUrl: liveNow.coverUrl, vimeoId: liveNow.coverUrl ? null : liveNow.replayVimeoId, accent: liveNow.accent, accentEnd: liveNow.accentEnd, icon: Radio,
    eyebrow: <HeroTag tone="live"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />In diretta</HeroTag>,
    title: liveNow.title, meta: <span>{hostLabel(liveNow)}</span>,
    description: liveNow.description || 'Entra e partecipa in tempo reale.',
    actions: <HeroButton icon={Play} onClick={() => openLive(liveNow.id)}>Entra ora</HeroButton>,
  })
  else if (nextLive) slides.push({
    key: `next-${nextLive.id}`, imageUrl: nextLive.coverUrl, accent: nextLive.accent, accentEnd: nextLive.accentEnd, icon: CalendarDays,
    eyebrow: <><HeroTag tone="accent">Prossima live</HeroTag><Countdown iso={nextLive.startsAt} /></>,
    title: nextLive.title,
    meta: <><span>{hostLabel(nextLive)}</span>{liveDateLabel(nextLive) && <><span aria-hidden>·</span><span>{liveDateLabel(nextLive)}</span></>}</>,
    description: nextLive.description || undefined,
    actions: <>
      <HeroButton icon={Info} onClick={() => openLive(nextLive.id)}>Dettagli</HeroButton>
      <HeroButton variant="secondary" icon={CalendarDays} onClick={() => navigate('/student/calendario')}>Calendario</HeroButton>
    </>,
  })
  if (resume) {
    const { entry: h, mode } = resume
    slides.push({
      key: `resume-${h.lesson.id}`, imageUrl: h.lesson.coverUrl ?? h.category.posterUrl,
      imagePosition: !h.lesson.coverUrl && h.category.posterUrl ? '50% 20%' : undefined,
      accent: h.category.accent, icon: phaseIcon(h.category.phase),
      eyebrow: <><HeroTag tone="accent">{RESUME_EYEBROW[mode]}</HeroTag><HeroTag>{h.category.title}</HeroTag></>,
      title: h.lesson.title,
      meta: <><span className="truncate max-w-[60vw] lg:max-w-none">{h.course.title}</span><span aria-hidden>·</span><span>Lezione {h.number}</span></>,
      progress: watchedFraction(h.lesson), progressLabel: remainingLabel(h.lesson) ?? undefined,
      actions: <>
        <HeroButton icon={mode === 'rewatch' ? RotateCcw : Play} onClick={() => openLesson(h.lesson.id)}>{RESUME_CTA[mode]}</HeroButton>
        <HeroButton variant="secondary" icon={Info} onClick={() => openCategory(h.category.id, h.course.id)}>Dettagli</HeroButton>
      </>,
    })
  }
  const lastReplay = replays.find(e => e.coverUrl) ?? replays[0]
  if (lastReplay) slides.push({
    key: `replay-${lastReplay.id}`, imageUrl: lastReplay.coverUrl, vimeoId: lastReplay.coverUrl ? null : lastReplay.replayVimeoId, accent: lastReplay.accent, accentEnd: lastReplay.accentEnd, icon: Radio,
    eyebrow: <HeroTag tone="accent">Ultimo replay</HeroTag>,
    title: lastReplay.title,
    meta: <><span>{hostLabel(lastReplay)}</span>{liveDateLabel(lastReplay) && <><span aria-hidden>·</span><span>{liveDateLabel(lastReplay)}</span></>}</>,
    description: lastReplay.description || undefined,
    actions: <HeroButton icon={Play} onClick={() => openLive(lastReplay.id)}>Guarda il replay</HeroButton>,
  })

  const greeting = (
    <div>
      <p className="text-[11px] lg:text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.72)', textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}>
        {programDay ? <>Giorno <span className="tabular-nums">{dayCount}</span> del programma</> : 'Il tuo programma'}
      </p>
      <p className="text-xl lg:text-3xl font-extrabold leading-tight text-white" style={{ textShadow: '0 2px 18px rgba(0,0,0,0.5)' }}>Ciao, {firstName} 👋</p>
    </div>
  )
  const avatar = (
    <button onClick={() => setProfileOpen(true)} className="rounded-full transition-transform active:scale-95" title="Profilo" aria-label="Apri profilo" style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.25)' }}>
      <UserAvatar user={{ name: user?.name ?? 'Trader', avatarPreset: user?.avatarPreset, avatarUrl: user?.avatarUrl }} size={44} />
    </button>
  )

  // Su telefono, scorrendo oltre il banner compare una barra sfocata col saluto.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 260)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const others = dmUsers
    .filter(u => u.id !== user?.assignedCoachId && u.id !== user?.assignedMentalCoachId)
    .map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, avatarPreset: u.avatarPreset, n: unreadOf(u.id) }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n)

  return (
    <div className="cinema-page home-page pb-32 lg:pb-12">
      <div className={`home-topbar lg:hidden ${scrolled ? 'is-on' : ''}`}>
        <span className="text-base font-extrabold text-white truncate">Ciao, {firstName}</span>
        <button onClick={() => setProfileOpen(true)} className="rounded-full flex-shrink-0" aria-label="Apri profilo">
          <UserAvatar user={{ name: user?.name ?? 'Trader', avatarPreset: user?.avatarPreset, avatarUrl: user?.avatarUrl }} size={32} />
        </button>
      </div>

      {slides.length > 0 ? (
        <HeroCarousel slides={slides} topLeft={greeting} topRight={avatar} />
      ) : (
        <div className="cinema-px pt-8 pb-4 flex items-center justify-between">{greeting}{avatar}</div>
      )}

      <div className="relative z-10 flex flex-col gap-7 lg:gap-9 mt-1 lg:-mt-2">
        {free && <div className="cinema-px"><UpgradeBanner /></div>}
        <OnboardingCard />

        <Reveal className="cinema-px">
          <PathStrip progress={progress} phase={phase} activeDone={activeDone} activeTotal={activeTotal} streak={stats.diaryStreak} badges={stats.earnedCount} />
        </Reveal>

        <div className="-mb-7 lg:-mb-10">
          {continuing.length > 0 && (
            <Reveal>
              <MediaRow title="Continua a guardare">
                {continuing.map(e => (
                  <LessonCard key={e.lesson.id} entry={e} onClick={() => openLesson(e.lesson.id)} subtitle={[remainingLabel(e.lesson), e.course.title].filter(Boolean).join(' · ')} />
                ))}
              </MediaRow>
            </Reveal>
          )}

          {(liveNow || upcoming.length > 0) && (
            <Reveal>
              <MediaRow title="Prossime live" actionLabel="Calendario" onAction={() => navigate('/student/calendario')}>
                {liveNow && <ReplayCard event={liveNow} live onClick={() => openLive(liveNow.id)} />}
                {upcoming.map(e => <UpcomingCard key={e.id} event={e} onClick={() => openLive(e.id)} />)}
              </MediaRow>
            </Reveal>
          )}

          {series.length > 0 && (
            <Reveal>
              <MediaRow title="Le tue serie" actionLabel="Videocorsi" onAction={() => navigate('/student/corsi')} itemClassName="w-[64vw] sm:w-[40vw] md:w-[30vw] lg:w-auto" variant="carousel"
                initialIndex={currentSeries > 0 ? currentSeries : undefined}>
                {series.map((cat, i) => (
                  <SeriesCard key={cat.id} category={cat} isCurrent={i === currentSeries} onOpen={() => openCategory(cat.id)} onPlay={openLesson} />
                ))}
              </MediaRow>
            </Reveal>
          )}

          {replays.length > 0 && (
            <Reveal>
              <MediaRow title="Ultimi replay" actionLabel="Live & Replay" onAction={() => navigate('/student/live')}>
                {replays.slice(0, 12).map(e => <ReplayCard key={e.id} event={e} onClick={() => openLive(e.id)} />)}
              </MediaRow>
            </Reveal>
          )}
        </div>

        <Reveal>
          <SectionTitle>Il tuo team</SectionTitle>
          <TeamRow
            coach={meta.coach} mental={meta.mental}
            coachUnread={unreadOf(user?.assignedCoachId)} mentalUnread={unreadOf(user?.assignedMentalCoachId)}
            others={others} completedSessions={completedSessions}
            onCoach={() => openDm(user?.assignedCoachId)} onMental={() => openDm(user?.assignedMentalCoachId)}
            onInbox={() => navigate('/student/chat', { state: { tab: 'direct' } })}
          />
        </Reveal>

        <Reveal>
          <SectionTitle action="Calendario" onAction={() => navigate('/student/calendario')}>Questa settimana</SectionTitle>
          <WeekStrip events={events} />
        </Reveal>
      </div>

      {welcomeOpen && welcomeUrl && <WelcomeVideoModal url={welcomeUrl} onClose={() => setWelcomeOpen(false)} />}
    </div>
  )
}
