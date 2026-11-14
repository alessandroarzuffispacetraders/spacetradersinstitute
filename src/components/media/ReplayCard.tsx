import MediaThumb from './MediaThumb'
import { liveThumbProps } from './thumbProps'
import { LiveEvent, liveDateLabel } from '../../lib/live'

// Card di un replay (o di una live in corso): copertina AI / miniatura del
// video registrato, durata, titolo, conduttore e data.
export default function ReplayCard({ event: e, live, onClick }: { event: LiveEvent; live?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb
        {...liveThumbProps(e)}
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
