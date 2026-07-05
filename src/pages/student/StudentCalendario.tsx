import { useNavigate } from 'react-router-dom'
import { Radio, Calendar, ChevronRight, Clock, Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import LiveCalendar from '../../components/ui/LiveCalendar'
import { useLiveEvents, liveDateLabel, liveDurationLabel, LiveEvent } from '../../lib/live'

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  live:     { bg: 'rgba(255,80,80,0.12)',  text: '#FF5050', label: 'In diretta' },
  upcoming: { bg: 'rgba(90,154,177,0.12)', text: '#7CBBD0', label: 'In programma' },
  replay:   { bg: 'var(--ist-w6)',         text: 'var(--ist-text-dim)', label: 'Replay' },
}

export default function StudentCalendario() {
  const navigate = useNavigate()
  const { events: allEvents, loading } = useLiveEvents()
  // Le live del mental coach vivono SOLO nell'Area Mental Coach, non nel calendario.
  const events = allEvents.filter(e => e.hostRole !== 'mental_coach')

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const upcoming = events
    .filter(e => e.startsAt && new Date(e.startsAt) >= startOfToday && e.status !== 'replay')
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))

  const openDay = (dayEvents: LiveEvent[]) => {
    if (dayEvents.length > 0) navigate(`/student/live/${dayEvents[0].id}`)
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <PageHeader title="Calendario" subtitle="Le live in programma" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          {/* Calendario */}
          <Card className="p-5 h-fit">
            <LiveCalendar events={events} onPickDay={openDay} />
            <div className="flex items-center gap-4 mt-4 pt-3 text-[11px]" style={{ borderTop: '1px solid var(--ist-w7)', color: 'var(--ist-text-dim)' }}>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF5050' }} /> In diretta</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7CBBD0' }} /> In programma</span>
            </div>
          </Card>

          {/* Prossimi appuntamenti */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--ist-text-dim)' }}>
              Prossimi appuntamenti
            </h2>
            {upcoming.length === 0 ? (
              <Card className="p-8 text-center">
                <Calendar size={26} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--ist-text-dim)' }} />
                <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Nessuna live in programma.</p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map(e => {
                  const s = STATUS_STYLE[e.status]
                  return (
                    <button key={e.id} onClick={() => navigate(`/student/live/${e.id}`)} className="w-full text-left group">
                      <Card className="p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5 cursor-pointer">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${e.accent}12`, border: `1px solid ${e.accent}22` }}>
                          <Radio size={16} strokeWidth={2} style={{ color: e.accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--ist-text)' }}>{e.title}</p>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                          </div>
                          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--ist-text-muted)' }}>
                            <Clock size={11} strokeWidth={2} /> {liveDateLabel(e)}
                            {liveDurationLabel(e) && <> · {liveDurationLabel(e)}</>}
                          </p>
                        </div>
                        <ChevronRight size={15} strokeWidth={2} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--ist-text-dim)' }} />
                      </Card>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
