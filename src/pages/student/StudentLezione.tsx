import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle2, Play, Paperclip, Download,
  FileText, Sheet, Presentation, Archive, File, ChevronRight, Loader2,
} from 'lucide-react'
import { useStudentCatalog, Attachment } from '../../lib/content'
import { attachmentUrl } from '../../lib/storage'
import VimeoPlayer from '../../components/ui/VimeoPlayer'
import UpgradeWall from '../../components/auth/UpgradeWall'
import { isFreeUser } from '../../lib/freeTier'
import { useUI } from '../../context/UIContext'
import { useAuth } from '../../context/AuthContext'

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

// ─── Playlist Panel ──────────────────────────────────────────────────────────

function PlaylistPanel({
  course,
  currentId,
  accent,
  onSelect,
}: {
  course: import('../../lib/content').Course
  currentId: string
  accent: string
  onSelect: (id: string) => void
}) {
  return (
    <div>
      {course.lessons.map((l, i) => {
        const isCurrent = l.id === currentId
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
            style={{
              borderLeft: `3px solid ${isCurrent ? accent : 'transparent'}`,
              background: isCurrent ? `${accent}0e` : 'transparent',
              borderBottom: i < course.lessons.length - 1 ? '1px solid var(--ist-w7)' : 'none',
            }}
          >
            {/* Index / state */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={
                l.done
                  ? { background: 'rgba(70,211,154,0.13)', color: '#46D39A' }
                  : isCurrent
                    ? { background: `${accent}1a`, color: accent }
                    : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }
              }
            >
              {l.done
                ? <CheckCircle2 size={13} strokeWidth={2} />
                : isCurrent
                  ? <Play size={11} strokeWidth={2} />
                  : <span>{i + 1}</span>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium leading-tight"
                style={{
                  color: isCurrent ? 'var(--ist-text)' : l.done ? 'var(--ist-text-dim)' : 'var(--ist-text-muted)',
                  textDecoration: l.done && !isCurrent ? 'line-through' : 'none',
                }}
              >
                {l.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>{l.duration}</span>
                {l.attachments.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
                    <Paperclip size={9} strokeWidth={2} />
                    {l.attachments.length}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MobileTab = 'playlist' | 'allegati'

export default function StudentLezione() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate     = useNavigate()
  const { setHideBottomNav } = useUI()
  const { user } = useAuth()
  const { findLesson, markDone, saveLastPosition, loading } = useStudentCatalog(user?.id ?? '')
  const [mobileTab, setMobileTab] = useState<MobileTab>('playlist')
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
  const nextLesson = course.lessons[lessonIdx + 1] ?? null

  const handleToggleDone = async () => {
    setMarking(true)
    await markDone(lesson.id, !lesson.done)
    setMarking(false)
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">

      {/* ── LEFT / MAIN ── */}
      <div className="flex-1 min-w-0 p-4 lg:p-6 lg:pr-3 flex flex-col gap-5">

        {/* Mobile back button — replaces breadcrumb on small screens */}
        <button
          onClick={() => navigate(`/student/corsi/${category.id}`)}
          className="lg:hidden flex items-center gap-1.5 text-sm font-medium -mb-1 transition-opacity hover:opacity-70"
          style={{ color: 'var(--ist-text-muted)' }}
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
          {category.title}
        </button>

        {/* Breadcrumb — desktop only */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs flex-wrap">
          <button
            onClick={() => navigate('/student/corsi')}
            className="transition-opacity hover:opacity-70 font-medium"
            style={{ color: 'var(--ist-text-muted)' }}
          >
            Videocorsi
          </button>
          <ChevronRight size={11} strokeWidth={2.5} style={{ color: 'var(--ist-text-dim)' }} />
          <button
            onClick={() => navigate(`/student/corsi/${category.id}`)}
            className="transition-opacity hover:opacity-70 font-medium"
            style={{ color: 'var(--ist-text-muted)' }}
          >
            {category.title}
          </button>
          <ChevronRight size={11} strokeWidth={2.5} style={{ color: 'var(--ist-text-dim)' }} />
          <span className="truncate max-w-[180px]" style={{ color: 'var(--ist-text-dim)' }}>
            {lesson.title}
          </span>
        </nav>

        {/* Video player — riprende dall'ultimo punto, salva la posizione e
            segna la lezione completata a fine video. */}
        <VimeoPlayer
          key={lesson.id}
          vimeoId={lesson.vimeoId}
          accent={category.accent}
          startAt={lesson.lastPositionSeconds}
          onProgress={sec => saveLastPosition(lesson.id, sec)}
          onEnded={() => { if (!lesson.done) markDone(lesson.id, true) }}
        />

        {/* Lesson info */}
        <div>
          <div className="flex items-start gap-3 mb-2 flex-wrap">
            <h1 className="text-lg lg:text-xl font-bold leading-tight flex-1 min-w-0" style={{ color: 'var(--ist-text)' }}>
              {lesson.title}
            </h1>
            {lesson.done && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: 'rgba(70,211,154,0.12)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.22)' }}
              >
                <CheckCircle2 size={12} strokeWidth={2.5} />
                Completata
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            {lesson.description}
          </p>

          {/* Mark complete / re-review toggle */}
          <button
            onClick={handleToggleDone}
            disabled={marking}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={lesson.done
              ? { background: 'var(--ist-w6)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-muted)' }
              : { background: 'linear-gradient(135deg, #46D39A 0%, #2BA877 100%)', border: '1px solid rgba(70,211,154,0.30)', color: '#fff' }
            }
          >
            {marking
              ? <Loader2 size={14} className="animate-spin" />
              : <CheckCircle2 size={14} strokeWidth={2.5} />}
            {lesson.done ? 'Segna come da rivedere' : 'Segna come completata'}
          </button>
        </div>

        {/* Allegati — desktop */}
        {lesson.attachments.length > 0 && (
          <div className="hidden lg:block">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--ist-text-dim)' }}>
              <Paperclip size={12} strokeWidth={2} />
              Allegati ({lesson.attachments.length})
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {lesson.attachments.map(att => <AttachmentCard key={att.id} att={att} />)}
            </div>
          </div>
        )}

        {/* Mobile tabs */}
        <div className="lg:hidden space-y-3">
          <div
            className="flex gap-1 p-1 rounded-2xl"
            style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)' }}
          >
            {(['playlist', 'allegati'] as MobileTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={mobileTab === tab ? {
                  background: 'var(--ist-card-bg)',
                  color: 'var(--ist-text)',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.15)',
                } : {
                  color: 'var(--ist-text-muted)',
                }}
              >
                {tab === 'playlist'
                  ? `Playlist (${course.lessons.length})`
                  : `Allegati (${lesson.attachments.length})`
                }
              </button>
            ))}
          </div>

          {mobileTab === 'allegati' ? (
            lesson.attachments.length > 0
              ? <div className="space-y-2">{lesson.attachments.map(att => <AttachmentCard key={att.id} att={att} />)}</div>
              : <p className="text-sm text-center py-8" style={{ color: 'var(--ist-text-dim)' }}>Nessun allegato.</p>
          ) : (
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)', boxShadow: 'var(--ist-card-shadow)' }}
            >
              <PlaylistPanel course={course} currentId={lesson.id} accent={category.accent} onSelect={id => navigate(`/student/corsi/lezione/${id}`)} />
            </div>
          )}
        </div>

        {/* Next lesson CTA — mobile */}
        {nextLesson && (
          <button
            onClick={() => navigate(`/student/corsi/lezione/${nextLesson.id}`)}
            className="lg:hidden w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5"
            style={{
              background: `${category.accent}12`,
              border: `1px solid ${category.accent}28`,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: category.accent }}
            >
              <Play size={12} strokeWidth={2} fill="white" color="white" style={{ marginLeft: 1 }} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: category.accent }}>
                Prossima lezione
              </p>
              <p className="text-xs font-medium truncate" style={{ color: 'var(--ist-text)' }}>
                {nextLesson.title}
              </p>
            </div>
            <ChevronRight size={14} strokeWidth={2} style={{ color: category.accent, flexShrink: 0 }} />
          </button>
        )}
      </div>

      {/* ── RIGHT SIDEBAR — desktop playlist ── */}
      <div
        className="hidden lg:flex flex-col w-[320px] xl:w-[360px] flex-shrink-0"
        style={{
          borderLeft: '1px solid var(--ist-border)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: 'var(--ist-nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflowY: 'auto',
        }}
      >
        {/* Sidebar header */}
        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--ist-border)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--ist-text-dim)' }}>
            Playlist
          </p>
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ist-text)' }}>
            {course.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>
            {course.lessons.filter(l => l.done).length}/{course.lessons.length} completate
          </p>
        </div>

        {/* Playlist */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <PlaylistPanel
            course={course}
            currentId={lesson.id}
            accent={category.accent}
            onSelect={id => navigate(`/student/corsi/lezione/${id}`)}
          />
        </div>

        {/* Next lesson CTA */}
        {nextLesson && (
          <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--ist-border)' }}>
            <button
              onClick={() => navigate(`/student/corsi/lezione/${nextLesson.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:-translate-y-0.5"
              style={{
                background: `${category.accent}12`,
                border: `1px solid ${category.accent}28`,
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: category.accent }}
              >
                <Play size={12} strokeWidth={2} fill="white" color="white" style={{ marginLeft: 1 }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: category.accent }}>
                  Prossima lezione
                </p>
                <p className="text-xs font-medium truncate" style={{ color: 'var(--ist-text)' }}>
                  {nextLesson.title}
                </p>
              </div>
              <ChevronRight size={14} strokeWidth={2} style={{ color: category.accent, flexShrink: 0 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
