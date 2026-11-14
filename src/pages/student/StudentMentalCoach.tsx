import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { CheckSquare, Square, ExternalLink, MessageCircle, Loader2, Play, Info, RotateCcw, Radio, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudentSessions } from '../../lib/coaching'
import { useMentalMaterials, useMentalChecklist, MentalMaterialType } from '../../lib/mental'
import { useStudentCatalog, getCategoryStats } from '../../lib/content'
import { useCinemaMode } from '../../context/ThemeContext'
import {
  flattenLessons, continueWatching, pickResume, watchedFraction, remainingLabel,
  RESUME_CTA, RESUME_EYEBROW,
} from '../../lib/catalogView'
import Billboard, { HeroButton, HeroTag } from '../../components/media/Billboard'
import MediaRow from '../../components/media/MediaRow'
import SeriesCard from '../../components/media/SeriesCard'
import LessonCard from '../../components/media/LessonCard'
import { phaseIcon } from '../../components/media/phase'
import { useLiveEvents, liveDateLabel, liveDurationLabel } from '../../lib/live'
import ReplayCard from '../../components/media/ReplayCard'

const SESSION_SUBLABELS: Record<number, string> = {
  1: 'Valutazione iniziale',
  2: 'Follow-up e strategie',
}

const MATERIAL_ICON: Record<MentalMaterialType, string> = {
  pdf: '📄', audio: '🎧', video: '🎬', task: '✍️', link: '🔗',
}
const MATERIAL_LABEL: Record<MentalMaterialType, string> = {
  pdf: 'PDF', audio: 'Audio', video: 'Video', task: 'Task', link: 'Link',
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Area Mental Coach con la stessa grafica dei Videocorsi (pagina "cinema",
// sempre scura): banner con la lezione da riprendere, la serie come locandina,
// "Continua a guardare" e i replay delle live; sotto, sessioni, materiali e
// checklist. Senza lezioni pubblicate il banner mostra l'ultimo replay.
export default function StudentMentalCoach() {
  useCinemaMode()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { sessions } = useStudentSessions(userId)
  const { materials, loading: matLoading } = useMentalMaterials()
  const { items, doneIds, loading: chkLoading, toggle } = useMentalChecklist(userId)
  const { categories: mentalCats, loading: coursesLoading } = useStudentCatalog(userId, 'mental')
  const { events: allLives } = useLiveEvents()
  const mentalLives = allLives.filter(e => e.hostRole === 'mental_coach' && e.eventType !== 'reminder')
  const mentalNext = mentalLives.filter(e => e.status !== 'replay')
  const mentalReplays = mentalLives.filter(e => e.status === 'replay')

  const cats       = useMemo(() => mentalCats.filter(c => c.published), [mentalCats])
  const entries    = useMemo(() => flattenLessons(cats), [cats])
  const resume     = useMemo(() => pickResume(entries), [entries])
  const continuing = useMemo(() => continueWatching(entries), [entries])
  const currentIndex = cats.findIndex(c => getCategoryStats(c).pct < 100)
  const heroReplay = !resume ? mentalReplays.find(e => e.coverUrl) ?? mentalReplays[0] ?? null : null

  const openLesson   = (lessonId: string) => navigate(`/student/corsi/lezione/${lessonId}`)
  const openCategory = (categoryId: string, courseId?: string) =>
    navigate(`/student/corsi/${categoryId}${courseId ? `?corso=${courseId}` : ''}`)
  const openChat     = () => navigate('/student/chat', { state: { tab: 'direct' } })

  if (coursesLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
      </div>
    )
  }

  const pageTitle = <p className="text-lg lg:text-2xl font-extrabold tracking-tight text-white">Mental Coach</p>
  const writeButton = (
    <button
      onClick={openChat}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-80"
      style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.16)' }}
    >
      <MessageCircle size={15} strokeWidth={2.2} />
      Scrivi
    </button>
  )

  const hero = resume?.entry
  const sectionTitle = (title: string) => (
    <h2 className="text-[22px] lg:text-[28px] font-extrabold tracking-tight leading-tight mb-3 lg:mb-4" style={{ color: 'var(--ist-text)' }}>
      {title}
    </h2>
  )

  return (
    <div className="cinema-page pb-8">
      {hero && resume ? (
        <Billboard
          // Solo copertine nuove: lezione da riprendere, poi locandina della serie.
          imageUrl={hero.lesson.coverUrl ?? hero.category.posterUrl}
          imagePosition={!hero.lesson.coverUrl && hero.category.posterUrl ? '50% 20%' : undefined}
          accent={hero.category.accent}
          icon={phaseIcon(hero.category.phase)}
          topLeft={pageTitle}
          topRight={writeButton}
          eyebrow={<>
            <HeroTag tone="accent">{RESUME_EYEBROW[resume.mode]}</HeroTag>
            <HeroTag>{hero.category.title}</HeroTag>
          </>}
          title={hero.lesson.title}
          meta={<>
            <span className="truncate max-w-[60vw] lg:max-w-none">{hero.course.title}</span>
            <span aria-hidden>·</span>
            <span>Lezione {hero.number}</span>
            {hero.lesson.durationSeconds > 0 && <><span aria-hidden>·</span><span>{hero.lesson.duration}</span></>}
          </>}
          description={hero.lesson.description || hero.course.description}
          progress={watchedFraction(hero.lesson)}
          progressLabel={remainingLabel(hero.lesson) ?? undefined}
          actions={<>
            <HeroButton icon={resume.mode === 'rewatch' ? RotateCcw : Play} onClick={() => openLesson(hero.lesson.id)}>
              {RESUME_CTA[resume.mode]}
            </HeroButton>
            <HeroButton variant="secondary" icon={Info} onClick={() => openCategory(hero.category.id, hero.course.id)}>
              Dettagli
            </HeroButton>
          </>}
        />
      ) : heroReplay ? (
        <Billboard
          imageUrl={heroReplay.coverUrl}
          vimeoId={heroReplay.coverUrl ? null : heroReplay.replayVimeoId}
          accent={heroReplay.accent}
          accentEnd={heroReplay.accentEnd}
          icon={Radio}
          topLeft={pageTitle}
          topRight={writeButton}
          eyebrow={<HeroTag tone="accent">Ultimo replay</HeroTag>}
          title={heroReplay.title}
          meta={<>
            <span>{heroReplay.host}</span>
            {liveDateLabel(heroReplay) && <><span aria-hidden>·</span><span>{liveDateLabel(heroReplay)}</span></>}
            {liveDurationLabel(heroReplay) && <><span aria-hidden>·</span><span>{liveDurationLabel(heroReplay)}</span></>}
          </>}
          description={heroReplay.description || undefined}
          actions={<HeroButton icon={Play} onClick={() => navigate(`/student/live/${heroReplay.id}`)}>Guarda il replay</HeroButton>}
        />
      ) : (
        <div className="cinema-px pt-6 lg:pt-8 flex items-start justify-between gap-4">
          <PageHeader title="Area Mental Coach" subtitle="Materiali e checklist per il tuo percorso mentale" />
          <button
            onClick={openChat}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold flex-shrink-0 transition-all hover:-translate-y-0.5 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white', boxShadow: '0 4px 14px rgba(40,102,128,0.28)' }}
          >
            <MessageCircle size={15} strokeWidth={2} />
            Scrivi
          </button>
        </div>
      )}

      <div className="mt-2 lg:mt-0">
        {/* La serie del mental coach come locandina, come nei Videocorsi. */}
        {cats.length > 0 && (
          <MediaRow
            title="Il tuo percorso"
            itemClassName="w-[64vw] sm:w-[40vw] md:w-[30vw] lg:w-auto"
            variant="carousel"
            initialIndex={currentIndex > 0 ? currentIndex : undefined}
          >
            {cats.map((cat, index) => (
              <SeriesCard
                key={cat.id}
                category={cat}
                isCurrent={index === currentIndex}
                onOpen={() => openCategory(cat.id)}
                onPlay={openLesson}
              />
            ))}
          </MediaRow>
        )}
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

        {/* Live del mental coach: le prossime in elenco, i replay con le copertine. */}
        {mentalNext.length > 0 && (
          <section className="cinema-px mb-7 lg:mb-10">
            {sectionTitle('In programma')}
            <Card className="p-3 max-w-3xl">
            <div className="space-y-1">
              {mentalNext.map(ev => {
                const isLive = ev.status === 'live'
                return (
                  <button
                    key={ev.id}
                    onClick={() => navigate(`/student/live/${ev.id}`)}
                    className="w-full flex items-center gap-3 py-2.5 px-2 text-left rounded-xl transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${isLive ? 'animate-pulse' : ''}`}
                      style={{ background: isLive ? '#FF5A6E' : ev.status === 'upcoming' ? '#7CBBD0' : 'var(--ist-text-dim)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--ist-text)' }}>{ev.title}</p>
                      <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>
                        {isLive ? 'Ora in diretta' : liveDateLabel(ev)}
                        {liveDurationLabel(ev) && <> · {liveDurationLabel(ev)}</>}
                      </p>
                    </div>
                    <ChevronRight size={16} strokeWidth={2} style={{ color: 'var(--ist-text-dim)', flexShrink: 0 }} />
                  </button>
                )
              })}
            </div>
            </Card>
          </section>
        )}
        {mentalReplays.length > 0 && (
          <MediaRow title="Live e replay">
            {mentalReplays.map(ev => (
              <ReplayCard key={ev.id} event={ev} onClick={() => navigate(`/student/live/${ev.id}`)} />
            ))}
          </MediaRow>
        )}

        {/* Il resto dell'area: sessioni, materiali e checklist. */}
        <section className="cinema-px">
          {sectionTitle('Sessioni e materiali')}
          <div className="max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {[1, 2].map((num) => {
              const sess = sessions.find(s => s.session_number === num)
              const done = sess?.status === 'completed'
              const dateText = done && sess?.completed_at
                ? `Completata · ${formatSessionDate(sess.completed_at)}`
                : sess?.scheduled_at
                  ? `Programmata · ${formatSessionDate(sess.scheduled_at)}`
                  : 'Da programmare'
              return (
                <Card key={num} className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                      style={done
                        ? { background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.24)' }
                        : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)' }
                      }
                    >
                      📅
                    </div>
                    <div>
                      <p className="font-semibold text-white">Sessione {num}</p>
                      <p className="text-xs" style={{ color: '#8495A3' }}>{SESSION_SUBLABELS[num]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${done ? '' : 'animate-pulse'}`}
                      style={{ background: done ? '#46D39A' : '#5A9AB1' }}
                    />
                    <span className="text-sm" style={{ color: done ? '#46D39A' : '#7CBBD0' }}>
                      {dateText}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Materiali utili</h3>
            {matLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} /></div>
            ) : materials.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessun materiale disponibile al momento.</p>
            ) : (
              <div className="space-y-3">
                {materials.map((mat) => (
                  <div key={mat.id} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }}
                    >
                      {MATERIAL_ICON[mat.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--ist-text)' }}>{mat.title}</p>
                      <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>{MATERIAL_LABEL[mat.type]}</p>
                    </div>
                    {mat.url && (
                      <a
                        href={mat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium flex-shrink-0 transition-opacity hover:opacity-70"
                        style={{ color: 'var(--ist-accent-text)' }}
                      >
                        Apri <ExternalLink size={11} strokeWidth={2} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Checklist</h3>
            {chkLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} /></div>
            ) : items.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessuna attività in checklist al momento.</p>
            ) : (
              <div className="space-y-1">
                {items.map((item) => {
                  const done = doneIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id, !done)}
                      className="w-full flex items-center gap-3 py-2 text-left rounded-xl transition-colors hover:bg-white/[0.03]"
                    >
                      <span style={{ color: done ? '#46D39A' : 'var(--ist-text-muted)', flexShrink: 0 }}>
                        {done ? <CheckSquare size={18} strokeWidth={2} /> : <Square size={18} strokeWidth={2} />}
                      </span>
                      <span
                        className={`text-sm ${done ? 'line-through' : ''}`}
                        style={{ color: done ? 'var(--ist-text-dim)' : 'var(--ist-text)' }}
                      >
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}
