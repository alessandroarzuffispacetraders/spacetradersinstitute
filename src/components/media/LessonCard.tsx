import MediaThumb from './MediaThumb'
import { phaseIcon } from './phase'
import { LessonEntry, watchedFraction } from '../../lib/catalogView'

// Card "episodio" per le righe orizzontali: miniatura + titolo + sottotitolo.
export default function LessonCard({
  entry, onClick, subtitle,
}: {
  entry: LessonEntry
  onClick: () => void
  subtitle?: string
}) {
  const { lesson, category, number } = entry
  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb
        vimeoId={lesson.vimeoId}
        fallbackUrl={category.coverUrl}
        accent={category.accent}
        icon={phaseIcon(category.phase)}
        label={String(number).padStart(2, '0')}
        progress={watchedFraction(lesson)}
        done={lesson.done}
        duration={lesson.durationSeconds > 0 ? lesson.duration : undefined}
      />
      <div className="mt-2 px-0.5">
        <p className="text-[13px] lg:text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--ist-text)' }}>
          {lesson.title}
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--ist-text-dim)' }}>
          {subtitle ?? `Lezione ${number}`}
        </p>
      </div>
    </button>
  )
}
