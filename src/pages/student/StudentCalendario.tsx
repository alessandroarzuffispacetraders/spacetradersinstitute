import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, Bell, CalendarPlus, ChevronRight, Clock, Loader2, X, Play, Info, CalendarDays } from 'lucide-react'
import LiveCalendar, { eventTone, sameDate } from '../../components/ui/LiveCalendar'
import { useLiveEvents, liveDurationLabel, LiveEvent } from '../../lib/live'
import { googleCalendarUrl, downloadIcs } from '../../lib/calendarExport'
import { useCinemaMode, useCoverTone } from '../../context/ThemeContext'
import { Reveal, useNow, countdownLabel } from '../../components/home/motion'

const dayLabel = (d: Date) => { const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1) }
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
function relDay(d: Date): string {
  const t = new Date(); const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const n = Math.round((a - b) / 86_400_000)
  return n === 0 ? 'Oggi' : n === 1 ? 'Domani' : n > 1 && n < 7 ? `Tra ${n} giorni` : ''
}

// "Aggiungi al calendario": Google oppure file .ics (Apple, Outlook).
function AddToCalendar({ event, compact, up }: { event: LiveEvent; compact?: boolean; up?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off)
  }, [open])
  if (!event.startsAt) return null
  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className={compact ? 'w-9 h-9 rounded-xl flex items-center justify-center text-white transition-colors hover:bg-white/15' : 'inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold text-white transition-colors hover:bg-white/20'}
        style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)' }}
        aria-label="Aggiungi al calendario" title="Aggiungi al calendario"
      >
        <CalendarPlus size={compact ? 16 : 17} strokeWidth={2.2} />{!compact && 'Aggiungi al calendario'}
      </button>
      {open && (
        <div className={`absolute z-30 w-56 rounded-2xl p-1.5 ${up ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'}`} style={{ background: '#111826', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 18px 44px rgba(0,0,0,0.5)' }}>
          <a href={googleCalendarUrl(event) ?? '#'} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm text-white hover:bg-white/10">Google Calendar</a>
          <button onClick={() => { downloadIcs(event); setOpen(false) }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white hover:bg-white/10">Apple, Outlook e altri (.ics)</button>
        </div>
      )}
    </div>
  )
}

function Thumb({ e, className }: { e: LiveEvent; className: string }) {
  const tone = useCoverTone()
  const img = tone === 'light' && e.coverUrlLight ? e.coverUrlLight : e.coverUrl
  const t = eventTone(e)
  if (img && e.eventType !== 'reminder') return <img src={img} alt="" className={`object-cover ${className}`} />
  return (
    <span className={`flex items-center justify-center ${className}`} style={{ background: `radial-gradient(circle at 30% 30%, ${t.bg}, rgba(5,7,13,0.9))` }}>
      {e.eventType === 'reminder' ? <Bell size={20} style={{ color: t.color }} /> : <Radio size={20} style={{ color: t.color }} />}
    </span>
  )
}

function EventRow({ e, onOpen }: { e: LiveEvent; onOpen: (e: LiveEvent) => void }) {
  const t = eventTone(e)
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(e)} onKeyDown={k => { if (k.key === 'Enter') onOpen(e) }} className="cal-row group w-full rounded-2xl p-2.5 flex items-center gap-3 cursor-pointer">
      <span className="relative w-24 lg:w-28 aspect-video rounded-xl overflow-hidden flex-shrink-0">
        <Thumb e={e} className="absolute inset-0 w-full h-full" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 text-[11px] font-bold tabular-nums" style={{ color: t.color }}>
          {e.status === 'live' ? <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> : null}
          {e.startsAt ? timeLabel(e.startsAt) : '—'} · {t.label}
        </span>
        <span className="block text-sm font-bold text-white leading-snug line-clamp-2">{e.title}</span>
        <span className="block text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{[e.host, liveDurationLabel(e)].filter(Boolean).join(' · ')}</span>
      </span>
      {e.status !== 'replay' && <AddToCalendar event={e} compact />}
      <ChevronRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
    </div>
  )
}

// Il prossimo appuntamento in grande, con conto alla rovescia.
function NextEvent({ e, onOpen }: { e: LiveEvent; onOpen: (e: LiveEvent) => void }) {
  const now = useNow(1000)
  const cd = countdownLabel(e.startsAt, now)
  const d = e.startsAt ? new Date(e.startsAt) : null
  const t = eventTone(e)
  return (
    <div className="cal-next rounded-[28px] overflow-hidden flex flex-col md:flex-row">
      <div className="relative md:w-[46%] aspect-video md:aspect-auto md:min-h-[280px] flex-shrink-0">
        <Thumb e={e} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, rgba(5,7,13,0) 55%, rgba(10,14,23,0.96) 100%)' }} />
        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(to top, rgba(10,14,23,1) 0%, rgba(10,14,23,0) 55%)' }} />
        {d && (
          <div className="absolute top-4 left-4 rounded-2xl px-3 py-2 text-center leading-none" style={{ background: 'rgba(5,7,13,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.65)' }}>{d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}</p>
            <p className="text-3xl font-black tabular-nums text-white mt-0.5">{d.getDate()}</p>
          </div>
        )}
      </div>
      <div className="relative flex-1 p-5 lg:p-7 flex flex-col justify-center -mt-10 md:mt-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] flex-wrap" style={{ color: t.color }}>
          <span className="cal-dot" style={{ background: t.color }} /> {e.status === 'live' ? 'In diretta ora' : e.eventType === 'reminder' ? 'Prossimo promemoria' : 'Prossima live'}
          {cd && <span className="px-2 py-0.5 rounded-md text-white tabular-nums" style={{ background: 'rgba(255,255,255,0.12)' }}>{cd}</span>}
        </p>
        <h2 className="mt-2 text-2xl lg:text-[32px] font-extrabold tracking-tight leading-tight text-white" style={{ textWrap: 'balance' }}>{e.title}</h2>
        <p className="mt-2 text-sm flex items-center gap-2 flex-wrap" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <Clock size={14} /> {d ? `${dayLabel(d)} · ${timeLabel(e.startsAt!)}` : 'Data da definire'}{liveDurationLabel(e) && ` · ${liveDurationLabel(e)}`}
        </p>
        {e.host && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>con {e.host}</p>}
        <div className="mt-5 flex items-center gap-2.5 flex-wrap">
          <button onClick={() => onOpen(e)} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] hover:opacity-90" style={{ background: '#fff', color: '#0b0f18' }}>
            {e.status === 'live' ? <Play size={17} strokeWidth={2.5} fill="currentColor" /> : <Info size={17} strokeWidth={2.4} />}
            {e.status === 'live' ? 'Entra ora' : 'Dettagli'}
          </button>
          <AddToCalendar event={e} up />
        </div>
      </div>
    </div>
  )
}

// Calendario: il prossimo appuntamento in grande, il mese con gli eventi
// scritti dentro i giorni, il giorno scelto e la lista di quelli in arrivo.
export default function StudentCalendario() {
  useCinemaMode()
  const navigate = useNavigate()
  const { events: allEvents, loading } = useLiveEvents()
  const [detail, setDetail] = useState<LiveEvent | null>(null)
  const [selected, setSelected] = useState<Date | null>(null)
  // Le live del mental coach vivono nell'Area Mental Coach; i promemoria sempre.
  const events = allEvents.filter(e => e.hostRole !== 'mental_coach' || e.eventType === 'reminder')

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const upcoming = events
    .filter(e => (e.status === 'live') || (e.startsAt && new Date(e.startsAt) >= startOfToday && e.status !== 'replay'))
    .sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : (a.startsAt ?? '').localeCompare(b.startsAt ?? '')))
  const next = upcoming[0] ?? null
  const rest = upcoming.slice(1)
  const groups: { day: Date; items: LiveEvent[] }[] = []
  for (const e of rest) {
    if (!e.startsAt) continue
    const d = new Date(e.startsAt); const g = groups.find(x => sameDate(x.day, d))
    if (g) g.items.push(e); else groups.push({ day: d, items: [e] })
  }
  const selEvents = selected ? events.filter(e => e.startsAt && sameDate(new Date(e.startsAt), selected)).sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '')) : []

  const openEvent = (e: LiveEvent) => {
    if (e.eventType === 'reminder') setDetail(e)
    else navigate(`/student/live/${e.id}`)
  }

  if (loading) {
    return <div className="cinema-page flex justify-center py-32"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} /></div>
  }

  return (
    <div className="cinema-page pb-32 lg:pb-16">
      <section className="journey-hero">
        <div className="cinema-px pt-8 lg:pt-12 pb-6 lg:pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--ist-media-accent)' }}>Calendario</p>
          <h1 className="mt-1.5 text-[34px] lg:text-[52px] font-extrabold tracking-tight leading-[1.02] text-white">Le prossime live</h1>
          <p className="mt-2 text-sm lg:text-base" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {upcoming.length === 0 ? 'Nessun appuntamento in programma al momento.' : `${upcoming.length} ${upcoming.length === 1 ? 'appuntamento' : 'appuntamenti'} in arrivo · aggiungili al tuo calendario per non perderli`}
          </p>
        </div>
      </section>

      <div className="cinema-px flex flex-col gap-8 lg:gap-10">
        {next && <Reveal><NextEvent e={next} onOpen={openEvent} /></Reveal>}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <Reveal>
            <LiveCalendar events={events} selected={selected} onSelect={d => setSelected(s => (s && sameDate(s, d) ? null : d))} />
          </Reveal>

          <Reveal delay={80} className="flex flex-col gap-6">
            {selected && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-extrabold text-white">{dayLabel(selected)}</h2>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Chiudi giorno"><X size={15} /></button>
                </div>
                {selEvents.length === 0
                  ? <p className="text-sm cal-row rounded-2xl px-4 py-4" style={{ color: 'rgba(255,255,255,0.55)' }}>Nessun evento in questo giorno.</p>
                  : <div className="flex flex-col gap-2">{selEvents.map(e => <EventRow key={e.id} e={e} onOpen={openEvent} />)}</div>}
              </div>
            )}

            <div>
              <h2 className="text-[22px] lg:text-[26px] font-extrabold tracking-tight text-white mb-3">In arrivo</h2>
              {groups.length === 0 ? (
                <div className="cal-row rounded-2xl px-5 py-8 text-center">
                  <CalendarDays size={26} strokeWidth={1.6} className="mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{next ? 'Dopo questa non ci sono altri appuntamenti, per ora.' : 'Nessun appuntamento in programma.'}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map(g => (
                    <div key={g.day.toDateString()}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {dayLabel(g.day)}{relDay(g.day) && <span style={{ color: 'var(--ist-media-accent)' }}> · {relDay(g.day)}</span>}
                      </p>
                      <div className="flex flex-col gap-2">{g.items.map(e => <EventRow key={e.id} e={e} onOpen={openEvent} />)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      {/* Dettaglio promemoria (i promemoria non hanno una pagina live) */}
      {detail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} className="cal-next relative w-full max-w-md rounded-[28px] overflow-hidden">
            <button onClick={() => setDetail(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Chiudi"><X size={16} /></button>
            <div className="p-6">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(246,200,95,0.14)', color: '#F6C85F' }}><Bell size={20} /></span>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#F6C85F' }}>Promemoria</p>
              <h3 className="text-xl font-extrabold mt-1 mb-1 leading-snug text-white">{detail.title}</h3>
              {detail.startsAt && <p className="text-sm flex items-center gap-1.5 mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}><Clock size={14} /> {dayLabel(new Date(detail.startsAt))} · {timeLabel(detail.startsAt)}</p>}
              {detail.description && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.65)' }}>{detail.description}</p>}
              <div className="mt-5"><AddToCalendar event={detail} up /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
