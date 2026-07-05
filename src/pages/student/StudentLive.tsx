import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { Clock, Radio, Calendar, ChevronRight, Loader2 } from 'lucide-react'
import { useLiveEvents, liveDateLabel, liveDurationLabel } from '../../lib/live'

const HOST_ROLE_LABEL: Record<string, string> = {
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  admin:        'Admin',
  student:      '',
}

export default function StudentLive() {
  const navigate = useNavigate()
  const { events: allEvents, loading } = useLiveEvents()
  // Le live del mental coach vivono SOLO nell'Area Mental Coach, non qui.
  const events = allEvents.filter(e => e.hostRole !== 'mental_coach')

  const live     = events.filter(e => e.status === 'live')
  const upcoming = events.filter(e => e.status === 'upcoming')
  const replays  = events.filter(e => e.status === 'replay')

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="Live & Replay" subtitle="Sessioni in diretta e registrazioni" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
        </div>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center">
          <Radio size={28} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--ist-text-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>
            Nessuna live in programma al momento.
          </p>
        </Card>
      ) : (
      <>
      {/* ── LIVE NOW ── gradient card, always dark */}
      {live.map(event => (
        <button
          key={event.id}
          data-inverted="true"
          onClick={() => navigate(`/student/live/${event.id}`)}
          className="w-full text-left mb-8 rounded-3xl overflow-hidden relative group transition-all hover:-translate-y-0.5"
          style={{
            background: `linear-gradient(135deg, #0A1628 0%, #0D2A3F 50%, #071420 100%)`,
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: `0 24px 60px rgba(0,0,0,0.45), 0 0 60px ${event.accent}12`,
          }}
        >
          {/* Blobs */}
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${event.accent}30 0%, transparent 70%)` }} />
          <div className="absolute -bottom-20 -left-12 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${event.accentEnd}20 0%, transparent 70%)` }} />
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: `linear-gradient(90deg, ${event.accent}, ${event.accentEnd})` }} />

          <div className="relative p-6 lg:p-7">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.28)' }}
              >
                <Radio size={20} strokeWidth={2} style={{ color: '#FF5050' }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,80,80,0.18)', color: '#FF5050', border: '1px solid rgba(255,80,80,0.30)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5050] animate-pulse" />
                    LIVE ORA
                  </span>
                </div>

                <h2 className="text-lg lg:text-xl font-bold text-white mb-1 leading-tight">
                  {event.title}
                </h2>
                <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {event.host} · {HOST_ROLE_LABEL[event.hostRole] ?? event.hostRole}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)' }}>
                  {event.description}
                </p>
              </div>

              <div
                className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                <ChevronRight size={15} strokeWidth={2.5} style={{ color: 'rgba(255,255,255,0.70)' }} />
              </div>
            </div>

            <div
              className="mt-5 pt-4 flex items-center justify-between flex-wrap gap-3"
              style={{ borderTop: `1px solid rgba(255,255,255,0.08)` }}
            >
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Entra e partecipa alla chat in tempo reale
              </p>
              <span
                className="text-sm font-bold px-5 py-2 rounded-full transition-all group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${event.accent}, ${event.accentEnd})`,
                  color: 'white',
                  boxShadow: `0 4px 18px ${event.accent}45`,
                }}
              >
                Entra →
              </span>
            </div>
          </div>
        </button>
      ))}

      {/* ── UPCOMING ── */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--ist-text-dim)' }}
          >
            In programma
          </h2>
          <div className="space-y-2.5">
            {upcoming.map(event => (
              <div
                key={event.id}
                className="flex items-center gap-4 p-4 lg:p-5 rounded-2xl"
                style={{
                  background: 'var(--ist-card-bg)',
                  border: '1px solid var(--ist-border)',
                  boxShadow: 'var(--ist-card-shadow)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${event.accent}12`, border: `1px solid ${event.accent}22` }}
                >
                  <Calendar size={17} strokeWidth={2} style={{ color: event.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ist-text)' }}>
                    {event.title}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                    {event.host} · {liveDateLabel(event)}
                  </p>
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: `${event.accent}12`, color: event.accent, border: `1px solid ${event.accent}22` }}
                >
                  Programmata
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── REPLAY ── */}
      {replays.length > 0 && (
        <section>
          <h2
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--ist-text-dim)' }}
          >
            Replay disponibili
          </h2>
          <div className="space-y-2.5">
            {replays.map(replay => (
              <button
                key={replay.id}
                onClick={() => navigate(`/student/live/${replay.id}`)}
                className="w-full text-left group"
              >
                <Card className="p-5 flex items-center gap-4 transition-all hover:-translate-y-0.5 cursor-pointer">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${replay.accent}12`, border: `1px solid ${replay.accent}22` }}
                  >
                    <Radio size={17} strokeWidth={2} style={{ color: replay.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ist-text)' }}>
                      {replay.title}
                    </p>
                    <p className="text-xs mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>
                      {replay.host} · {liveDateLabel(replay)}
                    </p>
                    {liveDurationLabel(replay) && (
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
                        <span className="flex items-center gap-1">
                          <Clock size={11} strokeWidth={2} /> {liveDurationLabel(replay)}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={15}
                    strokeWidth={2}
                    className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'var(--ist-text-dim)' }}
                  />
                </Card>
              </button>
            ))}
          </div>
        </section>
      )}
      </>
      )}
    </div>
  )
}
