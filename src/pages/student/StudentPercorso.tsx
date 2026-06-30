import { CheckCircle2, Lock, Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { usePath, PhaseStatus } from '../../lib/path'

const PHASE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', build: 'Build', test: 'Test', deploy: 'Deploy',
}

export default function StudentPercorso() {
  const { user } = useAuth()
  const { phase, phases, loading } = usePath(user?.id ?? '')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Il tuo Percorso"
        subtitle={`Programma da 90 giorni — Fase attuale: ${PHASE_LABEL[phase] ?? phase}`}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {phases.map((p) => (
            <Card
              key={p.id}
              className={`p-6 ${p.status === 'locked' ? 'opacity-40' : ''}`}
              premium={p.status === 'active'}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                  style={
                    p.status === 'completed' ? { background: 'rgba(70,211,154,0.16)', border: '1px solid rgba(70,211,154,0.24)' } :
                    p.status === 'active' ? { background: 'rgba(90,154,177,0.18)', border: '1px solid rgba(124,187,208,0.30)' } :
                    { background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' }
                  }
                >
                  {p.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{p.label}</h3>
                  <PhaseStatusBadge status={p.status} />
                </div>
                {p.status !== 'locked' && (
                  <span className="text-sm" style={{ color: '#8495A3' }}>
                    {p.steps.filter(s => s.done).length}/{p.steps.length}
                  </span>
                )}
              </div>

              {p.status !== 'locked' && (
                <div className="space-y-2 pl-[52px]">
                  {p.steps.map((step) => (
                    <div key={step.key} className="flex items-center gap-3">
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

              {p.status === 'locked' && (
                <p className="text-sm flex items-center gap-2" style={{ color: '#56636F' }}>
                  <Lock size={14} strokeWidth={2} /> Completa la fase precedente per sbloccare
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function PhaseStatusBadge({ status }: { status: PhaseStatus }) {
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
