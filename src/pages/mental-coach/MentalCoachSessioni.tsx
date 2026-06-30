import { Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { useAssignedStudents, useMentalSessions, SessionStatus, MentalSession } from '../../lib/coaching'

const STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'In attesa', scheduled: 'Programmata', completed: 'Completata', cancelled: 'Annullata',
}
const STATUS_STYLE: Record<SessionStatus, React.CSSProperties> = {
  completed: { color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' },
  scheduled: { color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' },
  pending:   { color: '#8495A3', background: 'var(--ist-w6)', border: '1px solid var(--ist-w8)' },
  cancelled: { color: '#FF6B7A', background: 'rgba(255,107,122,0.10)', border: '1px solid rgba(255,107,122,0.18)' },
}

const selectStyle: React.CSSProperties = {
  background: 'var(--ist-w7)', border: '1px solid var(--ist-w10)', borderRadius: 12, color: 'var(--ist-text)', outline: 'none', padding: '6px 10px', fontSize: 12,
}

// 'YYYY-MM-DDTHH:mm' per <input datetime-local> dal valore ISO
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MentalCoachSessioni() {
  const { user } = useAuth()
  const myId = user?.id ?? ''
  const { students, loading: loadingStudents } = useAssignedStudents('mental_coach', myId)
  const { sessions, loading: loadingSessions, upsertSession } = useMentalSessions(myId)

  const loading = loadingStudents || loadingSessions

  const find = (sid: string, num: number): MentalSession | undefined =>
    sessions.find(s => s.student_id === sid && s.session_number === num)

  const counts = {
    completed: sessions.filter(s => s.status === 'completed').length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    pending: sessions.filter(s => s.status === 'pending').length,
  }

  const changeStatus = (sid: string, num: number, status: SessionStatus) => {
    upsertSession(sid, num, { status, completed_at: status === 'completed' ? new Date().toISOString() : null })
  }
  const changeDate = (sid: string, num: number, value: string) => {
    const iso = value ? new Date(value).toISOString() : null
    const cur = find(sid, num)
    upsertSession(sid, num, { scheduled_at: iso, status: cur?.status === 'pending' || !cur ? 'scheduled' : cur.status })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Gestione Sessioni" subtitle="Programma e traccia le sessioni dei tuoi studenti" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Completate', count: counts.completed, color: '#46D39A' },
          { label: 'Programmate', count: counts.scheduled, color: '#7CBBD0' },
          { label: 'In attesa', count: counts.pending, color: '#8495A3' },
        ].map((stat, i) => (
          <Card key={i} className="p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.count}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8495A3' }}>{stat.label}</p>
          </Card>
        ))}
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
          {students.map((s) => (
            <Card key={s.id} className="p-5">
              <p className="font-semibold text-white text-sm mb-3">{s.name}</p>
              <div className="space-y-2.5">
                {[1, 2].map((num) => {
                  const sess = find(s.id, num)
                  const status = (sess?.status ?? 'pending') as SessionStatus
                  return (
                    <div key={num} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold w-12 flex-shrink-0" style={{ color: '#8495A3' }}>Sess. {num}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={STATUS_STYLE[status]}>
                        {STATUS_LABELS[status]}
                      </span>
                      <select value={status} onChange={e => changeStatus(s.id, num, e.target.value as SessionStatus)} style={selectStyle}>
                        <option value="pending">In attesa</option>
                        <option value="scheduled">Programmata</option>
                        <option value="completed">Completata</option>
                        <option value="cancelled">Annullata</option>
                      </select>
                      <input
                        type="datetime-local"
                        value={toLocalInput(sess?.scheduled_at ?? null)}
                        onChange={e => changeDate(s.id, num, e.target.value)}
                        style={selectStyle}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
