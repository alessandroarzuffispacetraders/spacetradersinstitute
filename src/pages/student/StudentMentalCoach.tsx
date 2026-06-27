import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { CheckSquare, Square, ExternalLink, MessageCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudentSessions } from '../../lib/coaching'

const SESSION_SUBLABELS: Record<number, string> = {
  1: 'Valutazione iniziale',
  2: 'Follow-up e strategie',
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MATERIALS = [
  { title: 'Mindset del Trader — Guida PDF', type: 'PDF', icon: '📄', done: true },
  { title: 'Meditazione pre-sessione (audio)', type: 'Audio', icon: '🎧', done: false },
  { title: 'Esercizio: Journaling emozionale', type: 'Task', icon: '✍️', done: false },
  { title: 'Video: Gestire le perdite', type: 'Video', icon: '🎬', done: true },
]

const TASKS = [
  { label: 'Compila il questionario di auto-valutazione', done: true },
  { label: 'Leggi la guida al mindset (Settimana 1)', done: true },
  { label: 'Completa 3 sessioni di journaling emozionale', done: false },
  { label: 'Pratica la meditazione pre-trading per 7 giorni', done: false },
]

export default function StudentMentalCoach() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { sessions } = useStudentSessions(user?.id ?? '')
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader title="Area Mental Coach" subtitle="Sofia Verdi — Mental Coach IST" />
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
        <h3 className="text-sm font-semibold text-white mb-4">Materiali assegnati</h3>
        <div className="space-y-3">
          {MATERIALS.map((mat, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                style={mat.done
                  ? { background: 'rgba(70,211,154,0.14)', color: '#46D39A' }
                  : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }
                }
              >
                {mat.done ? '✓' : mat.icon}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm ${mat.done ? 'line-through' : ''}`}
                  style={{ color: mat.done ? '#8495A3' : '#C7D3DD' }}
                >
                  {mat.title}
                </p>
                <p className="text-xs" style={{ color: '#56636F' }}>{mat.type}</p>
              </div>
              {!mat.done && (
                <button className="flex items-center gap-1 text-xs text-ist-300 hover:text-ist-200 transition-colors">
                  Apri <ExternalLink size={11} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Task assegnati</h3>
        <div className="space-y-3">
          {TASKS.map((task, i) => (
            <div key={i} className="flex items-center gap-3">
              <div style={{ color: task.done ? '#46D39A' : '#8495A3', flexShrink: 0 }}>
                {task.done
                  ? <CheckSquare size={18} strokeWidth={2} />
                  : <Square size={18} strokeWidth={2} />
                }
              </div>
              <span
                className={`text-sm ${task.done ? 'line-through' : ''}`}
                style={{ color: task.done ? '#8495A3' : '#C7D3DD' }}
              >
                {task.label}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
