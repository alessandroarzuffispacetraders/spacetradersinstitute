import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { useStudentCatalog, getCategoryStats, getCourseStats } from '../../lib/content'
import { useAuth } from '../../context/AuthContext'
import { BookOpen, ChevronRight, Play, CheckCircle2, Layers, Loader2 } from 'lucide-react'

const PHASE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Onboarding: { bg: 'rgba(124,187,208,0.12)', text: '#7CBBD0',  border: 'rgba(124,187,208,0.22)' },
  Build:      { bg: 'rgba(70,211,154,0.12)',  text: '#46D39A',  border: 'rgba(70,211,154,0.22)'  },
  Test:       { bg: 'rgba(246,200,95,0.12)',  text: '#F6C85F',  border: 'rgba(246,200,95,0.22)'  },
  Deploy:     { bg: 'rgba(160,120,255,0.12)', text: '#A078FF',  border: 'rgba(160,120,255,0.22)' },
}

export default function StudentCorsi() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { categories, loading } = useStudentCatalog(user?.id ?? '')

  const allLessons   = categories.flatMap(c => c.courses.flatMap(cr => cr.lessons))
  const totalDone    = allLessons.filter(l => l.done).length
  const totalLessons = allLessons.length
  const totalPct     = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0
  const totalCourses = categories.reduce((s, c) => s + c.courses.length, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
      </div>
    )
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Videocorsi"
        subtitle={`${totalDone} di ${totalLessons} lezioni completate`}
      />

      {/* ── Stats overview ── */}
      <div
        className="rounded-3xl p-5 lg:p-6 mb-7"
        style={{
          background: 'var(--ist-card-bg-premium)',
          border: '1px solid var(--ist-card-border-premium)',
          boxShadow: 'var(--ist-card-shadow-premium)',
        }}
      >
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--ist-text-muted)' }}>Progresso totale</span>
              <span className="text-xs font-bold" style={{ color: 'var(--ist-accent-text)' }}>{totalPct}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: 'var(--ist-w10)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${totalPct}%`,
                  background: 'linear-gradient(90deg, #7CBBD0, #286680)',
                  boxShadow: '0 0 12px rgba(124,187,208,0.45)',
                  minWidth: totalPct > 0 ? 6 : 0,
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-6">
          {[
            { value: categories.length, label: 'Categorie', icon: <Layers size={13} strokeWidth={2} /> },
            { value: totalCourses,      label: 'Corsi',     icon: <BookOpen size={13} strokeWidth={2} /> },
            { value: totalLessons,      label: 'Lezioni',   icon: <Play size={13} strokeWidth={2} /> },
            { value: totalDone,         label: 'Completate', icon: <CheckCircle2 size={13} strokeWidth={2} /> },
          ].map((s, i, arr) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center">
                  <span style={{ color: 'var(--ist-accent-text)' }}>{s.icon}</span>
                  <span className="text-xl font-bold" style={{ color: 'var(--ist-text)' }}>{s.value}</span>
                </div>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>{s.label}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="w-px h-8 hidden sm:block" style={{ background: 'var(--ist-border)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Category cards ── */}
      <div className="space-y-4">
        {categories.length === 0 && (
          <div
            className="rounded-3xl p-10 text-center"
            style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
              Nessun videocorso disponibile al momento.
            </p>
          </div>
        )}
        {categories.map((cat) => {
          const stats     = getCategoryStats(cat)
          const phaseStyle = PHASE_STYLE[cat.phase] ?? PHASE_STYLE.Build

          return (
            <button
              key={cat.id}
              onClick={() => navigate(`/student/corsi/${cat.id}`)}
              className="w-full text-left rounded-3xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 group"
              style={{
                background: 'var(--ist-card-bg)',
                border: '1px solid var(--ist-border)',
                boxShadow: 'var(--ist-card-shadow)',
              }}
            >
              {/* Accent stripe */}
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${cat.accent}, ${cat.accent}40)` }} />

              <div className="p-5 lg:p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${cat.accent}15`, border: `1px solid ${cat.accent}25` }}
                  >
                    <BookOpen size={18} strokeWidth={2} style={{ color: cat.accent }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + badges */}
                    <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-base font-bold leading-tight" style={{ color: 'var(--ist-text)' }}>
                        {cat.title}
                      </h3>
                      <div className="flex gap-1.5 flex-shrink-0 mt-px">
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: phaseStyle.bg, color: phaseStyle.text, border: `1px solid ${phaseStyle.border}` }}
                        >
                          {cat.phase}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ist-text-muted)' }}>
                      {cat.description}
                    </p>

                    {/* Meta + progress */}
                    <div className="flex items-center gap-1 mb-3 flex-wrap">
                      <span className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
                        {cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'} ·
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
                        {stats.total} lezioni
                      </span>
                      <span className="mx-1" style={{ color: 'var(--ist-border)' }}>·</span>
                      <span className="text-[11px] font-semibold" style={{ color: cat.accent }}>
                        {stats.done}/{stats.total} completate
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--ist-w10)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${stats.pct}%`,
                            background: cat.accent,
                            boxShadow: `0 0 8px ${cat.accent}50`,
                            minWidth: stats.pct > 0 ? 5 : 0,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-bold flex-shrink-0" style={{ color: cat.accent }}>
                        {stats.pct}%
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all group-hover:translate-x-0.5 group-hover:border-opacity-60"
                    style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-border)' }}
                  >
                    <ChevronRight size={14} strokeWidth={2.5} style={{ color: 'var(--ist-text-muted)' }} />
                  </div>
                </div>

                {/* Course previews */}
                <div
                  className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5"
                  style={{ borderTop: '1px solid var(--ist-border)' }}
                >
                  {cat.courses.map(course => {
                    const cs = getCourseStats(course)
                    const complete = cs.done === cs.total && cs.total > 0
                    return (
                      <div
                        key={course.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                        style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: complete ? 'rgba(70,211,154,0.15)' : `${cat.accent}15`,
                          }}
                        >
                          {complete
                            ? <CheckCircle2 size={10} strokeWidth={2.5} style={{ color: '#46D39A' }} />
                            : <Play size={9} strokeWidth={2.5} style={{ color: cat.accent }} />
                          }
                        </div>
                        <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--ist-text-muted)' }}>
                          {course.title}
                        </span>
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>
                          {cs.done}/{cs.total}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
