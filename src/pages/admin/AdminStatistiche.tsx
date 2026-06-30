import { Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { useAdminStatistics } from '../../lib/adminStats'

export default function AdminStatistiche() {
  const { data, loading } = useAdminStatistics()

  const total = data ? data.by_status.active + data.by_status.expired + data.by_status.blocked : 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const statusRows = data ? [
    { label: 'Attivi',   value: data.by_status.active,  color: '#46D39A' },
    { label: 'Scaduti',  value: data.by_status.expired, color: '#F6C85F' },
    { label: 'Bloccati', value: data.by_status.blocked, color: '#FF6B7A' },
  ] : []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Statistiche" subtitle="Metriche generali della piattaforma" />

      {loading || !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Studenti totali" value={String(total)} icon="👥" />
            <StatCard label="Studenti attivi" value={String(data.by_status.active)} icon="✅" />
            <StatCard label="Completamento medio" value={`${data.avg_completion}%`} icon="📊" />
            <StatCard label="Lezioni completate" value={String(data.lessons_completed_total)} icon="🎬" />
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Studenti per stato</h3>
            {total === 0 ? (
              <p className="text-sm" style={{ color: '#8495A3' }}>Nessuno studente registrato.</p>
            ) : (
              <div className="space-y-4">
                {statusRows.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span style={{ color: '#8495A3' }}>{item.label}</span>
                      <span className="text-white font-semibold">
                        {item.value} <span style={{ color: '#56636F', fontWeight: 400 }}>({pct(item.value)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--ist-w7)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct(item.value)}%`,
                          background: `linear-gradient(90deg, ${item.color}, ${item.color}99)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
