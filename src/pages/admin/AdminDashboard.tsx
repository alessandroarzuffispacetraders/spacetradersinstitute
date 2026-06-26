import { useNavigate } from 'react-router-dom'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { GradientCard } from '../../components/ui/Card'

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium" style={{ color: '#8495A3' }}>Pannello Amministrazione</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">IST Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Studenti totali" value="24" icon="👥" trend="+3 mese" trendUp />
        <StatCard label="Attivi" value="18" icon="✅" trend="75%" trendUp />
        <StatCard label="Coach" value="3" icon="🎯" />
        <StatCard label="Mental Coach" value="2" icon="🧠" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <GradientCard
          title="Gestione Utenti"
          tag="24 totali"
          gradient="from-[#5A9AB1] via-[#286680] to-[#0A3346]"
          blob1="bg-[#7CBBD0]/50"
          blob2="bg-[#155A72]/70"
          onClick={() => navigate('/admin/utenti')}
          className="h-36"
        />
        <GradientCard
          title="Contenuti"
          tag="48 corsi"
          gradient="from-[#155A72] via-[#0F455C] to-[#061D2A]"
          blob1="bg-[#5A9AB1]/40"
          blob2="bg-[#0A3346]/80"
          onClick={() => navigate('/admin/contenuti')}
          className="h-36"
        />
        <GradientCard
          title="Statistiche"
          tag="Live analytics"
          gradient="from-[#3da67b] via-[#2a8060] to-[#0f3a28]"
          blob1="bg-[#5dc4a0]/60"
          blob2="bg-[#1a6045]/80"
          onClick={() => navigate('/admin/statistiche')}
          className="h-36"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Distribuzione studenti per fase</h3>
          <div className="space-y-3">
            {[
              { label: 'Onboarding', count: 4, total: 24 },
              { label: 'Build', count: 12, total: 24 },
              { label: 'Test', count: 5, total: 24 },
              { label: 'Deploy', count: 3, total: 24 },
            ].map((phase) => (
              <div key={phase.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: '#8495A3' }}>{phase.label}</span>
                  <span className="text-white font-medium">{phase.count}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--ist-w7)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(phase.count / phase.total) * 100}%`,
                      background: 'linear-gradient(90deg, #7CBBD0 0%, #286680 100%)',
                      boxShadow: '0 0 12px rgba(124,187,208,0.30)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Attività recente</h3>
          <div className="space-y-3">
            {[
              { text: 'Nuovo studente registrato: Paolo G.', time: '2h fa', icon: '👤' },
              { text: 'Videocorso pubblicato: Modulo 5', time: '5h fa', icon: '🎬' },
              { text: 'Luca F. segnalato come bloccato', time: 'Ieri', icon: '🚨' },
              { text: 'Sessione live programmata: 4 Lug', time: 'Ieri', icon: '📡' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-sm text-white/80">{item.text}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#56636F' }}>{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
