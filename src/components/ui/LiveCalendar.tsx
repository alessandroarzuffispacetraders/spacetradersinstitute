import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { LiveEvent } from '../../lib/live'

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export const sameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// Colore dell'evento: rosso = in diretta, teal = live, blu = replay, ambra = promemoria.
export function eventTone(e: LiveEvent): { color: string; bg: string; label: string } {
  if (e.eventType === 'reminder') return { color: '#F6C85F', bg: 'rgba(246,200,95,0.14)', label: 'Promemoria' }
  if (e.status === 'live') return { color: '#FF6B70', bg: 'rgba(229,72,77,0.18)', label: 'In diretta' }
  if (e.status === 'replay') return { color: '#8FB3FF', bg: 'rgba(143,179,255,0.12)', label: 'Replay' }
  return { color: '#7CBBD0', bg: 'rgba(124,187,208,0.16)', label: 'Live' }
}

// Mese a griglia (lun→dom). Su desktop i giorni mostrano gli eventi scritti
// (ora + titolo), su telefono dei pallini colorati. Un tocco seleziona il giorno.
export default function LiveCalendar({ events, selected, onSelect }: {
  events: LiveEvent[]
  selected: Date | null
  onSelect: (day: Date, dayEvents: LiveEvent[]) => void
}) {
  const today = new Date()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const byDay = new Map<string, LiveEvent[]>()
  for (const e of events) {
    if (!e.startsAt) continue
    const d = new Date(e.startsAt); const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    byDay.set(k, [...(byDay.get(k) ?? []), e].sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '')))
  }

  const first = new Date(view.y, view.m, 1)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = Array(startWeekday).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)

  const shift = (delta: number) => setView(v => { const m = v.m + delta; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 } })
  const monthEvents = events.filter(e => e.startsAt && new Date(e.startsAt).getMonth() === view.m && new Date(e.startsAt).getFullYear() === view.y).length

  return (
    <div className="cal-card rounded-3xl p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xl lg:text-2xl font-extrabold tracking-tight text-white">{MONTHS[view.m]} <span style={{ color: 'rgba(255,255,255,0.45)' }}>{view.y}</span></p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{monthEvents === 0 ? 'Nessun evento' : `${monthEvents} ${monthEvents === 1 ? 'evento' : 'eventi'} nel mese`}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(view.m !== today.getMonth() || view.y !== today.getFullYear()) && (
            <button onClick={() => setView({ y: today.getFullYear(), m: today.getMonth() })} className="h-9 px-3 rounded-xl text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.08)' }}>Oggi</button>
          )}
          <button onClick={() => shift(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-colors hover:bg-white/15" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Mese precedente"><ChevronLeft size={17} strokeWidth={2.4} /></button>
          <button onClick={() => shift(1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-colors hover:bg-white/15" style={{ background: 'rgba(255,255,255,0.08)' }} aria-label="Mese successivo"><ChevronRight size={17} strokeWidth={2.4} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 lg:gap-1.5 mb-1.5">
        {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] lg:text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-12 lg:h-24" />
          const date = new Date(view.y, view.m, d)
          const dayEvents = byDay.get(`${view.y}-${view.m}-${d}`) ?? []
          const isToday = sameDate(date, today)
          const isSel = !!selected && sameDate(date, selected)
          const past = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
          return (
            <button
              key={i}
              onClick={() => onSelect(date, dayEvents)}
              className={`cal-day relative h-12 lg:h-24 rounded-xl lg:rounded-2xl p-1 lg:p-1.5 text-left flex flex-col ${isSel ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${dayEvents.length ? 'has-events' : ''}`}
              style={{ opacity: past && !dayEvents.length ? 0.45 : 1 }}
            >
              <span className={`text-[13px] lg:text-sm font-bold tabular-nums leading-none self-center lg:self-start ${isToday ? 'cal-today-num' : ''}`} style={{ color: isToday ? '#05070d' : 'rgba(255,255,255,0.85)' }}>{d}</span>
              {/* Desktop: eventi scritti */}
              <span className="hidden lg:flex flex-col gap-1 mt-1.5 min-w-0 w-full">
                {dayEvents.slice(0, 2).map(e => {
                  const t = eventTone(e)
                  return (
                    <span key={e.id} className="block rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight truncate" style={{ background: t.bg, color: t.color }}>
                      {new Date(e.startsAt!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} {e.title}
                    </span>
                  )
                })}
                {dayEvents.length > 2 && <span className="text-[10px] pl-1" style={{ color: 'rgba(255,255,255,0.5)' }}>+{dayEvents.length - 2}</span>}
              </span>
              {/* Telefono: pallini */}
              {dayEvents.length > 0 && (
                <span className="lg:hidden absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dayEvents.slice(0, 3).map(e => <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: eventTone(e).color }} />)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 text-[11px] flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
        {[['#7CBBD0', 'Live'], ['#FF6B70', 'In diretta'], ['#8FB3FF', 'Replay'], ['#F6C85F', 'Promemoria']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
      </div>
    </div>
  )
}
