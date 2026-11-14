import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Loader2, Play, CalendarDays, Info } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useLiveEvents, liveDateLabel, liveDurationLabel, LiveEvent } from '../../lib/live'
import Billboard, { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaRow from '../../components/media/MediaRow'
import MediaThumb from '../../components/media/MediaThumb'

const HOST_ROLE_LABEL: Record<string, string> = {
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  admin:        'Admin',
  student:      '',
}

function hostLabel(e: LiveEvent): string {
  const role = HOST_ROLE_LABEL[e.hostRole] ?? ''
  return role ? `${e.host} · ${role}` : e.host
}

// "Oggi" / "Domani" / "Tra 3 giorni" per la prossima live.
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

function monthKey(iso: string | null): string {
  if (!iso) return 'Senza data'
  const label = new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Sopra questa soglia i replay si dividono in una riga per mese.
const REPLAYS_SINGLE_ROW_MAX = 10

export default function StudentLive() {
  const navigate = useNavigate()
  const { events: allEvents, loading } = useLiveEvents()

  const { live, upcoming, replays } = useMemo(() => {
    // Le live del mental coach vivono SOLO nell'Area Mental Coach; i promemoria di
    // calendario (eventType='reminder') non sono live → esclusi da questa sezione.
    const events = allEvents.filter(e => e.hostRole !== 'mental_coach' && e.eventType !== 'reminder')
    return {
      live: events.filter(e => e.status === 'live'),
      // In programma: dalla più vicina. Replay: dal più recente (senza data in fondo).
      upcoming: events.filter(e => e.status === 'upcoming')
        .sort((a, b) => (a.startsAt ?? '￿').localeCompare(b.startsAt ?? '￿')),
      replays: events.filter(e => e.status === 'replay')
        .sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? '')),
    }
  }, [allEvents])

  const replayGroups = useMemo(() => {
    if (replays.length <= REPLAYS_SINGLE_ROW_MAX) return [{ title: 'Replay', items: replays }]
    const groups: { title: string; items: LiveEvent[] }[] = []
    for (const r of replays) {
      const key = monthKey(r.startsAt)
      const g = groups.find(x => x.title === key)
      if (g) g.items.push(r)
      else groups.push({ title: key, items: [r] })
    }
    return groups
  }, [replays])

  const open = (id: string) => navigate(`/student/live/${id}`)

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
      </div>
    )
  }

  if (live.length + upcoming.length + replays.length === 0) {
    return (
      <div className="p-5 lg:p-8 max-w-4xl mx-auto">
        <PageHeader title="Live & Replay" subtitle="Sessioni in diretta e registrazioni" />
        <Card className="p-10 text-center">
          <Radio size={28} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--ist-text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>
            Nessuna live in programma al momento.
          </p>
        </Card>
      </div>
    )
  }

  // Banner: la live in corso; altrimenti la prossima in programma; altrimenti l'ultimo replay.
  const heroLive     = live[0] ?? null
  const heroUpcoming = !heroLive ? upcoming[0] ?? null : null
  const heroReplay   = !heroLive && !heroUpcoming ? replays[0] ?? null : null
  const hero         = (heroLive ?? heroUpcoming ?? heroReplay) as LiveEvent
  const pageTitle    = <p className="text-lg lg:text-2xl font-extrabold tracking-tight text-white">Live & Replay</p>

  return (
    <div className="pb-8">
      <Billboard
        vimeoId={heroReplay?.replayVimeoId}
        accent={hero.accent}
        accentEnd={hero.accentEnd}
        icon={heroUpcoming ? CalendarDays : Radio}
        topLeft={pageTitle}
        eyebrow={
          heroLive ? (
            <HeroTag tone="live">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              In diretta
            </HeroTag>
          ) : heroUpcoming ? (<>
            <HeroTag tone="accent">Prossima live</HeroTag>
            {relativeDay(heroUpcoming.startsAt) && <HeroTag>{relativeDay(heroUpcoming.startsAt)}</HeroTag>}
          </>) : (
            <HeroTag tone="accent">Ultimo replay</HeroTag>
          )
        }
        title={hero.title}
        meta={<>
          <span>{hostLabel(hero)}</span>
          {!heroLive && liveDateLabel(hero) && <><span aria-hidden>·</span><span>{liveDateLabel(hero)}</span></>}
          {liveDurationLabel(hero) && <><span aria-hidden>·</span><span>{liveDurationLabel(hero)}</span></>}
        </>}
        description={hero.description || (heroLive ? 'Entra e partecipa alla chat in tempo reale.' : undefined)}
        actions={
          heroLive ? (
            <HeroButton icon={Play} onClick={() => open(heroLive.id)}>Entra ora</HeroButton>
          ) : heroUpcoming ? (<>
            <HeroButton icon={Info} onClick={() => open(heroUpcoming.id)}>Dettagli</HeroButton>
            <HeroButton variant="secondary" icon={CalendarDays} onClick={() => navigate('/student/calendario')}>
              Calendario
            </HeroButton>
          </>) : (
            <HeroButton icon={Play} onClick={() => open(hero.id)}>Guarda il replay</HeroButton>
          )
        }
      />

      <div className="mt-2 lg:mt-0">
        {live.length > 1 && (
          <MediaRow title="In diretta ora">
            {live.map(e => <ReplayCard key={e.id} event={e} live onClick={() => open(e.id)} />)}
          </MediaRow>
        )}

        {upcoming.length > 0 && (
          <MediaRow title="In programma" actionLabel="Calendario" onAction={() => navigate('/student/calendario')}>
            {upcoming.map(e => <UpcomingCard key={e.id} event={e} onClick={() => open(e.id)} />)}
          </MediaRow>
        )}

        {replayGroups.map(g => (
          <MediaRow key={g.title} eyebrow={replayGroups.length > 1 ? 'Replay' : undefined} title={g.title}>
            {g.items.map(e => <ReplayCard key={e.id} event={e} onClick={() => open(e.id)} />)}
          </MediaRow>
        ))}
      </div>
    </div>
  )
}

// Replay (o live in corso): miniatura del video registrato, durata, titolo.
function ReplayCard({ event: e, live, onClick }: { event: LiveEvent; live?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb
        vimeoId={e.replayVimeoId}
        accent={e.accent}
        accentEnd={e.accentEnd}
        icon={Radio}
        duration={liveDurationLabel(e) || undefined}
        topLeft={live ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md text-white" style={{ background: '#E5484D' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Live
          </span>
        ) : undefined}
      />
      <div className="mt-2 px-0.5">
        <p className="text-[13px] lg:text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--ist-text)' }}>
          {e.title}
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ist-text-dim)' }}>
          {[e.host, liveDateLabel(e)].filter(Boolean).join(' · ')}
        </p>
      </div>
    </button>
  )
}

// Live in programma: "locandina" generata dal colore, con la data in grande.
function UpcomingCard({ event: e, onClick }: { event: LiveEvent; onClick: () => void }) {
  const d = e.startsAt ? new Date(e.startsAt) : null
  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb accent={e.accent} accentEnd={e.accentEnd} icon={CalendarDays} showPlay={false}>
        <div className="absolute inset-0 p-3.5 lg:p-4 flex flex-col justify-between">
          {d ? (
            <div className="text-white leading-none">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {d.toLocaleDateString('it-IT', { weekday: 'long' })}
              </p>
              <p className="font-black tracking-tight" style={{ fontSize: '19cqw' }}>
                {d.getDate()}
                <span className="font-extrabold uppercase ml-1.5" style={{ fontSize: '0.42em' }}>
                  {d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm font-bold text-white">Da programmare</p>
          )}
          {d && (
            <span
              className="self-start text-[11px] font-bold px-2 py-1 rounded-md text-white tabular-nums"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              ore {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              {relativeDay(e.startsAt) && ` · ${relativeDay(e.startsAt)}`}
            </span>
          )}
        </div>
      </MediaThumb>
      <div className="mt-2 px-0.5">
        <p className="text-[13px] lg:text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--ist-text)' }}>
          {e.title}
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ist-text-dim)' }}>
          {hostLabel(e)}
        </p>
      </div>
    </button>
  )
}
