import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, CalendarDays, ExternalLink, Loader2, Radio } from 'lucide-react'
import { useUI } from '../../context/UIContext'
import { useCinemaMode } from '../../context/ThemeContext'
import CinemaPlayer from '../../components/player/CinemaPlayer'
import MediaRow from '../../components/media/MediaRow'
import ReplayCard from '../../components/media/ReplayCard'
import { proceduralCover } from '../../components/media/MediaThumb'
import { useLiveEvent, useLiveEvents, liveDateLabel, liveDurationLabel, LiveEvent, LiveRole } from '../../lib/live'
import { liveEmbedSrc } from '../../lib/liveEmbed'

// Pagina di una live / replay in stile streaming: palco nero in alto (player
// dei replay, live incorporata o invito a entrare su Zoom), poi titolo e
// dettagli, poi "Altri replay". La chat non c'è più (richiesta esplicita).

const ROLE_LABEL: Record<LiveRole, string> = {
  admin:        'Admin',
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  student:      '',
}

// "Oggi" / "Domani" / "Tra 3 giorni"
function relativeDay(iso: string | null): string | null {
  if (!iso) return null
  const start = new Date(iso)
  const today = new Date()
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const days = Math.round((a - b) / 86_400_000)
  if (days < 0) return null
  if (days === 0) return 'Oggi'
  if (days === 1) return 'Domani'
  return `Tra ${days} giorni`
}

export default function StudentLivePlayer() {
  useCinemaMode()
  const { liveId } = useParams<{ liveId: string }>()
  const navigate   = useNavigate()
  const { setHideBottomNav } = useUI()
  const { event, loading } = useLiveEvent(liveId)
  const { events: allEvents } = useLiveEvents()

  useEffect(() => {
    setHideBottomNav(true)
    return () => setHideBottomNav(false)
  }, [setHideBottomNav])

  // Le live del mental coach vivono nella sua area: si torna lì e si propongono
  // solo i suoi replay; tutte le altre tornano a Live & Replay.
  const isMental  = event?.hostRole === 'mental_coach'
  const backPath  = isMental ? '/student/mental-coach' : '/student/live'
  const backLabel = isMental ? 'Mental Coach' : 'Live & Replay'

  const otherReplays = useMemo(() => allEvents
    .filter(e => e.status === 'replay' && e.eventType !== 'reminder' && e.id !== liveId)
    .filter(e => (e.hostRole === 'mental_coach') === isMental)
    .sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))
    .slice(0, 20), [allEvents, liveId, isMental])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Evento non trovato.</p>
        <button onClick={() => navigate('/student/live')} className="text-sm font-medium" style={{ color: 'var(--ist-accent-text)' }}>
          ← Live & Replay
        </button>
      </div>
    )
  }

  const isLive     = event.status === 'live'
  const isUpcoming = event.status === 'upcoming'
  const role       = ROLE_LABEL[event.hostRole] || ''
  const date       = liveDateLabel(event)
  const duration   = liveDurationLabel(event)

  return (
    <div className="cinema-page pb-16">
      {/* ── Palco ── */}
      <section data-inverted="true" className="bg-black cinema-stage">
        {event.status === 'replay' ? (
          <CinemaPlayer
            key={event.id}
            vimeoId={event.replayVimeoId}
            title={event.title}
            subtitle={event.host}
            backLabel={backLabel}
            onBack={() => navigate(backPath)}
          />
        ) : (
          <LiveStage event={event} onBack={() => navigate(backPath)} backLabel={backLabel} />
        )}
      </section>

      {/* ── Dettagli ── */}
      <div className="cinema-px pt-5 lg:pt-8" style={{ maxWidth: 'calc(1020px + var(--g-l) + var(--g-r))' }}>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md text-white" style={{ background: '#E5484D' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> In diretta
            </span>
          ) : (
            <span
              className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-accent-text)' }}
            >
              {isUpcoming ? 'Prossima live' : 'Replay'}
            </span>
          )}
          {isUpcoming && relativeDay(event.startsAt) && (
            <span
              className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
            >
              {relativeDay(event.startsAt)}
            </span>
          )}
        </div>

        <h1
          className="text-[26px] lg:text-[40px] font-extrabold tracking-tight leading-[1.08]"
          style={{ color: 'var(--ist-text)', textWrap: 'balance' }}
        >
          {event.title}
        </h1>
        <div className="mt-2.5 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-sm" style={{ color: 'var(--ist-text-muted)' }}>
          <span>{role ? `${event.host} · ${role}` : event.host}</span>
          {!isLive && date && <><span aria-hidden>·</span><span>{date}</span></>}
          {duration && <><span aria-hidden>·</span><span>{duration}</span></>}
        </div>
        {event.description && (
          <p className="mt-4 text-[15px] leading-relaxed max-w-3xl" style={{ color: 'var(--ist-text-muted)' }}>
            {event.description}
          </p>
        )}

        {isUpcoming && (
          <div className="mt-5">
            <button
              onClick={() => navigate('/student/calendario')}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-text)', border: '1px solid var(--ist-border)' }}
            >
              <CalendarDays size={16} strokeWidth={2.2} />
              Vedi nel calendario
            </button>
          </div>
        )}
      </div>

      {/* ── Altri replay ── */}
      {otherReplays.length > 0 && (
        <div className="mt-10">
          <MediaRow title="Altri replay" actionLabel={isMental ? undefined : 'Vedi tutti'} onAction={isMental ? undefined : () => navigate('/student/live')}>
            {otherReplays.map(e => (
              <ReplayCard key={e.id} event={e} onClick={() => navigate(`/student/live/${e.id}`, { replace: true })} />
            ))}
          </MediaRow>
        </div>
      )}
    </div>
  )
}

// ─── Palco per live in corso / in programma ───────────────────────────────────
// In diretta con link incorporabile → la live dentro l'app; altrimenti una
// "locandina" con stato e pulsante Zoom.
function LiveStage({ event, onBack, backLabel }: { event: LiveEvent; onBack: () => void; backLabel: string }) {
  const isLive   = event.status === 'live'
  const embedSrc = isLive ? liveEmbedSrc(event.liveEmbedUrl) : null

  const back = (
    <button
      onClick={onBack}
      className="absolute z-20 top-2 left-2 lg:top-4 lg:left-5 inline-flex items-center gap-1 h-10 pl-1.5 pr-3 rounded-full text-sm font-semibold text-white transition-colors hover:bg-white/10"
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      <ChevronLeft size={24} strokeWidth={2.4} />
      <span className="hidden sm:inline">{backLabel}</span>
    </button>
  )

  if (embedSrc) {
    return (
      <div className="relative mx-auto w-full bg-black" style={{ aspectRatio: '16 / 9', maxWidth: 'calc(78vh * 16 / 9)' }}>
        <iframe
          src={embedSrc}
          title={event.title}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
        {back}
      </div>
    )
  }

  const d = event.startsAt ? new Date(event.startsAt) : null

  return (
    <div
      className="relative mx-auto w-full overflow-hidden flex flex-col items-center justify-center text-center gap-3 px-6"
      style={{
        aspectRatio: '16 / 9',
        maxWidth: 'calc(78vh * 16 / 9)',
        backgroundColor: '#05070d',
        backgroundImage: proceduralCover(event.accent, event.accentEnd),
      }}
    >
      {back}
      <div className="absolute inset-0" style={{ background: 'rgba(5,7,13,0.45)' }} />
      <div className="relative flex flex-col items-center gap-3">
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-md text-white" style={{ background: '#E5484D' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> In diretta su Zoom
          </span>
        ) : d ? (
          <div className="text-white leading-none">
            <p className="text-xs lg:text-sm font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {d.toLocaleDateString('it-IT', { weekday: 'long' })} · ore {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-2 text-6xl lg:text-8xl font-black tracking-tight">
              {d.getDate()}
              <span className="ml-2 text-3xl lg:text-5xl font-extrabold uppercase">
                {d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
              </span>
            </p>
          </div>
        ) : (
          <Radio size={40} strokeWidth={1.8} className="text-white" />
        )}

        <p className="text-sm max-w-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {isLive
            ? 'La sessione è in corso: entra dal pulsante qui sotto.'
            : 'La live non è ancora iniziata. Potrai entrare quando sarà in diretta.'}
        </p>

        {isLive && event.zoomUrl && (
          <a
            href={event.zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-bold"
            style={{ background: '#ffffff', color: '#05070d' }}
          >
            <ExternalLink size={16} strokeWidth={2.5} />
            Entra su Zoom
          </a>
        )}
      </div>
    </div>
  )
}
