import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Play, Info, RotateCcw, Sparkles, ArrowRight } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { useStudentCatalog, getCategoryStats, Category } from '../../lib/content'
import { useAuth } from '../../context/AuthContext'
import { isFreeUser, upsellSuppressed } from '../../lib/freeTier'
import { useContactAdmin } from '../../lib/upgradeContact'
import {
  flattenLessons, continueWatching, pickResume, watchedFraction, remainingLabel,
  RESUME_CTA, RESUME_EYEBROW,
} from '../../lib/catalogView'
import Billboard, { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaRow from '../../components/media/MediaRow'
import MediaThumb from '../../components/media/MediaThumb'
import LessonCard from '../../components/media/LessonCard'
import { phaseIcon } from '../../components/media/phase'

// Videocorsi in stile catalogo streaming:
//  1. banner con la lezione da riprendere (o da iniziare)
//  2. "Continua a guardare" (lezioni lasciate a metà, dalla più recente)
//  3. "Il tuo percorso" (le categorie/tappe, con stato e avanzamento)
//  4. una riga per ogni corso, con le lezioni come episodi
export default function StudentCorsi() {
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
    <div className="px-4 lg:px-10 mb-7">
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
      <div className="pb-6">
        <div className="p-5 lg:p-8 max-w-4xl mx-auto">
          <PageHeader title="Videocorsi" subtitle="Il catalogo delle lezioni" />
        </div>
        {upsell}
        <div className="px-4 lg:px-10">
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
    <div className="pb-8">
      <Billboard
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

        {categories.length > 0 && (
          <MediaRow
            title="Il tuo percorso"
            itemClassName="w-[80vw] sm:w-[52vw] md:w-[40vw] lg:w-[340px] xl:w-[380px]"
          >
            {categories.map((cat, i) => (
              <PathCard
                key={cat.id}
                category={cat}
                step={i + 1}
                isCurrent={i === currentIndex}
                onClick={() => openCategory(cat.id)}
              />
            ))}
          </MediaRow>
        )}

        {categories.map(cat => cat.courses
          .filter(course => course.lessons.length > 0)
          .map(course => (
            <MediaRow
              key={course.id}
              eyebrow={course.title === cat.title ? cat.phase : `${cat.phase} · ${cat.title}`}
              title={course.title}
              actionLabel="Vedi tutto"
              onAction={() => openCategory(cat.id, course.id)}
            >
              {course.lessons.map((lesson, i) => (
                <LessonCard
                  key={lesson.id}
                  entry={{ lesson, course, category: cat, number: i + 1 }}
                  onClick={() => openLesson(lesson.id)}
                />
              ))}
            </MediaRow>
          )))}
      </div>
    </div>
  )
}

// Card "tappa del percorso": copertina della categoria con titolo sovrapposto,
// stato (Completato / Sei qui / In corso) e barra di avanzamento.
function PathCard({
  category: cat, step, isCurrent, onClick,
}: {
  category: Category
  step: number
  isCurrent: boolean
  onClick: () => void
}) {
  const stats  = getCategoryStats(cat)
  const done   = stats.pct === 100
  const status = done ? 'Completato' : isCurrent ? 'Sei qui' : stats.pct > 0 ? 'In corso' : null

  return (
    <button onClick={onClick} className="media-card group w-full text-left">
      <MediaThumb
        imageUrl={cat.coverUrl}
        accent={cat.accent}
        icon={phaseIcon(cat.phase)}
        progress={stats.pct > 0 && !done ? stats.pct / 100 : 0}
        showPlay={false}
        className={isCurrent ? 'media-thumb-current' : ''}
        topLeft={<>
          <HeroTag>{cat.phase}</HeroTag>
          {status && (
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md"
              style={done
                ? { background: '#46D39A', color: '#05170f' }
                : isCurrent
                  ? { background: 'var(--ist-media-accent)', color: '#05070d' }
                  : { background: 'rgba(0,0,0,0.55)', color: '#fff' }
              }
            >
              {status}
            </span>
          )}
        </>}
      >
        <div
          className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5 pt-10 lg:px-4 lg:pb-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Tappa {step}
          </p>
          <h3 className="text-lg lg:text-xl font-extrabold leading-tight text-white line-clamp-2">
            {cat.title}
          </h3>
        </div>
      </MediaThumb>
      <div className="mt-2 px-0.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate" style={{ color: 'var(--ist-text-dim)' }}>
          {cat.courses.length} {cat.courses.length === 1 ? 'corso' : 'corsi'} · {stats.total} lezioni
        </span>
        <span className="font-semibold flex-shrink-0" style={{ color: done ? '#46D39A' : 'var(--ist-text-muted)' }}>
          {stats.done}/{stats.total}
        </span>
      </div>
    </button>
  )
}
