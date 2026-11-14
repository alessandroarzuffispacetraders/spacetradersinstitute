import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Check, Play, Paperclip, Download, RotateCcw,
  FileText, Sheet, Presentation, Archive, File, Loader2, Plus,
} from 'lucide-react'
import { useStudentCatalog, Attachment, Category, Lesson } from '../../lib/content'
import MediaThumb from '../../components/media/MediaThumb'
import MediaRow from '../../components/media/MediaRow'
import LessonCard from '../../components/media/LessonCard'
import { lessonThumbProps } from '../../components/media/thumbProps'
import { attachmentUrl } from '../../lib/storage'
import CinemaPlayer from '../../components/player/CinemaPlayer'
import UpgradeWall from '../../components/auth/UpgradeWall'
import { isFreeUser } from '../../lib/freeTier'
import { useUI } from '../../context/UIContext'
import { useAuth } from '../../context/AuthContext'
import { useCinemaMode } from '../../context/ThemeContext'

// ─── file type helpers ────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, xlsx: Sheet, docx: FileText, pptx: Presentation, zip: Archive,
}
const FILE_COLORS: Record<string, string> = {
  pdf: '#FF6B7A', xlsx: '#46D39A', docx: '#7CBBD0', pptx: '#F6C85F', zip: '#A078FF',
}

function AttachmentCard({ att }: { att: Attachment }) {
  const Icon  = FILE_ICONS[att.type] ?? File
  const color = FILE_COLORS[att.type] ?? '#8495A3'
  const [busy, setBusy] = useState(false)
  const downloadable = !!att.objectKey

  const open = async () => {
    if (!downloadable || busy) return
    setBusy(true)
    const url = await attachmentUrl(att.objectKey as string)
    setBusy(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={!downloadable || busy}
      title={downloadable ? 'Scarica' : 'File non ancora disponibile'}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:translate-x-0.5 group disabled:opacity-60 disabled:hover:translate-x-0"
      style={{
        background: 'var(--ist-w6)',
        border: '1px solid var(--ist-border)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}
      >
        <Icon size={16} strokeWidth={2} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--ist-text)' }}>
          {att.name}
        </p>
        <p className="text-[10px] mt-0.5 uppercase font-semibold tracking-wide" style={{ color }}>
          {att.type} · {att.size}
        </p>
      </div>
      {busy
        ? <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--ist-text-muted)' }} />
        : <Download
            size={14}
            strokeWidth={2}
            className="flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
            style={{ color: 'var(--ist-text-muted)' }}
          />
      }
    </button>
  )
}

// ─── Fine video: prossima lezione con conto alla rovescia ─────────────────────

const NEXT_COUNTDOWN_S = 8

function NextUpOverlay({
  lesson, number, category, onPlay, onReplay,
}: {
  lesson: Lesson
  number: number
  category: Category
  onPlay: () => void
  onReplay: () => void
}) {
  const [left, setLeft] = useState(NEXT_COUNTDOWN_S)
  const [cancelled, setCancelled] = useState(false)
  // In un ref: il genitore ricrea onPlay a ogni render (es. movimento del mouse)
  // e non deve far ripartire il conto alla rovescia.
  const onPlayRef = useRef(onPlay)
  onPlayRef.current = onPlay

  useEffect(() => {
    if (cancelled) return
    if (left <= 0) { onPlayRef.current(); return }
    const t = window.setTimeout(() => setLeft(l => l - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, cancelled])

  return (
    <div className="absolute inset-0 flex items-end justify-end p-3 pb-20 lg:p-8 lg:pb-28 pointer-events-none">
      <div
        className="pointer-events-auto w-[min(92%,360px)] rounded-xl overflow-hidden"
        style={{ background: 'rgba(10,12,18,0.94)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="hidden sm:block">
          <MediaThumb {...lessonThumbProps(lesson, category, number)} rounded="" showPlay={false} />
        </div>
        <div className="p-3 lg:p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {cancelled ? 'Prossima lezione' : `Prossima lezione tra ${left}`}
          </p>
          <p className="text-sm lg:text-base font-bold leading-snug text-white line-clamp-2">
            {number}. {lesson.title}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onPlay}
              className="relative overflow-hidden flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold"
              style={{ background: '#ffffff', color: '#05070d' }}
            >
              {!cancelled && (
                <span
                  className="cinema-countdown absolute inset-0"
                  style={{ background: 'rgba(5,7,13,0.14)', animationDuration: `${NEXT_COUNTDOWN_S}s` }}
                />
              )}
              <Play size={15} strokeWidth={2.5} fill="currentColor" className="relative" />
              <span className="relative">Guarda ora</span>
            </button>
            {cancelled ? (
              <button
                onClick={onReplay}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                <RotateCcw size={14} strokeWidth={2.5} /> Rivedi
              </button>
            ) : (
              <button
                onClick={() => setCancelled(true)}
                className="h-10 px-3 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                Annulla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CourseDoneOverlay({ onBack, onReplay }: { onBack: () => void; onReplay: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="pointer-events-auto text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#46D39A' }}>
          <Check size={26} strokeWidth={3} className="text-white" />
        </div>
        <p className="text-lg lg:text-2xl font-extrabold text-white">Hai finito questo corso</p>
        <div className="mt-4 flex items-center justify-center gap-2.5">
          <button
            onClick={onBack}
            className="inline-flex items-center h-10 px-4 rounded-lg text-sm font-bold"
            style={{ background: '#ffffff', color: '#05070d' }}
          >
            Torna al corso
          </button>
          <button
            onClick={onReplay}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            <RotateCcw size={14} strokeWidth={2.5} /> Rivedi
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
// Stile streaming: palco nero con il player in alto, poi titolo e azioni,
// allegati, e la fila degli "episodi" del corso (aperta su quello in corso).

export default function StudentLezione() {
  useCinemaMode()
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate     = useNavigate()
  const { setHideBottomNav } = useUI()
  const { user } = useAuth()
  // 'all': il player deve trovare la lezione sia nei corsi trading che mental.
  const { findLesson, markDone, saveLastPosition, loading } = useStudentCatalog(user?.id ?? '', 'all')
  const [marking, setMarking] = useState(false)

  const found = findLesson(lessonId ?? '')

  useEffect(() => {
    setHideBottomNav(true)
    return () => setHideBottomNav(false)
  }, [setHideBottomNav])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
      </div>
    )
  }

  if (!found) {
    // Per l'utente gratuito una lezione "non trovata" è quasi sempre una lezione
    // riservata (nascosta dalla RLS): mostra l'upsell invece del generico errore.
    if (isFreeUser(user)) {
      return (
        <UpgradeWall
          title="Lezione riservata"
          body="Questa lezione fa parte del percorso completo IST. Passa alla versione completa per sbloccare tutti i videocorsi."
        />
      )
    }
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Lezione non trovata.</p>
        <button onClick={() => navigate('/student/corsi')} className="text-sm font-medium" style={{ color: 'var(--ist-accent-text)' }}>
          ← Torna ai corsi
        </button>
      </div>
    )
  }

  const { lesson, course, category } = found
  const lessonIdx  = course.lessons.findIndex(l => l.id === lesson.id)
  const number     = lessonIdx + 1
  const nextLesson = course.lessons[lessonIdx + 1] ?? null
  const courseUrl  = `/student/corsi/${category.id}?corso=${course.id}`
  const openLesson = (id: string) => navigate(`/student/corsi/lezione/${id}`, { replace: true })

  const handleToggleDone = async () => {
    setMarking(true)
    await markDone(lesson.id, !lesson.done)
    setMarking(false)
  }

  return (
    <div className="cinema-page pb-16">
      {/* ── Palco ── */}
      <section data-inverted="true" className="bg-black cinema-stage">
        <CinemaPlayer
          key={lesson.id}
          vimeoId={lesson.vimeoId}
          title={lesson.title}
          subtitle={`Lezione ${number}`}
          backLabel={course.title}
          onBack={() => navigate(courseUrl)}
          startAt={lesson.lastPositionSeconds}
          onProgress={sec => saveLastPosition(lesson.id, sec)}
          onEnded={() => { if (!lesson.done) markDone(lesson.id, true) }}
          nextLabel="Prossima lezione"
          onNext={nextLesson ? () => openLesson(nextLesson.id) : undefined}
          renderEnd={({ replay }) => nextLesson
            ? (
              <NextUpOverlay
                lesson={nextLesson}
                number={number + 1}
                category={category}
                onPlay={() => openLesson(nextLesson.id)}
                onReplay={replay}
              />
            )
            : <CourseDoneOverlay onBack={() => navigate(courseUrl)} onReplay={replay} />
          }
        />
      </section>

      {/* ── Info lezione ── */}
      <div className="cinema-px pt-5 lg:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-12 max-w-[1280px]">
          <div className="min-w-0">
            <button
              onClick={() => navigate(courseUrl)}
              className="text-[11px] font-bold uppercase tracking-[0.14em] mb-1.5 transition-opacity hover:opacity-70 text-left"
              style={{ color: 'var(--ist-accent-text)' }}
            >
              {category.title === course.title ? course.title : `${category.title} · ${course.title}`}
            </button>
            <h1
              className="text-[26px] lg:text-[40px] font-extrabold tracking-tight leading-[1.08]"
              style={{ color: 'var(--ist-text)', textWrap: 'balance' }}
            >
              {lesson.title}
            </h1>
            <div className="mt-2.5 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-sm" style={{ color: 'var(--ist-text-muted)' }}>
              <span>Lezione {number} di {course.lessons.length}</span>
              {lesson.durationSeconds > 0 && <><span aria-hidden>·</span><span>{lesson.duration}</span></>}
              {lesson.done && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(70,211,154,0.14)', color: '#46D39A' }}
                >
                  <Check size={12} strokeWidth={3} /> Completata
                </span>
              )}
            </div>
            {lesson.description && (
              <p className="mt-4 text-[15px] leading-relaxed max-w-3xl" style={{ color: 'var(--ist-text-muted)' }}>
                {lesson.description}
              </p>
            )}

            <div className="mt-5 flex items-center gap-2.5 flex-wrap">
              {nextLesson && (
                <button
                  onClick={() => openLesson(nextLesson.id)}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--ist-text)', color: 'var(--ist-bg)' }}
                >
                  <Play size={16} strokeWidth={2.5} fill="currentColor" />
                  Prossima lezione
                </button>
              )}
              <button
                onClick={handleToggleDone}
                disabled={marking}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={lesson.done
                  ? { background: 'rgba(70,211,154,0.14)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.28)' }
                  : { background: 'var(--ist-w8)', color: 'var(--ist-text)', border: '1px solid var(--ist-border)' }
                }
                title={lesson.done ? 'Segna come da rivedere' : 'Segna come completata'}
              >
                {marking
                  ? <Loader2 size={16} className="animate-spin" />
                  : lesson.done ? <CheckCircle2 size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
                {lesson.done ? 'Completata' : 'Segna come completata'}
              </button>
            </div>
          </div>

          {/* Allegati */}
          {lesson.attachments.length > 0 && (
            <aside>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--ist-text-dim)' }}>
                <Paperclip size={12} strokeWidth={2.2} />
                Materiali della lezione
              </h2>
              <div className="space-y-2">
                {lesson.attachments.map(att => <AttachmentCard key={att.id} att={att} />)}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Episodi del corso ── */}
      {course.lessons.length > 1 && (
        <div className="mt-10">
          <MediaRow
            eyebrow={course.title}
            title="Episodi"
            actionLabel="Vedi corso"
            onAction={() => navigate(courseUrl)}
            initialIndex={lessonIdx}
          >
            {course.lessons.map((l, i) => (
              <div key={l.id} className={l.id === lesson.id ? 'media-current' : ''}>
                <LessonCard
                  entry={{ lesson: l, course, category, number: i + 1 }}
                  onClick={() => openLesson(l.id)}
                  subtitle={l.id === lesson.id ? 'In riproduzione' : `Lezione ${i + 1}`}
                />
              </div>
            ))}
          </MediaRow>
        </div>
      )}
    </div>
  )
}
