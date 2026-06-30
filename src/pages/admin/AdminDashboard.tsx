import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, ChevronRight } from 'lucide-react'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import { GradientCard } from '../../components/ui/Card'
import { useAdminDashboard } from '../../lib/adminStats'
import { useAdminFlags } from '../../lib/coaching'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'Adesso'
  if (h < 24) return `${h}h fa`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Ieri' : `${d}g fa`
}

const PHASE_ROWS: { key: 'onboarding' | 'build' | 'test' | 'deploy'; label: string }[] = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'build', label: 'Build' },
  { key: 'test', label: 'Test' },
  { key: 'deploy', label: 'Deploy' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data, loading } = useAdminDashboard()
  const { flags } = useAdminFlags()
  const openHigh = flags.filter(f => !f.resolved && f.severity === 'high').length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium" style={{ color: '#8495A3' }}>Pannello Amministrazione</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">IST Dashboard</h1>
      </div>

      {openHigh > 0 && (
        <button
          onClick={() => navigate('/admin/segnalazioni')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl mb-6 text-left transition-all hover:-translate-y-0.5"
          style={{
            background: 'rgba(255,107,122,0.10)',
            border: '1px solid rgba(255,107,122,0.28)',
            boxShadow: '0 8px 24px rgba(255,107,122,0.12)',
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,107,122,0.16)' }}>
            <AlertTriangle size={18} strokeWidth={2.2} style={{ color: '#FF6B7A' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>
              {openHigh} segnalazion{openHigh === 1 ? 'e' : 'i'} alta priorità da rivedere
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ist-text-dim)' }}>Studenti che richiedono attenzione immediata</p>
          </div>
          <ChevronRight size={18} style={{ color: '#FF6B7A' }} />
        </button>
      )}

      {loading || !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Studenti totali" value={String(data.students_total)} icon="👥" />
            <StatCard label="Attivi" value={String(data.students_active)} icon="✅" />
            <StatCard label="Coach" value={String(data.coaches)} icon="🎯" />
            <StatCard label="Mental Coach" value={String(data.mental_coaches)} icon="🧠" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <GradientCard
              title="Gestione Utenti"
              tag={`${data.students_total} studenti`}
              gradient="from-[#5A9AB1] via-[#286680] to-[#0A3346]"
              blob1="bg-[#7CBBD0]/50"
              blob2="bg-[#155A72]/70"
              onClick={() => navigate('/admin/utenti')}
              className="h-36"
            />
            <GradientCard
              title="Contenuti"
              tag="Catalogo"
              gradient="from-[#155A72] via-[#0F455C] to-[#061D2A]"
              blob1="bg-[#5A9AB1]/40"
              blob2="bg-[#0A3346]/80"
              onClick={() => navigate('/admin/contenuti')}
              className="h-36"
            />
            <GradientCard
              title="Statistiche"
              tag="Analytics"
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
                {PHASE_ROWS.map((phase) => {
                  const count = data.by_phase[phase.key] ?? 0
                  const total = data.students_total || 1
                  return (
                    <div key={phase.key}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span style={{ color: '#8495A3' }}>{phase.label}</span>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'var(--ist-w7)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / total) * 100}%`,
                            background: 'linear-gradient(90deg, #7CBBD0 0%, #286680 100%)',
                            boxShadow: '0 0 12px rgba(124,187,208,0.30)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Attività recente</h3>
              {data.recent.length === 0 ? (
                <p className="text-sm" style={{ color: '#8495A3' }}>Nessuna attività recente.</p>
              ) : (
                <div className="space-y-3">
                  {data.recent.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-base mt-0.5">{item.type === 'student' ? '👤' : '🎬'}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">
                          {item.type === 'student' ? 'Nuovo studente: ' : 'Contenuto pubblicato: '}{item.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#56636F' }}>{timeAgo(item.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
