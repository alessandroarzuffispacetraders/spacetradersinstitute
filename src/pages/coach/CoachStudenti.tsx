import { useState } from 'react'
import { Loader2, ChevronDown, CheckCircle2, Circle, Route } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents, AssignedStudent } from '../../lib/coaching'
import { useJourney } from '../../lib/journey'

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const styles: Record<string, React.CSSProperties> = {
    active: { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' },
    expired: { color: '#F6C85F', background: 'rgba(246,200,95,0.14)', border: '1px solid rgba(246,200,95,0.22)' },
    blocked: { color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.22)' },
  }
  const labels: Record<string, string> = { active: 'Attivo', expired: 'Scaduto', blocked: 'Bloccato' }
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={styles[status] ?? {}}>
      {labels[status] ?? status}
    </span>
  )
}

// Percorso dello studente in sola lettura: si costruisce da solo dai video
// visti, dalle sessioni col Mental Coach e dalle attività che spunta lui.
function PathView({ student }: { student: AssignedStudent }) {
  const { journey, loading } = useJourney(student.id, { hasPhoto: !!(student.avatar_url || student.avatar_preset), hasMentalCoach: true })
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} />
      </div>
    )
  }
  const cur = journey.phases.find(p => p.id === journey.phase)
  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--ist-border)' }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--ist-text)' }}>{journey.progress}%</span>
        <span className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
          {journey.next ? <>Fase <b style={{ color: 'var(--ist-accent-text)' }}>{cur?.label}</b> · prossimo passo: {journey.next.title}</> : 'Percorso completato'}
        </span>
      </div>
      <div className="space-y-3">
        {journey.phases.map(p => (
          <div key={p.id}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>{p.label} · {p.done}/{p.total}</p>
            <div className="space-y-0.5">
              {p.steps.map(s => (
                <div key={s.key} className="flex items-center gap-2 px-1.5 py-1">
                  {s.done
                    ? <CheckCircle2 size={15} strokeWidth={2} style={{ color: '#46D39A', flexShrink: 0 }} />
                    : <Circle size={15} strokeWidth={2} style={{ color: s.key === journey.next?.key ? 'var(--ist-accent-text)' : 'var(--ist-text-dim)', flexShrink: 0 }} />}
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: s.done ? 'var(--ist-text-dim)' : 'var(--ist-text)' }}>{s.title}</span>
                  {s.kind === 'videos' && s.total ? <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>{s.doneCount}/{s.total}</span> : null}
                </div>
              ))}
              {p.steps.length === 0 && <p className="text-xs px-1.5" style={{ color: 'var(--ist-text-dim)' }}>Contenuti in arrivo.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CoachStudenti() {
  const { user } = useAuth()
  const { students, loading } = useAssignedStudents('coach', user?.id ?? '')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="I tuoi Studenti" subtitle={loading ? 'Caricamento...' : `${students.length} studenti assegnati`} />

      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca studente..."
          className="w-full max-w-sm px-4 py-2.5 text-sm placeholder:text-[#56636F] focus:outline-none"
          style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 18, color: 'var(--ist-text)' }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : students.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Nessuno studente assegnato. Le assegnazioni si gestiscono dall'area Admin → Utenti.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((student) => {
            const expanded = expandedId === student.id
            return (
              <Card key={student.id} className="p-5">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}
                  >
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-white text-sm truncate">{student.name}</p>
                      <StatusBadge status={student.status} />
                    </div>
                    <p className="text-xs" style={{ color: '#8495A3' }}>
                      {student.diaryCount} voci diario
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(expanded ? null : student.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-colors"
                    style={{ background: 'var(--ist-w7)', color: 'var(--ist-text-muted)' }}
                  >
                    <Route size={13} strokeWidth={2} />
                    <span className="hidden sm:inline">Percorso</span>
                    <ChevronDown size={13} strokeWidth={2.5} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                </div>

                {expanded && <PathView student={student} />}
              </Card>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center py-6 text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessuno studente trovato.</p>
          )}
        </div>
      )}
    </div>
  )
}
