import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronDown, CheckCircle2, Play, Paperclip, BookOpen, Loader2 } from 'lucide-react'
import { useStudentCatalog, getCourseStats, getCategoryStats } from '../../lib/content'
import { useAuth } from '../../context/AuthContext'

const PHASE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Onboarding: { bg: 'rgba(124,187,208,0.12)', text: '#7CBBD0',  border: 'rgba(124,187,208,0.22)' },
  Build:      { bg: 'rgba(70,211,154,0.12)',  text: '#46D39A',  border: 'rgba(70,211,154,0.22)'  },
  Test:       { bg: 'rgba(246,200,95,0.12)',  text: '#F6C85F',  border: 'rgba(246,200,95,0.22)'  },
  Deploy:     { bg: 'rgba(160,120,255,0.12)', text: '#A078FF',  border: 'rgba(160,120,255,0.22)' },
}

export default function StudentCategoryDetail() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate       = useNavigate()
  const { user } = useAuth()
  const { findCategory, loading } = useStudentCatalog(user?.id ?? '')
  const cat            = findCategory(categoryId ?? '')
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)

  // Default-expand the first course once the category has loaded.
  useEffect(() => {
    setExpandedCourse(cat?.courses[0]?.id ?? null)
  }, [cat])

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

  const catStats   = getCategoryStats(cat)
  const phaseStyle = PHASE_STYLE[cat.phase] ?? PHASE_STYLE.Build

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">

      {/* Back */}
      <button
        onClick={() => navigate('/student/corsi')}
        className="flex items-center gap-1.5 text-sm font-medium mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--ist-text-muted)' }}
      >
        <ChevronLeft size={15} strokeWidth={2.5} />
        Videocorsi
      </button>

      {/* ── Category header card ── */}
      <div
        className="rounded-3xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'var(--ist-card-bg-premium)',
          border: `1px solid ${cat.accent}25`,
          boxShadow: 'var(--ist-card-shadow-premium)',
        }}
      >
        {/* Accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${cat.accent}, ${cat.accent}40)` }}
        />
        {/* Subtle accent glow in background */}
        <div
          className="absolute top-0 left-0 w-64 h-32 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 0% 0%, ${cat.accent}18 0%, transparent 70%)`,
          }}
        />

        <div className="relative flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${cat.accent}15`, border: `1px solid ${cat.accent}25` }}
          >
            <BookOpen size={20} strokeWidth={2} style={{ color: cat.accent }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: phaseStyle.bg, color: phaseStyle.text, border: `1px solid ${phaseStyle.border}` }}
              >
                {cat.phase}
              </span>
            </div>
            <h1 className="text-xl font-bold leading-tight mb-1.5" style={{ color: 'var(--ist-text)' }}>
              {cat.title}
            </h1>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ist-text-muted)' }}>
              {cat.description}
            </p>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px]" style={{ color: 'var(--ist-text-muted)' }}>
                    {catStats.done}/{catStats.total} lezioni
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: cat.accent }}>
                    {catStats.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--ist-w10)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${catStats.pct}%`,
                      background: cat.accent,
                      boxShadow: `0 0 8px ${cat.accent}55`,
                      minWidth: catStats.pct > 0 ? 5 : 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Course list ── */}
      <div className="space-y-3">
        {cat.courses.map((course) => {
          const stats      = getCourseStats(course)
          const isExpanded = expandedCourse === course.id
          const isComplete = stats.done === stats.total && stats.total > 0

          return (
            <div
              key={course.id}
              className="rounded-3xl overflow-hidden"
              style={{
                background: 'var(--ist-card-bg)',
                border: '1px solid var(--ist-border)',
                boxShadow: 'var(--ist-card-shadow)',
              }}
            >
              {/* Course header */}
              <button
                onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                className="w-full flex items-center gap-4 p-5 text-left transition-colors hover:bg-white/[0.015]"
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={isComplete
                    ? { background: 'rgba(70,211,154,0.12)', border: '1px solid rgba(70,211,154,0.22)', color: '#46D39A' }
                    : { background: `${cat.accent}12`, border: `1px solid ${cat.accent}22`, color: cat.accent }
                  }
                >
                  {isComplete
                    ? <CheckCircle2 size={17} strokeWidth={2} />
                    : <Play size={15} strokeWidth={2} />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: 'var(--ist-text)' }}>
                      {course.title}
                    </p>
                    {!course.published && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-dim)' }}
                      >
                        BOZZA
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                    {stats.done}/{stats.total} lezioni completate
                  </p>
                </div>

                {/* Mini progress */}
                <div className="hidden sm:flex items-center gap-2.5 flex-shrink-0">
                  <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--ist-w10)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${stats.pct}%`, background: cat.accent, minWidth: stats.pct > 0 ? 4 : 0 }}
                    />
                  </div>
                  <span className="text-[11px] font-bold w-8 text-right" style={{ color: cat.accent }}>
                    {stats.pct}%
                  </span>
                </div>

                <ChevronDown
                  size={15}
                  strokeWidth={2}
                  className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--ist-text-muted)' }}
                />
              </button>

              {/* Lesson list */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--ist-border)' }}>
                  {course.lessons.map((lesson, i) => (
                    <button
                      key={lesson.id}
                      onClick={() => navigate(`/student/corsi/lezione/${lesson.id}`)}
                      className="w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] group"
                      style={{ borderBottom: i < course.lessons.length - 1 ? '1px solid var(--ist-w7)' : 'none' }}
                    >
                      {/* Status icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={lesson.done
                          ? { background: 'rgba(70,211,154,0.12)', color: '#46D39A' }
                          : { background: 'var(--ist-w8)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-muted)' }
                        }
                      >
                        {lesson.done
                          ? <CheckCircle2 size={14} strokeWidth={2} />
                          : <Play size={12} strokeWidth={2} />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium leading-tight"
                          style={{
                            color: lesson.done ? 'var(--ist-text-dim)' : 'var(--ist-text)',
                            textDecoration: lesson.done ? 'line-through' : 'none',
                          }}
                        >
                          {lesson.title}
                        </p>
                        {lesson.attachments.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Paperclip size={10} strokeWidth={2} style={{ color: 'var(--ist-text-dim)' }} />
                            <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
                              {lesson.attachments.length} {lesson.attachments.length === 1 ? 'allegato' : 'allegati'}
                            </span>
                          </div>
                        )}
                      </div>

                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>
                        {lesson.duration}
                      </span>

                      <ChevronDown
                        size={13}
                        strokeWidth={2}
                        className="flex-shrink-0 -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--ist-text-dim)' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
