import { Loader2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import BarChart from '../../components/ui/BarChart'
import { useAdminStatistics, useAdminCharts } from '../../lib/adminStats'

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const monthLabel = (ym: string) => MONTHS_SHORT[parseInt(ym.slice(5, 7), 10) - 1] ?? ym

export default function AdminStatistiche() {
  const { data, loading } = useAdminStatistics()
  const { data: charts } = useAdminCharts()

  const total = data ? data.by_status.active + data.by_status.expired + data.by_status.blocked : 0
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const statusRows = data ? [
    { label: 'Attivi',   value: data.by_status.active,  color: '#46D39A' },
    { label: 'Scaduti',  value: data.by_status.expired, color: '#F6C85F' },
    { label: 'Bloccati', value: data.by_status.blocked, color: '#FF6B7A' },
  ] : []

  const signupData = charts?.signups.map(p => ({ label: monthLabel(p.month), value: p.count })) ?? []
  const completionData = charts?.completions.map(p => ({ label: monthLabel(p.month), value: p.count })) ?? []
  const tierTotal = charts ? charts.tier.full + charts.tier.free : 0
  const tierPct = (n: number) => (tierTotal > 0 ? Math.round((n / tierTotal) * 100) : 0)

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

          {/* Grafici andamento (ultimi 12 mesi) + split tier */}
          {charts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Nuove iscrizioni</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--ist-text-dim)' }}>Studenti registrati per mese (ultimi 12)</p>
                <BarChart data={signupData} color="#7CBBD0" />
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Lezioni completate</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--ist-text-dim)' }}>Completamenti per mese (ultimi 12)</p>
                <BarChart data={completionData} color="#46D39A" />
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-white mb-4">Piano studenti — paganti vs gratuiti</h3>
                {tierTotal === 0 ? (
                  <p className="text-sm" style={{ color: '#8495A3' }}>Nessuno studente registrato.</p>
                ) : (
                  <>
                    <div className="flex h-4 rounded-full overflow-hidden mb-3" style={{ background: 'var(--ist-w7)' }}>
                      <div style={{ width: `${tierPct(charts.tier.full)}%`, background: 'linear-gradient(90deg, #7CBBD0, #286680)' }} />
                      <div style={{ width: `${tierPct(charts.tier.free)}%`, background: 'linear-gradient(90deg, #46D39A, #2BA877)' }} />
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7CBBD0' }} />
                        <span style={{ color: 'var(--ist-text-muted)' }}>Completi</span>
                        <span className="font-semibold text-white">{charts.tier.full} <span style={{ color: '#56636F', fontWeight: 400 }}>({tierPct(charts.tier.full)}%)</span></span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#46D39A' }} />
                        <span style={{ color: 'var(--ist-text-muted)' }}>Gratuiti</span>
                        <span className="font-semibold text-white">{charts.tier.free} <span style={{ color: '#56636F', fontWeight: 400 }}>({tierPct(charts.tier.free)}%)</span></span>
                      </span>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
