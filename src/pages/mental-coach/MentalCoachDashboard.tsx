import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { GradientCard } from '../../components/ui/Card'
import { useAssignedStudents, useMentalSessions } from '../../lib/coaching'
import { useUnreadCounts, dmChannelId } from '../../lib/chat'

function fmtSession(iso: string | null): string {
  if (!iso) return 'Da programmare'
  const d = new Date(iso)
  const date = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export default function MentalCoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  const { students } = useAssignedStudents('mental_coach', userId)
  const { sessions } = useMentalSessions(userId)

  const dmIds = students.map(s => dmChannelId(userId, s.id))
  const { counts } = useUnreadCounts(userId, dmIds, null)
  const unread = Object.values(counts).reduce((a, b) => a + b, 0)

  const completed = sessions.filter(s => s.status === 'completed').length
  const toSchedule = sessions.filter(s => s.status === 'pending').length
  const upcoming = sessions
    .filter(s => s.status === 'scheduled')
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
    .slice(0, 6)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium" style={{ color: '#8495A3' }}>Area Mental Coach</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Ciao, {user?.name?.split(' ')[0]} 👋</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Studenti assegnati" value={String(students.length)} icon="👥" />
        <StatCard label="Sessioni completate" value={String(completed)} icon="✅" />
        <StatCard label="Da programmare" value={String(toSchedule)} icon="📅" />
        <StatCard label="Messaggi non letti" value={String(unread)} icon="💬" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <GradientCard
          title="Gestione Studenti"
          tag={`${students.length} assegnati`}
          gradient="from-[#155A72] via-[#0F455C] to-[#061D2A]"
          blob1="bg-[#5A9AB1]/40"
          blob2="bg-[#0A3346]/80"
          onClick={() => navigate('/mental-coach/studenti')}
          className="h-36"
        />
        <GradientCard
          title="Sessioni"
          tag={`${toSchedule} da programmare`}
          gradient="from-[#5A9AB1] via-[#286680] to-[#0A3346]"
          blob1="bg-[#7CBBD0]/50"
          blob2="bg-[#155A72]/70"
          onClick={() => navigate('/mental-coach/sessioni')}
          className="h-36"
        />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Prossime sessioni</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm py-1" style={{ color: '#8495A3' }}>Nessuna sessione programmata.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 py-2"
                style={{ borderBottom: i < upcoming.length - 1 ? '1px solid var(--ist-w6)' : 'none' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}
                >
                  {(s.student?.name ?? '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.student?.name ?? 'Studente'}</p>
                  <p className="text-xs" style={{ color: '#8495A3' }}>Sessione {s.session_number} · {fmtSession(s.scheduled_at)}</p>
                </div>
                <button
                  onClick={() => navigate('/mental-coach/sessioni')}
                  className="text-xs text-ist-300 hover:text-ist-200 transition-colors flex-shrink-0"
                >
                  Dettagli →
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
