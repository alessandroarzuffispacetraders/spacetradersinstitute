import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { LiveEvent } from '../../lib/live'

// "Questa settimana": i prossimi 7 giorni in una striscia, con le live e i
// promemoria segnati. Un evento apre la live, il giorno apre il calendario.
export default function WeekStrip({ events }: { events: LiveEvent[] }) {
  const navigate = useNavigate()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d })
  const byDay = (d: Date) => events
    .filter(e => e.startsAt && new Date(e.startsAt).toDateString() === d.toDateString() && e.status !== 'replay')
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())

  return (
    <div className="cinema-px">
      <div className="flex lg:grid lg:grid-cols-7 gap-2 lg:gap-3 overflow-x-auto no-scrollbar -mx-[var(--g-l)] px-[var(--g-l)] lg:mx-0 lg:px-0 media-scroller">
        {days.map((d, i) => {
          const list = byDay(d)
          const isToday = i === 0
          return (
            <div
              key={d.toISOString()}
              onClick={() => navigate('/student/calendario')}
              role="button"
              className="home-day snap-start flex-shrink-0 w-[132px] lg:w-auto rounded-2xl p-3 flex flex-col gap-2 cursor-pointer min-h-[132px]"
              style={isToday
                ? { background: 'linear-gradient(160deg, rgba(124,187,208,0.2), rgba(124,187,208,0.04))', border: '1px solid rgba(124,187,208,0.45)' }
                : { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: isToday ? 'var(--ist-media-accent)' : 'rgba(255,255,255,0.5)' }}>
                  {isToday ? 'Oggi' : d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}
                </span>
                <span className="text-xl font-black tabular-nums text-white">{d.getDate()}</span>
              </div>
              {list.length === 0 ? (
                <span className="text-[11px] mt-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {list.slice(0, 3).map(e => {
                    const t = new Date(e.startsAt!).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                    const reminder = e.eventType === 'reminder'
                    return (
                      <span
                        key={e.id}
                        onClick={ev => { ev.stopPropagation(); navigate(reminder ? '/student/calendario' : `/student/live/${e.id}`) }}
                        className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
                        style={{ background: e.status === 'live' ? 'rgba(229,72,77,0.18)' : reminder ? 'rgba(246,200,95,0.1)' : 'rgba(124,187,208,0.12)' }}
                      >
                        <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums" style={{ color: e.status === 'live' ? '#FF7A7F' : reminder ? '#F6C85F' : 'var(--ist-media-accent)' }}>
                          {e.status === 'live' ? <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> : reminder ? <Bell size={9} strokeWidth={2.6} /> : null}
                          {e.status === 'live' ? 'IN DIRETTA' : t}
                        </span>
                        <span className="block text-[11px] font-semibold leading-snug line-clamp-2 text-white">{e.title}</span>
                      </span>
                    )
                  })}
                  {list.length > 3 && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>+{list.length - 3} altri</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
