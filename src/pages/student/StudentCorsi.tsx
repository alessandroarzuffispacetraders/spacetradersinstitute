import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { useStudentCatalog, getCategoryStats, getCourseStats, Category } from '../../lib/content'
import { useAuth } from '../../context/AuthContext'
import { isFreeUser, upsellSuppressed } from '../../lib/freeTier'
import { useContactAdmin } from '../../lib/upgradeContact'
import {
  BookOpen, ChevronRight, Play, CheckCircle2, Layers, Loader2,
  Compass, Target, Rocket, Check, Sparkles, ArrowRight,
} from 'lucide-react'

// Icona per fase (tema "percorso" Space Traders)
const PHASE_ICON: Record<string, typeof BookOpen> = {
  Onboarding: Compass, Build: Layers, Test: Target, Deploy: Rocket,
}

// Copertina PROCEDURALE generata dal colore accent della categoria (nessun upload).
// Layer di glow radiali + gradiente su base scura → look "copertina" senza immagini.
function coverBackground(accent: string): string {
  return [
    `radial-gradient(100% 140% at 12% 0%, ${accent}E6 0%, ${accent}80 34%, ${accent}26 66%, transparent 100%)`,
    `radial-gradient(90% 130% at 100% 100%, ${accent}59 0%, transparent 62%)`,
    `linear-gradient(120deg, ${accent}33 0%, ${accent}0D 100%)`,
  ].join(', ')
}

export default function StudentCorsi() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { contactAdmin, ready: contactReady } = useContactAdmin()
  const { categories, loading } = useStudentCatalog(user?.id ?? '')

  const allLessons   = categories.flatMap(c => c.courses.flatMap(cr => cr.lessons))
  const totalDone    = allLessons.filter(l => l.done).length
  const totalLessons = allLessons.length
  const totalPct     = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0
  const totalCourses = categories.reduce((s, c) => s + c.courses.length, 0)

  // Tappa "attuale" del percorso = prima categoria non ancora completata.
  const currentIndex = (() => {
    for (let i = 0; i < categories.length; i++) {
      if (getCategoryStats(categories[i]).pct < 100) return i
    }
    return categories.length // tutte completate
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
      </div>
    )
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
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

      {/* ── Upsell per l'utente gratuito: vede solo i corsi in vetrina ──
          Nascosto su iOS: nessun invito all'acquisto esterno (Guideline 3.1.1). */}
      {isFreeUser(user) && !upsellSuppressed() && (
        <div
          className="rounded-3xl p-5 mb-7 flex items-center gap-4"
          style={{
            background: 'var(--ist-card-bg-premium)',
            border: '1px solid var(--ist-card-border-premium)',
            boxShadow: 'var(--ist-card-shadow-premium)',
          }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' }}
          >
            <Sparkles size={20} strokeWidth={2} style={{ color: '#7CBBD0' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>Anteprima gratuita</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
              Stai vedendo solo i corsi in vetrina. Sblocca l'intero catalogo con il percorso completo.
            </p>
          </div>
          <button
            onClick={contactAdmin}
            disabled={!contactReady}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold whitespace-nowrap transition-all hover:-translate-y-0.5 flex-shrink-0 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)' }}
          >
            Sblocca tutto
            <ArrowRight size={13} strokeWidth={2.6} />
          </button>
        </div>
      )}

      {/* ── Roadmap del percorso ── */}
      {categories.length === 0 ? (
        <div
          className="rounded-3xl p-10 text-center"
          style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessun videocorso disponibile al momento.
          </p>
        </div>
      ) : (
        <div className="relative">
          {categories.map((cat: Category, i) => {
            const stats      = getCategoryStats(cat)
            const PhaseIcon  = PHASE_ICON[cat.phase] ?? BookOpen
            const done       = stats.pct === 100
            const isCurrent  = i === currentIndex
            const isLast     = i === categories.length - 1
            const nextAccent = !isLast ? categories[i + 1].accent : cat.accent

            const statusLabel = done ? 'Completato' : isCurrent ? 'Sei qui' : stats.pct > 0 ? 'In corso' : 'Da fare'
            const ctaLabel    = done ? 'Rivedi' : stats.pct > 0 ? 'Continua' : 'Inizia'

            return (
              <div key={cat.id} className="relative flex gap-3 lg:gap-5 pb-6 lg:pb-8 last:pb-0">
                {/* ── Spina + nodo ── */}
                <div className="relative flex-shrink-0 w-10 lg:w-11 flex justify-center">
                  {/* Connettore verticale: barra che si riempie in base al
                      completamento della tappa, fino alla sezione successiva. */}
                  {!isLast && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-10 lg:top-11 -bottom-6 lg:-bottom-8 w-[2px] rounded-full overflow-hidden"
                      style={{ background: 'var(--ist-w10)' }}
                    >
                      <div
                        className="absolute top-0 left-0 w-full rounded-full"
                        style={{
                          height: `${stats.pct}%`,
                          background: `linear-gradient(to bottom, ${cat.accent}, ${nextAccent})`,
                          transition: 'height .6s ease',
                        }}
                      />
                    </div>
                  )}
                  {/* Nodo */}
                  <div className="relative z-10">
                    <div
                      className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-full flex items-center justify-center"
                      style={done
                        ? { background: cat.accent, boxShadow: `0 4px 14px ${cat.accent}55` }
                        : isCurrent
                          ? { background: 'var(--ist-card-bg)', border: `2px solid ${cat.accent}`, color: cat.accent, boxShadow: `0 0 0 4px ${cat.accent}18` }
                          : { background: 'var(--ist-w6)', border: '1px solid var(--ist-border)', color: 'var(--ist-text-dim)' }
                      }
                    >
                      {done
                        ? <Check size={17} strokeWidth={3} className="text-white" />
                        : <PhaseIcon size={17} strokeWidth={2} />
                      }
                    </div>
                  </div>
                </div>

                {/* ── Card categoria (copertina + corpo) ── */}
                <button
                  onClick={() => navigate(`/student/corsi/${cat.id}`)}
                  className="flex-1 min-w-0 text-left rounded-3xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 group"
                  style={{
                    background: 'var(--ist-card-bg)',
                    border: '1px solid var(--ist-border)',
                    boxShadow: 'var(--ist-card-shadow)',
                  }}
                >
                  {/* Copertina: reale (upload admin) o procedurale */}
                  <div
                    className="relative h-24 lg:h-28 overflow-hidden"
                    data-inverted="true"
                    style={{ backgroundColor: '#0b0f18', backgroundImage: coverBackground(cat.accent) }}
                  >
                    {/* Copertina reale caricata dall'admin */}
                    {cat.coverUrl && (
                      <img
                        src={cat.coverUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {/* Watermark icona fase — solo con copertina procedurale */}
                    {!cat.coverUrl && (
                      <PhaseIcon
                        size={128}
                        strokeWidth={1.25}
                        className="absolute -right-5 -bottom-7 pointer-events-none"
                        style={{ color: '#fff', opacity: 0.14 }}
                      />
                    )}
                    {/* Scrim per leggibilità del titolo */}
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(4,6,12,0.72) 0%, rgba(4,6,12,0.15) 45%, transparent 70%)' }}
                    />
                    {/* Badge fase + stato */}
                    <div className="absolute top-3 left-4 flex items-center gap-1.5">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.20)', backdropFilter: 'blur(6px)' }}
                      >
                        {cat.phase}
                      </span>
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={done
                          ? { background: 'rgba(70,211,154,0.22)', color: '#8CF0C4', border: '1px solid rgba(70,211,154,0.35)' }
                          : isCurrent
                            ? { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }
                            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }
                        }
                      >
                        {statusLabel}
                      </span>
                    </div>
                    {/* Titolo sulla copertina */}
                    <h3
                      className="absolute bottom-2.5 left-4 right-4 text-lg lg:text-xl font-bold text-white leading-tight"
                      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}
                    >
                      {cat.title}
                    </h3>
                  </div>

                  {/* Corpo */}
                  <div className="p-4 lg:p-5">
                    <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ist-text-muted)' }}>
                      {cat.description}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-1.5 mb-2 text-[11px] flex-wrap" style={{ color: 'var(--ist-text-dim)' }}>
                      <span>{cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'}</span>
                      <span>·</span>
                      <span>{stats.total} lezioni</span>
                      <span className="mx-0.5" style={{ color: 'var(--ist-border)' }}>·</span>
                      <span className="font-semibold" style={{ color: cat.accent }}>{stats.done}/{stats.total} completate</span>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3 mb-4">
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

                    {/* Anteprima corsi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
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
                              style={{ background: complete ? 'rgba(70,211,154,0.15)' : `${cat.accent}15` }}
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

                    {/* CTA */}
                    <div className="flex items-center justify-end gap-0.5 mt-3 text-[11px] font-semibold transition-transform group-hover:translate-x-0.5" style={{ color: cat.accent }}>
                      {ctaLabel}
                      <ChevronRight size={13} strokeWidth={2.5} />
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
