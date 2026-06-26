import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { CheckCircle2, Lock } from 'lucide-react'

const PHASES = [
  {
    id: 'onboarding',
    label: 'Fase 1 — Onboarding',
    icon: '🚀',
    status: 'completed',
    steps: [
      { label: 'Completa il profilo', done: true },
      { label: 'Video di benvenuto', done: true },
      { label: 'Prima sessione con il Coach', done: true },
      { label: 'Setup strumenti di trading', done: true },
    ],
  },
  {
    id: 'build',
    label: 'Fase 2 — Build',
    icon: '🔨',
    status: 'active',
    steps: [
      { label: 'Modulo 1: Fondamenta', done: true },
      { label: 'Modulo 2: Analisi Tecnica', done: true },
      { label: 'Modulo 3: Risk Management', done: false },
      { label: 'Modulo 4: Psicologia del Trading', done: false },
      { label: 'Sessione Mental Coach #1', done: false },
    ],
  },
  {
    id: 'test',
    label: 'Fase 3 — Test',
    icon: '🧪',
    status: 'locked',
    steps: [
      { label: '30 trade in demo documentati', done: false },
      { label: 'Review con il Coach', done: false },
      { label: 'Sessione Mental Coach #2', done: false },
      { label: 'Analisi performance', done: false },
    ],
  },
  {
    id: 'deploy',
    label: 'Fase 4 — Deploy',
    icon: '🎯',
    status: 'locked',
    steps: [
      { label: 'Prima settimana in live', done: false },
      { label: 'Report settimanale', done: false },
      { label: 'Sessione finale con Coach', done: false },
      { label: 'Certificazione IST', done: false },
    ],
  },
]

export default function StudentPercorso() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Il tuo Percorso"
        subtitle="Programma da 90 giorni — Fase attuale: Build"
      />

      <div className="space-y-4">
        {PHASES.map((phase) => (
          <Card
            key={phase.id}
            className={`p-6 ${phase.status === 'locked' ? 'opacity-40' : ''}`}
            premium={phase.status === 'active'}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                style={
                  phase.status === 'completed' ? { background: 'rgba(70,211,154,0.16)', border: '1px solid rgba(70,211,154,0.24)' } :
                  phase.status === 'active' ? { background: 'rgba(90,154,177,0.18)', border: '1px solid rgba(124,187,208,0.30)' } :
                  { background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }
                }
              >
                {phase.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{phase.label}</h3>
                <PhaseStatusBadge status={phase.status} />
              </div>
              {phase.status !== 'locked' && (
                <span className="text-sm" style={{ color: '#8495A3' }}>
                  {phase.steps.filter(s => s.done).length}/{phase.steps.length}
                </span>
              )}
            </div>

            {phase.status !== 'locked' && (
              <div className="space-y-2 pl-[52px]">
                {phase.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={step.done
                        ? { background: 'rgba(70,211,154,0.16)', color: '#46D39A' }
                        : { border: '1px solid var(--ist-w12)' }
                      }
                    >
                      {step.done && <CheckCircle2 size={12} strokeWidth={2} />}
                    </div>
                    <span
                      className={`text-sm ${step.done ? 'line-through' : ''}`}
                      style={{ color: step.done ? '#8495A3' : '#C7D3DD' }}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {phase.status === 'locked' && (
              <p className="text-sm flex items-center gap-2" style={{ color: '#56636F' }}>
                <Lock size={14} strokeWidth={2} /> Completa la fase precedente per sbloccare
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function PhaseStatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    completed: { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' },
    active: { color: '#7CBBD0', background: 'rgba(90,154,177,0.16)', border: '1px solid rgba(124,187,208,0.28)' },
    locked: { color: '#8495A3', background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' },
  }
  const labels: Record<string, string> = { completed: 'Completata', active: 'In corso', locked: 'Bloccata' }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={styles[status] ?? {}}>
      {labels[status] ?? status}
    </span>
  )
}
