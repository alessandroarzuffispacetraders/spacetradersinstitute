import { CalendarDays } from 'lucide-react'
import MediaThumb from './MediaThumb'
import { LiveEvent } from '../../lib/live'
import { useCoverTone } from '../../context/ThemeContext'

const HOST_ROLE_LABEL: Record<string, string> = {
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  admin:        'Admin',
  student:      '',
}

export function hostLabel(e: LiveEvent): string {
  const role = HOST_ROLE_LABEL[e.hostRole] ?? ''
  return role ? `${e.host} · ${role}` : e.host
}

// "Oggi" / "Domani" / "Tra 3 giorni" per la prossima live.
export function relativeDay(iso: string | null): string | null {
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

// Live in programma: la copertina (pronta dalla creazione) con sopra data e ora.
export default function UpcomingCard({ event: e, onClick }: { event: LiveEvent; onClick: () => void }) {
  const d = e.startsAt ? new Date(e.startsAt) : null
  const tone = useCoverTone()
  const light = tone === 'light' && !!e.coverUrlLight
  const cover = light ? e.coverUrlLight : e.coverUrl
  const ink = light ? '#0b1530' : '#fff'
  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb imageUrl={cover} tone={light ? 'light' : 'dark'} accent={e.accent} accentEnd={e.accentEnd} icon={CalendarDays} showPlay={false}>
        <div
          className="absolute inset-0 p-3.5 lg:p-4 flex flex-col justify-between"
          style={cover ? { background: light
            ? 'linear-gradient(180deg, rgba(232,237,244,0.92) 0%, rgba(232,237,244,0) 48%, rgba(232,237,244,0) 70%, rgba(232,237,244,0.7) 100%)'
            : 'linear-gradient(180deg, rgba(5,7,13,0.8) 0%, rgba(5,7,13,0) 48%, rgba(5,7,13,0) 70%, rgba(5,7,13,0.55) 100%)' } : undefined}
        >
          {d ? (
            <div className="leading-none" style={{ color: ink }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: light ? 'rgba(11,21,48,0.7)' : 'rgba(255,255,255,0.75)' }}>
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
            <p className="text-sm font-bold" style={{ color: ink }}>Da programmare</p>
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
