import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import {
  ChevronDown, Plus, Edit2, Trash2,
  Paperclip, Video, FolderOpen, BookOpen, Radio, Clock, Users,
  GripVertical, CheckCircle2,
} from 'lucide-react'
import { CATEGORIES, Category, Lesson } from '../../data/coursesData'
import { LIVE_EVENTS, LiveEvent } from '../../data/liveData'

type Tab = 'corsi' | 'live'
type ExpandState = { categories: Set<string>; courses: Set<string> }

const PHASE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Onboarding: { bg: 'rgba(124,187,208,0.12)', text: '#7CBBD0',  border: 'rgba(124,187,208,0.22)' },
  Build:      { bg: 'rgba(70,211,154,0.12)',  text: '#46D39A',  border: 'rgba(70,211,154,0.22)'  },
  Test:       { bg: 'rgba(246,200,95,0.12)',  text: '#F6C85F',  border: 'rgba(246,200,95,0.22)'  },
  Deploy:     { bg: 'rgba(160,120,255,0.12)', text: '#A078FF',  border: 'rgba(160,120,255,0.22)' },
}

function PhaseBadge({ phase }: { phase: string }) {
  const s = PHASE_STYLE[phase] ?? PHASE_STYLE.Build
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {phase}
    </span>
  )
}

function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
      style={published
        ? { background: 'rgba(70,211,154,0.12)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.22)' }
        : { background: 'var(--ist-w6)', color: 'var(--ist-text-dim)', border: '1px solid var(--ist-border)' }
      }
    >
      {published ? 'Pubblicato' : 'Bozza'}
    </span>
  )
}

function ActionBtn({ icon, label, danger, onClick }: {
  icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors hover:bg-white/[0.04]"
      style={{ color: danger ? 'rgba(255,107,122,0.70)' : 'var(--ist-text-dim)' }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ─── Courses Tab ─────────────────────────────────────────────────────────────

function CoursesTab({ cats }: { cats: Category[] }) {
  const [expanded, setExpanded] = useState<ExpandState>({
    categories: new Set(cats.map(c => c.id)),
    courses:    new Set(),
  })

  const toggleCat    = (id: string) => setExpanded(prev => { const s = new Set(prev.categories); s.has(id) ? s.delete(id) : s.add(id); return { ...prev, categories: s } })
  const toggleCourse = (id: string) => setExpanded(prev => { const s = new Set(prev.courses);    s.has(id) ? s.delete(id) : s.add(id); return { ...prev, courses: s } })

  return (
    <div className="space-y-3">
      {cats.map(cat => {
        const catExpanded = expanded.categories.has(cat.id)
        const totalLessons = cat.courses.flatMap(c => c.lessons).length

        return (
          <div
            key={cat.id}
            className="rounded-3xl overflow-hidden"
            style={{
              background: 'var(--ist-card-bg)',
              border: '1px solid var(--ist-border)',
              boxShadow: 'var(--ist-card-shadow)',
            }}
          >
            {/* Accent stripe */}
            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${cat.accent}, ${cat.accent}40)` }} />

            {/* Category header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: catExpanded ? '1px solid var(--ist-border)' : 'none' }}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: cat.accent, boxShadow: `0 0 6px ${cat.accent}60` }} />
              <button
                onClick={() => toggleCat(cat.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="font-bold text-sm truncate" style={{ color: 'var(--ist-text)' }}>
                  {cat.title}
                </span>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] hidden sm:block" style={{ color: 'var(--ist-text-dim)' }}>
                  {cat.courses.length} corsi · {totalLessons} lezioni
                </span>
                <PhaseBadge phase={cat.phase} />
                <PublishedBadge published={cat.published} />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" />
                <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger />
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.04]"
                  style={{ color: 'var(--ist-text-dim)' }}
                >
                  <ChevronDown size={13} strokeWidth={2}
                    style={{ transform: catExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>
            </div>

            {/* Courses */}
            {catExpanded && (
              <div className="pb-3 px-3 flex flex-col gap-2 pt-2">
                {cat.courses.map(course => {
                  const courseExpanded = expanded.courses.has(course.id)
                  return (
                    <div
                      key={course.id}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-border)' }}
                    >
                      {/* Course row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <GripVertical size={13} strokeWidth={2} style={{ color: 'var(--ist-text-dim)', flexShrink: 0, cursor: 'grab' }} />
                        <BookOpen size={13} strokeWidth={2} style={{ color: cat.accent, flexShrink: 0 }} />
                        <button onClick={() => toggleCourse(course.id)} className="flex-1 min-w-0 text-left">
                          <span className="text-xs font-semibold truncate block" style={{ color: 'var(--ist-text)' }}>
                            {course.title}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] hidden sm:block" style={{ color: 'var(--ist-text-dim)' }}>
                            {course.lessons.length} lezioni
                          </span>
                          <PhaseBadge phase={course.phase} />
                          <PublishedBadge published={course.published} />
                          <ActionBtn icon={<Plus size={11} strokeWidth={2.5} />} label="+ lezione" />
                          <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" />
                          <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger />
                          <button
                            onClick={() => toggleCourse(course.id)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-black/[0.04]"
                            style={{ color: 'var(--ist-text-dim)' }}
                          >
                            <ChevronDown size={11} strokeWidth={2}
                              style={{ transform: courseExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>
                        </div>
                      </div>

                      {/* Lessons */}
                      {courseExpanded && (
                        <div style={{ borderTop: '1px solid var(--ist-border)' }}>
                          {course.lessons.map((lesson, i) => (
                            <LessonRow
                              key={lesson.id}
                              lesson={lesson}
                              isLast={i === course.lessons.length - 1}
                            />
                          ))}
                          <button
                            className="w-full flex items-center gap-2 px-4 py-3 transition-colors hover:bg-black/[0.02]"
                            style={{ borderTop: '1px solid var(--ist-border)' }}
                          >
                            <Plus size={12} strokeWidth={2.5} style={{ color: 'var(--ist-accent-text)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--ist-accent-text)' }}>
                              Aggiungi lezione
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add course */}
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-colors hover:bg-black/[0.02]"
                  style={{ border: `1px dashed ${cat.accent}35`, color: cat.accent }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  <span className="text-xs font-medium">Aggiungi corso</span>
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Add category */}
      <button
        className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl transition-all hover:bg-black/[0.02]"
        style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="text-sm font-medium">Nuova categoria</span>
      </button>
    </div>
  )
}

function LessonRow({ lesson, isLast }: { lesson: Lesson; isLast: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-black/[0.02]"
      style={{ borderBottom: !isLast ? '1px solid var(--ist-border)' : 'none' }}
    >
      <GripVertical size={11} strokeWidth={2} style={{ color: 'var(--ist-text-dim)', flexShrink: 0, cursor: 'grab' }} />
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={lesson.done
          ? { background: 'rgba(70,211,154,0.12)', color: '#46D39A' }
          : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }
        }
      >
        {lesson.done
          ? <CheckCircle2 size={11} strokeWidth={2} />
          : <Video size={9} strokeWidth={2} />
        }
      </div>
      <span className="flex-1 text-[11px] font-medium truncate" style={{ color: 'var(--ist-text-muted)' }}>
        {lesson.title}
      </span>
      <div className="flex items-center gap-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {lesson.attachments.length > 0 && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
            <Paperclip size={10} strokeWidth={2} />
            {lesson.attachments.length}
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
          <Clock size={9} strokeWidth={2} />
          {lesson.duration}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <ActionBtn icon={<Edit2 size={10} strokeWidth={2} />} label="Modifica" />
        <ActionBtn icon={<Trash2 size={10} strokeWidth={2} />} label="Elimina" danger />
      </div>
    </div>
  )
}

// ─── Live Tab ─────────────────────────────────────────────────────────────────

const LIVE_STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  live:     { bg: 'rgba(255,80,80,0.10)',   text: '#FF5050', border: 'rgba(255,80,80,0.22)',  label: 'In diretta'   },
  upcoming: { bg: 'rgba(90,154,177,0.12)',  text: '#7CBBD0', border: 'rgba(90,154,177,0.22)', label: 'Programmata'  },
  replay:   { bg: 'var(--ist-w6)',          text: 'var(--ist-text-dim)', border: 'var(--ist-border)', label: 'Replay' },
}

function LiveTab({ events }: { events: LiveEvent[] }) {
  return (
    <div className="space-y-2.5">
      {events.map(event => {
        const s = LIVE_STATUS[event.status]
        return (
          <div
            key={event.id}
            className="flex items-center gap-4 p-4 lg:p-5 rounded-3xl"
            style={{
              background: 'var(--ist-card-bg)',
              border: '1px solid var(--ist-border)',
              boxShadow: 'var(--ist-card-shadow)',
            }}
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${event.accent}12`, border: `1px solid ${event.accent}22` }}
            >
              <Radio size={16} strokeWidth={2} style={{ color: event.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--ist-text)' }}>
                  {event.title}
                </p>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                >
                  {s.label}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                {event.host} · {event.date}
                {event.duration && <> · {event.duration}</>}
                {event.viewers && (
                  <span className="ml-2 inline-flex items-center gap-0.5">
                    <Users size={9} strokeWidth={2} /> {event.viewers} live
                  </span>
                )}
                {event.views && (
                  <span className="ml-2 inline-flex items-center gap-0.5">
                    <Users size={9} strokeWidth={2} /> {event.views} visualiz.
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <ActionBtn icon={<Edit2 size={11} strokeWidth={2} />} label="Modifica" />
              <ActionBtn icon={<Trash2 size={11} strokeWidth={2} />} label="Elimina" danger />
            </div>
          </div>
        )
      })}

      <button
        className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl transition-all hover:bg-black/[0.02]"
        style={{ border: '1px dashed var(--ist-border-strong)', color: 'var(--ist-accent-text)' }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="text-sm font-medium">Nuova sessione live</span>
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminContenuti() {
  const [tab, setTab] = useState<Tab>('corsi')

  const totalCats    = CATEGORIES.length
  const totalCourses = CATEGORIES.reduce((s, c) => s + c.courses.length, 0)
  const totalLessons = CATEGORIES.flatMap(c => c.courses.flatMap(cr => cr.lessons)).length
  const totalLive    = LIVE_EVENTS.length

  const tabs = [
    { id: 'corsi' as Tab, label: 'Videocorsi', count: totalCats },
    { id: 'live'  as Tab, label: 'Live & Replay', count: totalLive },
  ]

  return (
    <div className="p-5 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Gestione Contenuti"
        subtitle="Categorie, videocorsi, lezioni e sessioni live"
        action={
          <button
            className="px-5 py-2.5 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 24px rgba(40,102,128,0.36)',
            }}
          >
            + Aggiungi
          </button>
        }
      />

      {/* Stats bar */}
      <div
        className="flex items-center gap-5 px-5 py-3.5 rounded-2xl mb-6 flex-wrap"
        style={{
          background: 'var(--ist-card-bg)',
          border: '1px solid var(--ist-border)',
          boxShadow: 'var(--ist-card-shadow)',
        }}
      >
        {[
          { label: 'Categorie', value: totalCats,    icon: <FolderOpen size={13} strokeWidth={2} /> },
          { label: 'Corsi',     value: totalCourses, icon: <BookOpen   size={13} strokeWidth={2} /> },
          { label: 'Lezioni',   value: totalLessons, icon: <Video      size={13} strokeWidth={2} /> },
          { label: 'Live',      value: totalLive,    icon: <Radio      size={13} strokeWidth={2} /> },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'var(--ist-accent-text)' }}>{s.icon}</span>
              <span className="text-xl font-bold" style={{ color: 'var(--ist-text)' }}>{s.value}</span>
              <span className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && (
              <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--ist-border)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-5 p-1 rounded-2xl w-fit"
        style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)' }}
      >
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === t.id ? {
              background: 'var(--ist-card-bg)',
              color: 'var(--ist-text)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            } : {
              color: 'var(--ist-text-muted)',
            }}
          >
            {t.label}
            <span
              className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={tab === t.id
                ? { background: 'rgba(90,154,177,0.15)', color: 'var(--ist-accent-text)' }
                : { background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }
              }
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'corsi' && <CoursesTab cats={CATEGORIES} />}
      {tab === 'live'  && <LiveTab events={LIVE_EVENTS} />}
    </div>
  )
}
