import { useNavigate } from 'react-router-dom'
import { CalendarDays, Play, Radio } from 'lucide-react'
import MediaThumb from '../media/MediaThumb'
import { liveThumbProps } from '../media/thumbProps'
import { useLiveEvent, LiveEvent } from '../../lib/live'
import { shareDateLabel } from '../../lib/liveShare'
import { useCoverTone } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

// Scheda di una live dentro un messaggio privato o un post degli annunci:
// copertina, data, titolo e il pulsante per entrare.
export function liveHref(role: string | undefined, id: string): string {
  if (role === 'coach') return '/coach/live'
  if (role === 'mental_coach') return '/mental-coach/live'
  if (role === 'admin') return '/admin/contenuti'
  return `/student/live/${id}`
}

export function LiveInviteCardView({ event: e, compact }: { event: LiveEvent; compact?: boolean }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const tone = useCoverTone()
  const { day, time } = shareDateLabel(e)
  const cta = e.status === 'live' ? 'Entra ora' : e.status === 'replay' ? 'Guarda il replay' : 'Apri la live'
  const open = (ev: React.MouseEvent) => { ev.stopPropagation(); navigate(liveHref(user?.role, e.id)) }
  return (
    <div
      onClick={open}
      role="button"
      className="media-card group block w-full text-left cursor-pointer rounded-2xl overflow-hidden"
      style={{ maxWidth: compact ? 300 : 440, background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)' }}
    >
      <MediaThumb {...liveThumbProps(e, tone)} rounded="rounded-none" showPlay={false} thumbWidth={640} />
      <div className="px-3.5 pt-2.5 pb-3">
        <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: e.status === 'live' ? '#FF5A6E' : 'var(--ist-accent-text)' }}>
          {e.status === 'live' ? <Radio size={11} strokeWidth={2.4} /> : <CalendarDays size={11} strokeWidth={2.4} />}
          {e.status === 'live' ? 'In diretta ora' : time ? `${day} · ${time}` : day}
        </p>
        <p className="text-sm font-bold leading-snug mt-1 line-clamp-2" style={{ color: 'var(--ist-text)' }}>{e.title}</p>
        {e.host && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ist-text-dim)' }}>con {e.host}</p>}
        <button
          onClick={open}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-transform active:scale-[0.98]"
          style={{ background: e.status === 'live' ? '#E5484D' : 'linear-gradient(135deg, #5A9AB1, #286680)' }}
        >
          <Play size={12} strokeWidth={2.6} fill="currentColor" />
          {cta}
        </button>
      </div>
    </div>
  )
}

export default function LiveInviteCard({ liveId, compact }: { liveId: string; compact?: boolean }) {
  const { event, loading } = useLiveEvent(liveId)
  if (loading) return <div className="rounded-2xl animate-pulse" style={{ width: compact ? 260 : 360, maxWidth: '100%', aspectRatio: '16 / 12', background: 'var(--ist-w6)' }} />
  if (!event) return (
    <p className="text-xs italic px-1" style={{ color: 'var(--ist-text-dim)' }}>La live non è più disponibile.</p>
  )
  return <LiveInviteCardView event={event} compact={compact} />
}
