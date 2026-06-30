import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { GradientCard } from '../../components/ui/Card'
import { useAssignedStudents, useCoachFlags } from '../../lib/coaching'
import { useCoachAssignments, displayStatus } from '../../lib/assignments'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'Adesso'
  if (h < 24) return `${h}h fa`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Ieri' : `${d}g fa`
}

export default function CoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  const { students } = useAssignedStudents('coach', userId)
  const { assignments } = useCoachAssignments(userId)
  const { flags } = useCoachFlags(userId)

  const reviewPending = assignments.filter(a => displayStatus(a) === 'submitted').length
  const openFlags = flags.filter(f => !f.resolved)
  const activeStudents = students.filter(s => s.status === 'active').length

  // "Richiedono attenzione": segnalazioni aperte + studenti scaduti/bloccati
  const attention = [
    ...openFlags.map(f => ({ name: f.student?.name ?? '—', issue: f.issue, severity: f.severity as 'high' | 'medium' })),
    ...students.filter(s => s.status === 'expired' || s.status === 'blocked')
      .map(s => ({ name: s.name, issue: s.status === 'blocked' ? 'Account bloccato' : 'Account scaduto', severity: 'medium' as const })),
  ].slice(0, 5)

  // "Attività recente": consegne compiti più recenti degli assegnati
  const recent = assignments
    .filter(a => (a.submissions?.length ?? 0) > 0)
    .map(a => {
      const subs = a.submissions ?? []
      const last = subs[subs.length - 1]
      return { name: a.student?.name ?? '—', action: `Ha consegnato: ${a.title}`, at: last.submitted_at }
    })
    .sort((x, y) => +new Date(y.at) - +new Date(x.at))
    .slice(0, 5)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium" style={{ color: '#8495A3' }}>Area Coach</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Ciao, {user?.name?.split(' ')[0]} 👋</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Studenti assegnati" value={String(students.length)} icon="👥" />
        <StatCard label="Attivi" value={String(activeStudents)} icon="✅" />
        <StatCard label="Review in attesa" value={String(reviewPending)} icon="📋" />
        <StatCard label="Segnalazioni aperte" value={String(openFlags.length)} icon="🚨" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GradientCard
          title="Lista Studenti"
          tag={`${students.length} assegnati`}
          gradient="from-[#5A9AB1] via-[#286680] to-[#0A3346]"
          blob1="bg-[#7CBBD0]/50"
          blob2="bg-[#155A72]/70"
          onClick={() => navigate('/coach/studenti')}
          className="h-36"
        />
        <GradientCard
          title="Compiti"
          tag={`${reviewPending} da rivedere`}
          gradient="from-[#155A72] via-[#0F455C] to-[#061D2A]"
          blob1="bg-[#5A9AB1]/40"
          blob2="bg-[#0A3346]/80"
          onClick={() => navigate('/coach/review')}
          className="h-36"
        />
        <GradientCard
          title="Segnalazioni"
          tag={`${openFlags.length} aperte`}
          gradient="from-[#3d1a1a] via-[#2a1010] to-[#0f0808]"
          blob1="bg-[#FF6B7A]/20"
          blob2="bg-[#8a2d2d]/40"
          onClick={() => navigate('/coach/segnalazioni')}
          className="h-36"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5" style={{ borderLeft: '3px solid rgba(255,107,122,0.40)' }}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span>🚨</span> Richiedono attenzione
          </h3>
          {attention.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#8495A3' }}>Nessuna criticità. 👍</p>
          ) : (
            <div className="space-y-2">
              {attention.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < attention.length - 1 ? '1px solid var(--ist-w6)' : 'none' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.severity === 'high' ? '#FF6B7A' : '#7CBBD0' }} />
                  <span className="text-sm text-white font-medium">{a.name}</span>
                  <span className="text-sm" style={{ color: '#8495A3' }}>— {a.issue}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Attività recente</h3>
          {recent.length === 0 ? (
            <p className="text-sm py-1" style={{ color: '#8495A3' }}>Ancora nessuna consegna.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-ist-300 flex-shrink-0"
                    style={{ background: 'rgba(90,154,177,0.12)', border: '1px solid rgba(90,154,177,0.20)' }}
                  >
                    {item.name.charAt(0)}
                  </div>
                  <span className="text-sm text-white font-medium">{item.name}</span>
                  <span className="text-sm flex-1 truncate" style={{ color: '#8495A3' }}>{item.action}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: '#56636F' }}>{timeAgo(item.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
