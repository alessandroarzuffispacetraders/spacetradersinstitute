import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { LiveEvent } from '../../lib/live'

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const WEEKDAYS_FULL = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const WEEKDAYS_MIN = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`
}

// Griglia mensile (settimana lun→dom) con pallino sui giorni che hanno live.
// Riusata sia dalla pagina Calendario sia dal widget compatto in home.
export default function LiveCalendar({ events, compact = false, onPickDay }: {
  events: LiveEvent[]
  compact?: boolean
  onPickDay?: (dayEvents: LiveEvent[]) => void
}) {
  const today = new Date()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })

  // Mappa giorno → eventi (solo eventi con data)
  const byDay = new Map<string, LiveEvent[]>()
  for (const e of events) {
    if (!e.startsAt) continue
    const d = new Date(e.startsAt)
    const k = dayKey(d.getFullYear(), d.getMonth(), d.getDate())
    const arr = byDay.get(k) ?? []
    arr.push(e)
    byDay.set(k, arr)
  }

  const first = new Date(view.y, view.m, 1)
  const startWeekday = (first.getDay() + 6) % 7 // lunedì = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const shift = (delta: number) => setView(v => {
    const m = v.m + delta
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
  })

  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d
  const WEEKDAYS = compact ? WEEKDAYS_MIN : WEEKDAYS_FULL

  return (
    <div>
      {/* Header mese */}
      <div className="flex items-center justify-between mb-3">
        <span className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: 'var(--ist-text)' }}>
          {MONTHS[view.m]} {view.y}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-muted)' }}>
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
          <button onClick={() => shift(1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--ist-text-muted)' }}>
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Intestazione giorni */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold uppercase" style={{ color: 'var(--ist-text-dim)' }}>{w}</div>
        ))}
      </div>

      {/* Celle */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const dayEvents = byDay.get(dayKey(view.y, view.m, d)) ?? []
          const has = dayEvents.length > 0
          const hasLive = dayEvents.some(e => e.status === 'live')
          const dotColor = hasLive ? '#FF5050' : '#7CBBD0'
          const todayCell = isToday(d)
          return (
            <button
              key={i}
              disabled={!has}
              onClick={() => has && onPickDay?.(dayEvents)}
              className={`relative rounded-lg flex flex-col items-center justify-center ${compact ? 'h-7' : 'h-10'} ${has ? 'cursor-pointer' : 'cursor-default'} transition-colors`}
              style={{
                background: todayCell ? 'rgba(90,154,177,0.18)' : has ? 'var(--ist-w6)' : 'transparent',
                border: todayCell ? '1px solid rgba(124,187,208,0.40)' : '1px solid transparent',
              }}
            >
              <span
                className={`${compact ? 'text-[11px]' : 'text-sm'} font-medium`}
                style={{ color: todayCell ? 'var(--ist-accent-text)' : has ? 'var(--ist-text)' : 'var(--ist-text-dim)' }}
              >
                {d}
              </span>
              {has && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
