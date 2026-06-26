import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'

const STUDENTS = [
  { id: 1, name: 'Marco Rossi', phase: 'Build', progress: 65, status: 'active', lastActive: '1h fa', diary: 18 },
  { id: 2, name: 'Anna Pellegrini', phase: 'Build', progress: 48, status: 'active', lastActive: '3h fa', diary: 12 },
  { id: 3, name: 'Stefano Mancini', phase: 'Onboarding', progress: 30, status: 'active', lastActive: '5h fa', diary: 5 },
  { id: 4, name: 'Luca Ferrari', phase: 'Build', progress: 55, status: 'active', lastActive: '5 giorni fa', diary: 8 },
  { id: 5, name: 'Gianna Conti', phase: 'Test', progress: 80, status: 'active', lastActive: 'Ieri', diary: 3 },
  { id: 6, name: 'Roberto Greco', phase: 'Deploy', progress: 95, status: 'active', lastActive: '2h fa', diary: 47 },
  { id: 7, name: 'Marta Esposito', phase: 'Onboarding', progress: 10, status: 'blocked', lastActive: '2 settimane fa', diary: 1 },
  { id: 8, name: 'Paolo Gallo', phase: 'Build', progress: 70, status: 'expired', lastActive: '3 giorni fa', diary: 22 },
]

function StatusBadge({ status }: { status: string }) {
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
  const [search, setSearch] = useState('')
  const filtered = STUDENTS.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="I tuoi Studenti" subtitle={`${STUDENTS.length} studenti assegnati`} />

      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca studente..."
          className="w-full max-w-sm px-4 py-2.5 text-sm placeholder:text-[#56636F] focus:outline-none"
          style={{
            background: 'var(--ist-w7)',
            border: '1px solid var(--ist-w10)',
            borderRadius: 18,
            color: '#F7FAFC',
          }}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((student) => (
          <Card key={student.id} className="p-5 cursor-pointer">
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}
              >
                {student.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-white text-sm">{student.name}</p>
                  <StatusBadge status={student.status} />
                </div>
                <p className="text-xs" style={{ color: '#8495A3' }}>
                  Fase {student.phase} · {student.lastActive} · {student.diary} voci
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{student.progress}%</p>
                  <p className="text-xs" style={{ color: '#56636F' }}>completato</p>
                </div>
                <div className="w-20 h-2 rounded-full" style={{ background: 'var(--ist-w9)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${student.progress}%`,
                      background: 'linear-gradient(90deg, #7CBBD0 0%, #286680 100%)',
                    }}
                  />
                </div>
                <button className="text-xs text-ist-300 hover:text-ist-200 transition-colors">Dettagli →</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
