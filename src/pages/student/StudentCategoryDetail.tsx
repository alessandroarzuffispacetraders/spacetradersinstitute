import { useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Paperclip, Play, RotateCcw, Loader2 } from 'lucide-react'
import { useStudentCatalog, getCourseStats, getCategoryStats, Course } from '../../lib/content'
import { useAuth } from '../../context/AuthContext'
import { useCinemaMode, useCoverTone } from '../../context/ThemeContext'
import {
  flattenLessons, pickResume, remainingLabel, LessonEntry, RESUME_CTA,
} from '../../lib/catalogView'
import Billboard, { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaThumb from '../../components/media/MediaThumb'
import { lessonThumbProps } from '../../components/media/thumbProps'
import { phaseIcon } from '../../components/media/phase'

// "3 h 20 min" / "45 min" da secondi.
function totalDurationLabel(seconds: number): string | null {
  const min = Math.round(seconds / 60)
  if (min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// Scheda categoria come la pagina di una serie: banner, selettore dei corsi
// (le "stagioni") ed elenco delle lezioni (gli "episodi") con miniatura.
export default function StudentCategoryDetail() {
  useCinemaMode()
  const { categoryId } = useParams<{ categoryId: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { findCategory, loading } = useStudentCatalog(user?.id ?? '')
  const cat = findCategory(categoryId ?? '')

  const entries = useMemo(() => (cat ? flattenLessons([cat]) : []), [cat])
  const resume  = useMemo(() => pickResume(entries), [entries])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
      </div>
    )
  }

  if (!cat) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Categoria non trovata.</p>
        <button
          onClick={() => navigate('/student/corsi')}
          className="text-sm font-medium"
          style={{ color: 'var(--ist-accent-text)' }}
        >
          ← Torna ai corsi
        </button>
      </div>
    )
  }

  const catStats  = getCategoryStats(cat)
  // Locandina AI della serie (verticale): ultima scelta per il banner orizzontale.
  const poster    = cat.posterUrl ?? null
  const totalSecs = entries.reduce((s, e) => s + Math.max(0, e.lesson.durationSeconds), 0)
  const duration  = totalDurationLabel(totalSecs)

  // Corso selezionato: da ?corso=…, altrimenti quello della lezione da riprendere.
  const requested = params.get('corso')
  const course: Course | undefined =
    cat.courses.find(c => c.id === requested)
    ?? cat.courses.find(c => c.id === resume?.entry.course.id)
    ?? cat.courses[0]

  const selectCourse = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('corso', id)
    setParams(next, { replace: true })
  }

  const openLesson = (id: string) => navigate(`/student/corsi/lezione/${id}`)
  const statusTag  = catStats.pct === 100 ? 'Completato' : catStats.pct > 0 ? 'In corso' : null

  return (
    <div className="cinema-page pb-10">
      <Billboard
        // Solo copertine nuove: lezione da riprendere, poi locandina della serie.
        imageUrl={resume?.entry.lesson.coverUrl ?? poster}
        imagePosition={!resume?.entry.lesson.coverUrl && poster ? '50% 20%' : undefined}
        accent={cat.accent}
        icon={phaseIcon(cat.phase)}
        topLeft={
          <button
            onClick={() => navigate('/student/corsi')}
            className="inline-flex items-center gap-1 h-9 pl-2 pr-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.16)' }}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Videocorsi
          </button>
        }
        eyebrow={<>
          <HeroTag>{cat.phase}</HeroTag>
          {statusTag && <HeroTag tone={catStats.pct === 100 ? 'glass' : 'accent'}>{statusTag}</HeroTag>}
        </>}
        title={cat.title}
        meta={<>
          <span>{cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'}</span>
          <span aria-hidden>·</span>
          <span>{catStats.total} lezioni</span>
          {duration && <><span aria-hidden>·</span><span>{duration}</span></>}
        </>}
        description={cat.description}
        progress={catStats.pct / 100}
        progressLabel={`${catStats.done}/${catStats.total} completate`}
        actions={resume && (
          <HeroButton
            icon={resume.mode === 'rewatch' ? RotateCcw : Play}
            onClick={() => openLesson(resume.entry.lesson.id)}
          >
            {RESUME_CTA[resume.mode]}
            {resume.mode !== 'rewatch' && resume.mode !== 'start' && (
              <span className="font-semibold opacity-70">· Lezione {resume.entry.number}</span>
            )}
          </HeroButton>
        )}
      />

      {/* ── Selettore corsi ("stagioni") ── */}
      {cat.courses.length > 1 && (
        <div className="media-scroller flex gap-2 overflow-x-auto cinema-px pt-2 pb-1 mb-4">
          {cat.courses.map((c, i) => {
            const s = getCourseStats(c)
            const active = c.id === course?.id
            return (
              <button
                key={c.id}
                onClick={() => selectCourse(c.id)}
                className="snap-start flex-shrink-0 flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition-colors"
                style={active
                  ? { background: 'var(--ist-text)', color: 'var(--ist-bg)' }
                  : { background: 'var(--ist-w8)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-border)' }
                }
              >
                <span className="opacity-60 tabular-nums">{i + 1}</span>
                <span className="max-w-[56vw] truncate">{c.title}</span>
                <span className="text-[11px] font-medium opacity-60 tabular-nums">{s.done}/{s.total}</span>
              </button>
            )
          })}
        </div>
      )}

      {course && (
        <div className="cinema-px" style={{ maxWidth: 'calc(64rem + var(--g-l) + var(--g-r))' }}>
          {/* Intestazione del corso selezionato */}
          <div className="mb-3 lg:mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[22px] lg:text-[28px] font-extrabold tracking-tight leading-tight" style={{ color: 'var(--ist-text)' }}>
                {course.title}
              </h2>
              {!course.published && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }}
                >
                  BOZZA
                </span>
              )}
            </div>
            {course.description && course.description !== cat.description && (
              <p className="text-sm leading-relaxed mt-1 max-w-3xl" style={{ color: 'var(--ist-text-muted)' }}>
                {course.description}
              </p>
            )}
            <p className="text-xs mt-1.5" style={{ color: 'var(--ist-text-dim)' }}>
              {getCourseStats(course).done}/{course.lessons.length} lezioni completate
            </p>
          </div>

          {/* Episodi */}
          {course.lessons.length === 0 ? (
            <p className="text-sm py-10 text-center" style={{ color: 'var(--ist-text-dim)' }}>
              Nessuna lezione in questo corso.
            </p>
          ) : (
            <div>
              {course.lessons.map((lesson, i) => (
                <EpisodeRow
                  key={lesson.id}
                  entry={{ lesson, course, category: cat, number: i + 1 }}
                  isNext={lesson.id === resume?.entry.lesson.id}
                  isLast={i === course.lessons.length - 1}
                  onClick={() => openLesson(lesson.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Riga "episodio": numero (desktop), miniatura, titolo, durata, descrizione.
function EpisodeRow({
  entry, isNext, isLast, onClick,
}: {
  entry: LessonEntry
  isNext: boolean
  isLast: boolean
  onClick: () => void
}) {
  const { lesson, category, number } = entry
  const tone = useCoverTone()
  const remaining = remainingLabel(lesson)
  const status = lesson.done ? 'Completata' : remaining

  return (
    <button
      onClick={onClick}
      className={`media-card group block w-[calc(100%+1.25rem)] text-left py-3 px-2.5 -mx-2.5 rounded-xl lg:w-full lg:py-4 lg:px-4 lg:mx-0 lg:rounded-2xl transition-colors ${isNext ? '' : 'hover:bg-[var(--ist-w5)]'}`}
      style={{
        background: isNext ? 'var(--ist-w6)' : undefined,
        borderBottom: isLast || isNext ? '1px solid transparent' : '1px solid var(--ist-w7)',
      }}
    >
      <div className="flex items-center gap-3 lg:gap-5">
        <span
          className="hidden lg:block w-7 text-center text-2xl font-bold tabular-nums flex-shrink-0"
          style={{ color: isNext ? 'var(--ist-text)' : 'var(--ist-text-dim)' }}
        >
          {number}
        </span>

        <div className="w-[42%] max-w-[176px] sm:w-44 lg:w-52 lg:max-w-none flex-shrink-0">
          <MediaThumb
            {...lessonThumbProps(lesson, category, number, tone)}
            duration={undefined}
            rounded="rounded-lg"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm lg:text-base font-semibold leading-snug line-clamp-2" style={{ color: 'var(--ist-text)' }}>
              <span className="lg:hidden">{number}. </span>{lesson.title}
            </p>
            {lesson.durationSeconds > 0 && (
              <span className="hidden lg:block text-sm flex-shrink-0 tabular-nums" style={{ color: 'var(--ist-text-dim)' }}>
                {lesson.duration}
              </span>
            )}
          </div>

          <p className="text-xs mt-0.5 lg:hidden" style={{ color: 'var(--ist-text-dim)' }}>
            {[lesson.durationSeconds > 0 ? lesson.duration : null, status].filter(Boolean).join(' · ')}
          </p>

          {lesson.description && (
            <p className="hidden lg:block text-sm leading-relaxed mt-1 line-clamp-2" style={{ color: 'var(--ist-text-muted)' }}>
              {lesson.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
            {status && <span className="hidden lg:inline" style={{ color: lesson.done ? '#46D39A' : undefined }}>{status}</span>}
            {lesson.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip size={11} strokeWidth={2} />
                {lesson.attachments.length} {lesson.attachments.length === 1 ? 'allegato' : 'allegati'}
              </span>
            )}
          </div>
        </div>
      </div>

      {lesson.description && (
        <p className="lg:hidden text-[13px] leading-relaxed mt-2 line-clamp-3" style={{ color: 'var(--ist-text-muted)' }}>
          {lesson.description}
        </p>
      )}
    </button>
  )
}
