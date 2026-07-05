import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { CheckSquare, Square, ExternalLink, MessageCircle, Loader2, Play, CheckCircle2, Radio, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudentSessions } from '../../lib/coaching'
import { useMentalMaterials, useMentalChecklist, MentalMaterialType } from '../../lib/mental'
import { useStudentCatalog, getCourseStats } from '../../lib/content'
import { useLiveEvents, liveDateLabel, liveDurationLabel } from '../../lib/live'

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

export default function StudentMentalCoach() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { sessions } = useStudentSessions(userId)
  const { materials, loading: matLoading } = useMentalMaterials()
  const { items, doneIds, loading: chkLoading, toggle } = useMentalChecklist(userId)
  // Videocorsi mental (in cima) e live del mental coach (in fondo).
  const { categories: mentalCats, loading: coursesLoading } = useStudentCatalog(userId, 'mental')
  const { events: allLives } = useLiveEvents()
  const mentalLives = allLives.filter(e => e.hostRole === 'mental_coach')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader title="Area Mental Coach" subtitle="Materiali e checklist per il tuo percorso mentale" />
        <button
          onClick={() => navigate('/student/chat', { state: { tab: 'direct' } })}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold flex-shrink-0 transition-all hover:-translate-y-0.5 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #5A9AB1, #286680)',
            color: 'white',
            boxShadow: '0 4px 14px rgba(40,102,128,0.28)',
          }}
        >
          <MessageCircle size={15} strokeWidth={2} />
          Scrivi
        </button>
      </div>

      {/* ── Videocorsi del mental coach (in cima) ── */}
      {!coursesLoading && mentalCats.some(c => c.published) && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Play size={15} strokeWidth={2.2} style={{ color: '#7CBBD0' }} /> Videocorsi
          </h2>
          <div className="space-y-4">
            {mentalCats.filter(c => c.published).map(cat => (
              <Card key={cat.id} className="p-5">
                <p className="font-semibold text-white">{cat.title}</p>
                {cat.description && (
                  <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--ist-text-dim)' }}>{cat.description}</p>
                )}
                <div className="space-y-4">
                  {cat.courses.filter(cr => cr.published).map(course => {
                    const cs = getCourseStats(course)
                    return (
                      <div key={course.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-medium" style={{ color: 'var(--ist-text)' }}>{course.title}</p>
                          {cs.total > 0 && (
                            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>{cs.done}/{cs.total}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {course.lessons.map(lesson => (
                            <button
                              key={lesson.id}
                              onClick={() => navigate(`/student/corsi/lezione/${lesson.id}`)}
                              className="w-full flex items-center gap-3 py-2 px-2 text-left rounded-xl transition-colors hover:bg-white/[0.03]"
                            >
                              <span style={{ color: lesson.done ? '#46D39A' : 'var(--ist-text-muted)', flexShrink: 0 }}>
                                {lesson.done ? <CheckCircle2 size={17} strokeWidth={2} /> : <Play size={17} strokeWidth={2} />}
                              </span>
                              <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--ist-text)' }}>{lesson.title}</span>
                              {lesson.duration && (
                                <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>{lesson.duration}</span>
                              )}
                            </button>
                          ))}
                          {course.lessons.length === 0 && (
                            <p className="text-xs px-2 py-1" style={{ color: 'var(--ist-text-dim)' }}>Nessuna lezione.</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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

      <Card className="p-5 mb-6">
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

      {/* ── Live del mental coach (in fondo) ── */}
      {mentalLives.length > 0 && (
        <Card className="p-5 mt-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Radio size={15} strokeWidth={2.2} style={{ color: '#7CBBD0' }} /> Live e replay
          </h3>
          <div className="space-y-2">
            {mentalLives.map(ev => {
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
      )}
    </div>
  )
}
