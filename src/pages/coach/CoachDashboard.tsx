import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { GradientCard } from '../../components/ui/Card'

export default function CoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium" style={{ color: '#8495A3' }}>Area Coach</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Ciao, {user?.name?.split(' ')[0]} 👋</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Studenti assegnati" value="8" icon="👥" />
        <StatCard label="Attivi questa settimana" value="6" icon="✅" trend="75%" trendUp />
        <StatCard label="Review in attesa" value="3" icon="📋" />
        <StatCard label="Segnalazioni aperte" value="2" icon="🚨" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GradientCard
          title="Lista Studenti"
          tag="8 assegnati"
          gradient="from-[#5A9AB1] via-[#286680] to-[#0A3346]"
          blob1="bg-[#7CBBD0]/50"
          blob2="bg-[#155A72]/70"
          onClick={() => navigate('/coach/studenti')}
          className="h-36"
        />
        <GradientCard
          title="Review Esercizi"
          tag="3 in attesa"
          gradient="from-[#155A72] via-[#0F455C] to-[#061D2A]"
          blob1="bg-[#5A9AB1]/40"
          blob2="bg-[#0A3346]/80"
          onClick={() => navigate('/coach/review')}
          className="h-36"
        />
        <GradientCard
          title="Segnalazioni"
          tag="2 aperte"
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
          <div className="space-y-2">
            {[
              { name: 'Luca Ferrari', issue: 'Inattivo da 5 giorni', severity: 'high' },
              { name: 'Gianna Conti', issue: 'Nessuna voce diario questa settimana', severity: 'medium' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i === 0 ? '1px solid var(--ist-w6)' : 'none' }}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.severity === 'high' ? 'bg-danger' : 'bg-ist-400'}`} />
                <span className="text-sm text-white font-medium">{a.name}</span>
                <span className="text-sm" style={{ color: '#8495A3' }}>— {a.issue}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Attività recente</h3>
          <div className="space-y-3">
            {[
              { name: 'Marco R.', action: 'Ha completato Modulo 2', time: '1h fa' },
              { name: 'Anna P.', action: 'Nuova voce nel diario', time: '3h fa' },
              { name: 'Stefano M.', action: 'Ha partecipato alla live', time: '5h fa' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-ist-300 flex-shrink-0"
                  style={{ background: 'rgba(90,154,177,0.12)', border: '1px solid rgba(90,154,177,0.20)' }}
                >
                  {item.name.charAt(0)}
                </div>
                <span className="text-sm text-white font-medium">{item.name}</span>
                <span className="text-sm flex-1" style={{ color: '#8495A3' }}>{item.action}</span>
                <span className="text-xs" style={{ color: '#56636F' }}>{item.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
