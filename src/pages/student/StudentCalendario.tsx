import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Bell, Calendar, ChevronRight, Clock, Loader2, X } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import LiveCalendar from '../../components/ui/LiveCalendar'
import { useLiveEvents, liveDateLabel, liveDurationLabel, LiveEvent } from '../../lib/live'

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  live:     { bg: 'rgba(255,80,80,0.12)',  text: '#FF5050', label: 'In diretta' },
  upcoming: { bg: 'rgba(90,154,177,0.12)', text: '#7CBBD0', label: 'In programma' },
  replay:   { bg: 'var(--ist-w6)',         text: 'var(--ist-text-dim)', label: 'Replay' },
}
const REMINDER_STYLE = { bg: 'rgba(246,200,95,0.14)', text: '#F6C85F', label: 'Promemoria' }

export default function StudentCalendario() {
  const navigate = useNavigate()
  const { events: allEvents, loading } = useLiveEvents()
  const [detail, setDetail] = useState<LiveEvent | null>(null)
  // Le live del mental coach vivono SOLO nell'Area Mental Coach; i promemoria
  // invece compaiono sempre (qualunque sia il ruolo di chi li ha creati).
  const events = allEvents.filter(e => e.hostRole !== 'mental_coach' || e.eventType === 'reminder')

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const upcoming = events
    .filter(e => e.startsAt && new Date(e.startsAt) >= startOfToday && e.status !== 'replay')
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))

  // Un promemoria non ha player: apre un dettaglio. Una live apre la sua pagina.
  const openEvent = (e: LiveEvent) => {
    if (e.eventType === 'reminder') setDetail(e)
    else navigate(`/student/live/${e.id}`)
  }
  const openDay = (dayEvents: LiveEvent[]) => {
    if (dayEvents.length === 0) return
    // Se quel giorno c'è una live, apri quella; altrimenti mostra il promemoria.
    const live = dayEvents.find(e => e.eventType !== 'reminder')
    openEvent(live ?? dayEvents[0])
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
            <div className="flex items-center gap-4 mt-4 pt-3 text-[11px] flex-wrap" style={{ borderTop: '1px solid var(--ist-w7)', color: 'var(--ist-text-dim)' }}>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF5050' }} /> In diretta</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7CBBD0' }} /> In programma</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F6C85F' }} /> Promemoria</span>
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
                <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Nessun appuntamento in programma.</p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map(e => {
                  const isRem = e.eventType === 'reminder'
                  const s = isRem ? REMINDER_STYLE : STATUS_STYLE[e.status]
                  return (
                    <button key={e.id} onClick={() => openEvent(e)} className="w-full text-left group">
                      <Card className="p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5 cursor-pointer">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${e.accent}12`, border: `1px solid ${e.accent}22` }}>
                          {isRem
                            ? <Bell size={16} strokeWidth={2} style={{ color: e.accent }} />
                            : <Radio size={16} strokeWidth={2} style={{ color: e.accent }} />}
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

      {/* Dettaglio promemoria (i promemoria non hanno una pagina live) */}
      {detail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
            <button onClick={() => setDetail(null)} className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
              <X size={15} strokeWidth={2.5} />
            </button>
            <div className="p-6">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${detail.accent}12`, border: `1px solid ${detail.accent}22` }}>
                <Bell size={18} strokeWidth={2} style={{ color: detail.accent }} />
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: REMINDER_STYLE.bg, color: REMINDER_STYLE.text }}>Promemoria</span>
              <h3 className="text-lg font-bold mt-2 mb-1 leading-snug" style={{ color: 'var(--ist-text)' }}>{detail.title}</h3>
              <p className="text-sm flex items-center gap-1.5 mb-3" style={{ color: 'var(--ist-text-muted)' }}>
                <Clock size={13} strokeWidth={2} /> {liveDateLabel(detail)}
              </p>
              {detail.description && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ist-text-muted)' }}>{detail.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
