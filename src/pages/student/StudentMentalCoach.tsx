import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { CheckSquare, Square, ExternalLink } from 'lucide-react'

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
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Area Mental Coach" subtitle="Sofia Verdi — Mental Coach IST" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Sessione 1', sublabel: 'Valutazione iniziale', done: true, date: '15 Giu 2024' },
          { label: 'Sessione 2', sublabel: 'Follow-up e strategie', done: false, date: 'Da programmare' },
        ].map((s, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                style={s.done
                  ? { background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.24)' }
                  : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)' }
                }
              >
                📅
              </div>
              <div>
                <p className="font-semibold text-white">{s.label}</p>
                <p className="text-xs" style={{ color: '#8495A3' }}>{s.sublabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${s.done ? '' : 'animate-pulse'}`}
                style={{ background: s.done ? '#46D39A' : '#5A9AB1' }}
              />
              <span className="text-sm" style={{ color: s.done ? '#46D39A' : '#7CBBD0' }}>
                {s.done ? `Completata · ${s.date}` : s.date}
              </span>
            </div>
          </Card>
        ))}
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
