import MediaThumb from './MediaThumb'
import { lessonThumbProps } from './thumbProps'
import { useCoverTone } from '../../context/ThemeContext'
import type { LessonEntry } from '../../lib/catalogView'

// Card "episodio" per le righe orizzontali: miniatura + titolo + sottotitolo.
export default function LessonCard({
  entry, onClick, subtitle,
}: {
  entry: LessonEntry
  onClick: () => void
  subtitle?: string
}) {
  const { lesson, category, number } = entry
  const tone = useCoverTone()
  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb {...lessonThumbProps(lesson, category, number, tone)} />
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
