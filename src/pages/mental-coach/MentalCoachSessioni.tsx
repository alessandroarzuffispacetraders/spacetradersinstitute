import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'

const SESSIONS = [
  { student: 'Marco Rossi', type: 'Sessione 1', status: 'completed', date: '15 Giu 2024' },
  { student: 'Stefano Mancini', type: 'Sessione 1', status: 'completed', date: '18 Giu 2024' },
  { student: 'Marco Rossi', type: 'Sessione 2', status: 'scheduled', date: 'Lun 1 Lug · 15:00' },
  { student: 'Anna Pellegrini', type: 'Sessione 1', status: 'scheduled', date: 'Mer 3 Lug · 10:00' },
  { student: 'Luca Ferrari', type: 'Sessione 2', status: 'pending', date: '—' },
]

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    completed: { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' },
    scheduled: { color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' },
    pending: { color: '#8495A3', background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' },
  }
  const labels: Record<string, string> = { completed: 'Completata', scheduled: 'Programmata', pending: 'In attesa' }
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0" style={styles[status] ?? {}}>
      {labels[status] ?? status}
    </span>
  )
}

export default function MentalCoachSessioni() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Gestione Sessioni" subtitle="Panoramica di tutte le sessioni" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Completate', count: SESSIONS.filter(s => s.status === 'completed').length, color: '#46D39A' },
          { label: 'Programmate', count: SESSIONS.filter(s => s.status === 'scheduled').length, color: '#7CBBD0' },
          { label: 'In attesa', count: SESSIONS.filter(s => s.status === 'pending').length, color: '#8495A3' },
        ].map((stat, i) => (
          <Card key={i} className="p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.count}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8495A3' }}>{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        {SESSIONS.map((session, i) => (
          <Card key={i} className="p-5 flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full flex-shrink-0 ${session.status === 'scheduled' ? 'animate-pulse' : ''}`}
              style={{
                background: session.status === 'completed' ? '#46D39A' :
                  session.status === 'scheduled' ? '#5A9AB1' : 'var(--ist-w20)',
              }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white text-sm">{session.student}</p>
                <span style={{ color: '#56636F' }}>·</span>
                <p className="text-sm" style={{ color: '#8495A3' }}>{session.type}</p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#56636F' }}>{session.date}</p>
            </div>
            <StatusBadge status={session.status} />
          </Card>
        ))}
      </div>
    </div>
  )
}
