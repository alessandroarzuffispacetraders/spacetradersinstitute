import { useEffect, useMemo, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Info, Play, Radio, RotateCcw, Sparkles, ChevronRight, Megaphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { useCinemaMode } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { useJourney } from '../../lib/journey'
import { useStudentBadges } from '../../lib/badges'
import { useLiveEvents, liveDateLabel, LiveEvent } from '../../lib/live'
import { useStudentSessions } from '../../lib/coaching'
import { useDmUsers, useUnreadCounts, dmChannelId } from '../../lib/chat'
import { useLatestAnnouncements, BachecaPost } from '../../lib/bacheca'
import { flattenLessons, continueWatching, pickResume, watchedFraction, remainingLabel, RESUME_CTA, RESUME_EYEBROW } from '../../lib/catalogView'
import { useWelcomeVideo, welcomeVideoFor } from '../../lib/onboarding'
import { isFreeUser, upsellSuppressed } from '../../lib/freeTier'
import { UserRole } from '../../types'
import HeroCarousel, { HeroSlide } from '../../components/media/HeroCarousel'
import { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaRow from '../../components/media/MediaRow'
import LessonCard from '../../components/media/LessonCard'
import ReplayCard from '../../components/media/ReplayCard'
import UpcomingCard, { hostLabel } from '../../components/media/UpcomingCard'
import { phaseIcon } from '../../components/media/phase'
import UserAvatar from '../../components/ui/UserAvatar'
import UpgradeBanner from '../../components/ui/UpgradeBanner'
import OnboardingCard from '../../components/onboarding/OnboardingCard'
import PathStrip from '../../components/home/PathStrip'
import TeamRow, { TeamPerson, MessagesStrip } from '../../components/home/TeamRow'
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

// "oggi", "ieri", "3 giorni fa", altrimenti la data.
function relDate(iso: string): string {
  const d = new Date(iso); const t = new Date()
  const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
  if (days <= 0) return 'oggi'
  if (days === 1) return 'ieri'
  if (days < 7) return `${days} giorni fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
// Titolo della slide: quello del post, altrimenti l'inizio del testo (breve,
// tagliato su una parola); `rest` è ciò che resta da mostrare sotto.
function postHeadline(p: BachecaPost): { title: string; rest: string } {
  if (p.title) return { title: p.title, rest: p.content }
  const text = p.content.trim(); const first = text.split('\n')[0].trim()
  const sentence = first.match(/^.{12,70}?[.!?:](\s|$)/)?.[0]?.trim()
  if (sentence) {
    const after = text.slice(text.indexOf(sentence) + sentence.length).trim()
    return { title: sentence.replace(/:$/, ''), rest: after.charAt(0).toUpperCase() + after.slice(1) }
  }
  if (first.length <= 64) return { title: first, rest: text.slice(first.length).trim() }
  const cut = first.slice(0, 64); const at = cut.lastIndexOf(' ')
  return { title: (at > 30 ? cut.slice(0, at) : cut) + '…', rest: text }
}
const postTitle = (p: BachecaPost) => postHeadline(p).title

const byStart = (a: LiveEvent, b: LiveEvent) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime()

// Home in stile streaming (pagina "cinema", sempre scura):
//  1. banner rotante: live in diretta / prossima (con conto alla rovescia),
//     lezione da riprendere, ultimo replay, video di benvenuto (prima settimana)
//     e gli ultimi avvisi
//  2. il percorso, i messaggi privati e il team (coach + mental coach)
//  3. live e replay, continua a guardare
export default function StudentDashboard() {
  useCinemaMode()
  const { user } = useAuth()
  const { setProfileOpen } = useUI()
  const navigate = useNavigate()
  const userId = user?.id ?? ''
  const userRole = (user?.role ?? 'student') as UserRole
  const free = isFreeUser(user)

  const { stats } = useStudentBadges(userId)
  const { events: allEvents } = useLiveEvents()
  // Le live del mental coach vivono nell'Area Mental Coach; i promemoria
  // compaiono comunque (qualunque ruolo li abbia creati).
  const events = allEvents.filter(e => e.hostRole !== 'mental_coach' || e.eventType === 'reminder')
  const { sessions: mySessions } = useStudentSessions(userId)
  const { journey, categories } = useJourney(userId, { hasPhoto: !!(user?.avatarUrl || user?.avatarPreset), hasMentalCoach: !!user?.assignedMentalCoachId })
  const welcome = useWelcomeVideo()
  const notices = useLatestAnnouncements(3)

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

  // Percorso (si costruisce da solo dai contenuti: vedi lib/journey)
  const activePhase = journey.phases.find(p => p.id === journey.phase)

  // Contenuti
  const entries = useMemo(() => flattenLessons(categories), [categories])
  const resume = useMemo(() => pickResume(entries), [entries])
  const continuing = useMemo(() => continueWatching(entries), [entries])
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
  const openNotices = (channelId: string) => navigate(`/student/chat?c=${channelId}`)

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
  const notice = notices[0]
  if (notice) {
    const image = notice.imageUrls[0]
      ?? (notice.liveEventId ? allEvents.find(e => e.id === notice.liveEventId)?.coverUrl : null)
      ?? '/covers/avvisi.webp'
    const { title: headline, rest } = postHeadline(notice)
    const fresh = Date.now() - new Date(notice.createdAt).getTime() < 3 * 86_400_000
    slides.push({
      key: `avviso-${notice.id}`, imageUrl: image, imagePosition: notice.imageUrls[0] ? '50% 40%' : undefined, accent: '#7CBBD0', icon: Megaphone,
      eyebrow: <><HeroTag tone="accent">Avvisi</HeroTag>{fresh && <HeroTag>Nuovo</HeroTag>}{notice.pinned && <HeroTag>In evidenza</HeroTag>}</>,
      title: headline,
      meta: <><span>{notice.author}</span><span aria-hidden>·</span><span>{relDate(notice.createdAt)}</span></>,
      description: rest || undefined,
      extra: notices.length > 1 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.5)' }}>Anche negli avvisi</p>
          {notices.slice(1).map(p => (
            <button key={p.id} onClick={() => openNotices(p.channelId)} className="flex items-center gap-2 text-left text-[13px] font-medium max-w-full transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ist-media-accent)' }} />
              <span className="truncate">{postTitle(p)}</span>
              <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>{relDate(p.createdAt)}</span>
            </button>
          ))}
        </div>
      ) : undefined,
      actions: <HeroButton icon={Megaphone} onClick={() => openNotices(notice.channelId)}>Leggi gli avvisi</HeroButton>,
    })
  }
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
          <PathStrip progress={journey.progress} phase={journey.phase} activeDone={activePhase?.done ?? 0} activeTotal={activePhase?.total ?? 0} streak={stats.diaryStreak} badges={stats.earnedCount} nextLabel={journey.next?.title} />
        </Reveal>

        <div className="flex flex-col gap-5 lg:gap-6">
          <Reveal>
            <MessagesStrip others={others} onOpen={() => navigate('/student/chat', { state: { tab: 'direct' } })} />
          </Reveal>
          <Reveal>
            <SectionTitle>Il tuo team</SectionTitle>
            <TeamRow
              coach={meta.coach} mental={meta.mental}
              coachUnread={unreadOf(user?.assignedCoachId)} mentalUnread={unreadOf(user?.assignedMentalCoachId)}
              completedSessions={completedSessions}
              onCoach={() => openDm(user?.assignedCoachId)} onMental={() => openDm(user?.assignedMentalCoachId)}
            />
          </Reveal>
        </div>

        <div className="-mb-7 lg:-mb-10">
          {(liveNow || upcoming.length > 0 || replays.length > 0) && (
            <Reveal>
              <MediaRow title="Live e replay" actionLabel="Vedi tutte" onAction={() => navigate('/student/live')}>
                {liveNow && <ReplayCard event={liveNow} live onClick={() => openLive(liveNow.id)} />}
                {upcoming.map(e => <UpcomingCard key={e.id} event={e} onClick={() => openLive(e.id)} />)}
                {replays.slice(0, 10).map(e => <ReplayCard key={e.id} event={e} onClick={() => openLive(e.id)} />)}
              </MediaRow>
            </Reveal>
          )}

          {continuing.length > 0 && (
            <Reveal>
              <MediaRow title="Continua a guardare">
                {continuing.map(e => (
                  <LessonCard key={e.lesson.id} entry={e} onClick={() => openLesson(e.lesson.id)} subtitle={[remainingLabel(e.lesson), e.course.title].filter(Boolean).join(' · ')} />
                ))}
              </MediaRow>
            </Reveal>
          )}
        </div>
      </div>

      {welcomeOpen && welcomeUrl && <WelcomeVideoModal url={welcomeUrl} onClose={() => setWelcomeOpen(false)} />}
    </div>
  )
}
