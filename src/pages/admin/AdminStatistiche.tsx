import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'

export default function AdminStatistiche() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Statistiche" subtitle="Metriche generali della piattaforma" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Studenti attivi" value="18" icon="👥" trend="+3 mese" trendUp />
        <StatCard label="Completamento medio" value="58%" icon="📊" trend="+5%" trendUp />
        <StatCard label="Lezioni completate" value="342" icon="🎬" trend="+28" trendUp />
        <StatCard label="Retention" value="87%" icon="🔁" trend="-2%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Studenti per stato</h3>
          <div className="space-y-4">
            {[
              { label: 'Attivi', value: 18, percent: 75, color: '#46D39A', bgColor: 'rgba(70,211,154,0.10)' },
              { label: 'Scaduti', value: 4, percent: 17, color: '#F6C85F', bgColor: 'rgba(246,200,95,0.10)' },
              { label: 'Bloccati', value: 2, percent: 8, color: '#FF6B7A', bgColor: 'rgba(255,107,122,0.10)' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span style={{ color: '#8495A3' }}>{item.label}</span>
                  <span className="text-white font-semibold">
                    {item.value} <span style={{ color: '#56636F', fontWeight: 400 }}>({item.percent}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--ist-w7)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${item.percent}%`,
                      background: `linear-gradient(90deg, ${item.color}, ${item.color}99)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top performer</h3>
          <div className="space-y-3">
            {[
              { name: 'Roberto Greco', progress: 95, phase: 'Deploy', streak: 47 },
              { name: 'Gianna Conti', progress: 80, phase: 'Test', streak: 22 },
              { name: 'Paolo Gallo', progress: 70, phase: 'Build', streak: 18 },
              { name: 'Marco Rossi', progress: 65, phase: 'Build', streak: 12 },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-4 font-bold" style={{ color: '#56636F' }}>#{i + 1}</span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: 'linear-gradient(135deg, rgba(90,154,177,0.28), rgba(40,102,128,0.28))', color: '#A8D5E2' }}
                >
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  <p className="text-xs" style={{ color: '#56636F' }}>Fase {s.phase} · 🔥 {s.streak}gg</p>
                </div>
                <span className="text-sm font-bold text-ist-300">{s.progress}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Engagement settimanale</h3>
        <div className="grid grid-cols-7 gap-2">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, i) => {
            const values = [85, 72, 90, 68, 82, 45, 38]
            return (
              <div key={i} className="text-center">
                <div
                  className="h-20 rounded-xl flex items-end justify-center p-1 mb-1.5"
                  style={{ background: 'var(--ist-w5)', border: '1px solid var(--ist-w6)' }}
                >
                  <div
                    className="w-full rounded-lg transition-all"
                    style={{
                      height: `${values[i]}%`,
                      background: 'linear-gradient(180deg, #7CBBD0 0%, #286680 100%)',
                      boxShadow: '0 0 12px rgba(124,187,208,0.20)',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: '#56636F' }}>{day}</p>
                <p className="text-xs" style={{ color: '#8495A3' }}>{values[i]}%</p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
