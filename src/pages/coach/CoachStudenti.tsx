import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents } from '../../lib/coaching'

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

export default function CoachStudenti() {
  const { user } = useAuth()
  const { students, loading } = useAssignedStudents('coach', user?.id ?? '')
  const [search, setSearch] = useState('')
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
          style={{ background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 18, color: '#F7FAFC' }}
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
          {filtered.map((student) => (
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
                    {student.phase ? `Fase ${student.phase.charAt(0).toUpperCase()}${student.phase.slice(1)}` : 'Fase —'} · {student.diaryCount} voci diario
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-6 text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessuno studente trovato.</p>
          )}
        </div>
      )}
    </div>
  )
}
