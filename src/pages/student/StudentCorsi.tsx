import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Play, Info, RotateCcw, Sparkles, ArrowRight } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { useStudentCatalog, getCategoryStats, Category } from '../../lib/content'
import { useAuth } from '../../context/AuthContext'
import { useCinemaMode } from '../../context/ThemeContext'
import { isFreeUser, upsellSuppressed } from '../../lib/freeTier'
import { useContactAdmin } from '../../lib/upgradeContact'
import {
  flattenLessons, continueWatching, pickResume, watchedFraction, remainingLabel,
  RESUME_CTA, RESUME_EYEBROW,
} from '../../lib/catalogView'
import Billboard, { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaRow from '../../components/media/MediaRow'
import SeriesCard from '../../components/media/SeriesCard'
import LessonCard from '../../components/media/LessonCard'
import { phaseIcon } from '../../components/media/phase'

const PHASES = ['Onboarding', 'Build', 'Test', 'Deploy']
// Fino a questo numero di serie: una sola riga; oltre, una riga per fase.
const SINGLE_ROW_MAX = 8

// Videocorsi in stile catalogo streaming:
//  1. banner con la lezione da riprendere (o da iniziare)
//  2. "Continua a guardare" (lezioni lasciate a metà, dalla più recente)
//  3. le categorie come "serie" (i corsi sono i capitoli, le lezioni le
//     puntate), in righe per fase e nell'ordine del catalogo. Passando col
//     mouse (o toccando, da telefono) la card si apre con copertina e dettagli.
export default function StudentCorsi() {
  useCinemaMode()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { contactAdmin, ready: contactReady } = useContactAdmin()
  const { categories, loading } = useStudentCatalog(user?.id ?? '', 'trading')

  const entries    = useMemo(() => flattenLessons(categories), [categories])
  const resume     = useMemo(() => pickResume(entries), [entries])
  const continuing = useMemo(() => continueWatching(entries), [entries])

  const totalLessons = entries.length
  const totalDone    = entries.filter(e => e.lesson.done).length
  const totalPct     = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0

  // Tappa "attuale" del percorso = prima categoria non ancora completata.
  const currentIndex = categories.findIndex(c => getCategoryStats(c).pct < 100)

  // Serie in un'unica riga, nell'ordine del catalogo. Solo se sono tante si
  // dividono per fase (categorie consecutive della stessa fase = stessa riga).
  const seriesRows = useMemo(() => {
    const all = categories.map((cat, index) => ({ cat, index }))
    if (categories.length <= SINGLE_ROW_MAX) return [{ phase: '', items: all }]
    const rows: { phase: string; items: { cat: Category; index: number }[] }[] = []
    categories.forEach((cat, index) => {
      const last = rows[rows.length - 1]
      if (last && last.phase === cat.phase) last.items.push({ cat, index })
      else rows.push({ phase: cat.phase, items: [{ cat, index }] })
    })
    return rows
  }, [categories])

  const openLesson   = (lessonId: string) => navigate(`/student/corsi/lezione/${lessonId}`)
  const openCategory = (categoryId: string, courseId?: string) =>
    navigate(`/student/corsi/${categoryId}${courseId ? `?corso=${courseId}` : ''}`)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
      </div>
    )
  }

  const upsell = isFreeUser(user) && !upsellSuppressed() && (
    <div className="cinema-px mb-7">
      <div
        className="max-w-3xl rounded-2xl p-4 flex items-center gap-3.5"
        style={{ background: 'var(--ist-card-bg-premium)', border: '1px solid var(--ist-card-border-premium)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' }}
        >
          <Sparkles size={18} strokeWidth={2} style={{ color: '#7CBBD0' }} />
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
    </div>
  )

  // Nessuna lezione pubblicata: niente banner, solo un messaggio.
  if (!resume) {
    return (
      <div className="cinema-page pb-6">
        <div className="cinema-px pt-6 lg:pt-8">
          <PageHeader title="Videocorsi" subtitle="Il catalogo delle lezioni" />
        </div>
        {upsell}
        <div className="cinema-px">
          <div
            className="max-w-3xl rounded-3xl p-10 text-center"
            style={{ background: 'var(--ist-card-bg)', border: '1px solid var(--ist-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
              Nessun videocorso disponibile al momento.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { entry: hero, mode } = resume
  const heroLesson = hero.lesson

  return (
    <div className="cinema-page pb-8">
      <Billboard
        imageUrl={heroLesson.coverUrl}
        vimeoId={heroLesson.vimeoId}
        fallbackUrl={hero.category.coverUrl}
        accent={hero.category.accent}
        icon={phaseIcon(hero.category.phase)}
        topLeft={<p className="text-lg lg:text-2xl font-extrabold tracking-tight text-white">Videocorsi</p>}
        topRight={
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            {totalDone}/{totalLessons} lezioni · {totalPct}%
          </span>
        }
        eyebrow={<>
          <HeroTag tone="accent">{RESUME_EYEBROW[mode]}</HeroTag>
          <HeroTag>{hero.category.phase}</HeroTag>
        </>}
        title={heroLesson.title}
        meta={<>
          <span className="truncate max-w-[60vw] lg:max-w-none">{hero.course.title}</span>
          <span aria-hidden>·</span>
          <span>Lezione {hero.number}</span>
          {heroLesson.durationSeconds > 0 && <><span aria-hidden>·</span><span>{heroLesson.duration}</span></>}
        </>}
        description={heroLesson.description || hero.course.description}
        progress={watchedFraction(heroLesson)}
        progressLabel={remainingLabel(heroLesson) ?? undefined}
        actions={<>
          <HeroButton icon={mode === 'rewatch' ? RotateCcw : Play} onClick={() => openLesson(heroLesson.id)}>
            {RESUME_CTA[mode]}
          </HeroButton>
          <HeroButton variant="secondary" icon={Info} onClick={() => openCategory(hero.category.id, hero.course.id)}>
            Dettagli
          </HeroButton>
        </>}
      />

      <div className="mt-2 lg:mt-0">
        {upsell}

        {/* Le serie (categorie) come locandine, nell'ordine del catalogo: prima
            cosa dopo il banner. Su telefono un carosello con le vicine in penombra. */}
        {seriesRows.map((row, r) => (
          <MediaRow
            key={`${row.phase}-${r}`}
            eyebrow={seriesRows.length > 1 ? `Fase ${PHASES.indexOf(row.phase) + 1 || r + 1}` : undefined}
            title={seriesRows.length > 1 ? row.phase : 'Il tuo percorso'}
            itemClassName="w-[64vw] sm:w-[40vw] md:w-[30vw] lg:w-[220px] xl:w-[240px]"
            variant="carousel"
            initialIndex={r === 0 && currentIndex > 0 && currentIndex < row.items.length ? currentIndex : undefined}
          >
            {row.items.map(({ cat, index }) => (
              <SeriesCard
                key={cat.id}
                category={cat}
                isCurrent={index === currentIndex}
                onOpen={() => openCategory(cat.id)}
                onPlay={openLesson}
              />
            ))}
          </MediaRow>
        ))}
        {continuing.length > 0 && (
          <MediaRow title="Continua a guardare">
            {continuing.map(e => (
              <LessonCard
                key={e.lesson.id}
                entry={e}
                onClick={() => openLesson(e.lesson.id)}
                subtitle={[remainingLabel(e.lesson), e.course.title].filter(Boolean).join(' · ')}
              />
            ))}
          </MediaRow>
        )}

      </div>
    </div>
  )
}
