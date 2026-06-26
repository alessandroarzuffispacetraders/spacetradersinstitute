import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { GradientCard } from '../../components/ui/Card'

export default function MentalCoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium" style={{ color: '#8495A3' }}>Area Mental Coach</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">Ciao, {user?.name?.split(' ')[0]} 👋</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Studenti assegnati" value="6" icon="👥" />
        <StatCard label="Sessioni completate" value="8" icon="✅" />
        <StatCard label="Da programmare" value="4" icon="📅" />
        <StatCard label="Messaggi non letti" value="2" icon="💬" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <GradientCard
          title="Gestione Studenti"
          tag="6 assegnati"
          gradient="from-[#155A72] via-[#0F455C] to-[#061D2A]"
          blob1="bg-[#5A9AB1]/40"
          blob2="bg-[#0A3346]/80"
          onClick={() => navigate('/mental-coach/studenti')}
          className="h-36"
        />
        <GradientCard
          title="Sessioni"
          tag="4 da programmare"
          gradient="from-[#5A9AB1] via-[#286680] to-[#0A3346]"
          blob1="bg-[#7CBBD0]/50"
          blob2="bg-[#155A72]/70"
          onClick={() => navigate('/mental-coach/sessioni')}
          className="h-36"
        />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Prossime sessioni</h3>
        <div className="space-y-3">
          {[
            { name: 'Marco Rossi', session: 'Sessione 2', date: 'Lun 1 Lug · 15:00' },
            { name: 'Anna Pellegrini', session: 'Sessione 1', date: 'Mer 3 Lug · 10:00' },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: i === 0 ? '1px solid var(--ist-w6)' : 'none' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}
              >
                {s.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">{s.name}</p>
                <p className="text-xs" style={{ color: '#8495A3' }}>{s.session} · {s.date}</p>
              </div>
              <button className="text-xs text-ist-300 hover:text-ist-200 transition-colors">Zoom →</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
