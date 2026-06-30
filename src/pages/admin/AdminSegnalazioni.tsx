import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import { useAdminFlags } from '../../lib/coaching'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminSegnalazioni() {
  const { flags, loading } = useAdminFlags()
  const [onlyOpen, setOnlyOpen] = useState(true)

  const openCount = flags.filter(f => !f.resolved).length
  const openHigh = flags.filter(f => !f.resolved && f.severity === 'high').length
  const visible = onlyOpen ? flags.filter(f => !f.resolved) : flags

  const FilterChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all"
      style={active
        ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)', border: '1px solid var(--ist-border-strong)' }
        : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w8)' }}
    >
      {label}
    </button>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Segnalazioni"
        subtitle="Tutte le segnalazioni aperte dai coach sugli studenti"
      />

      {/* Riepilogo */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <FilterChip active={onlyOpen} label="Solo aperte" onClick={() => setOnlyOpen(true)} />
          <FilterChip active={!onlyOpen} label="Tutte" onClick={() => setOnlyOpen(false)} />
        </div>
        <div className="flex-1" />
        <p className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>
          {openCount} aperte
          {openHigh > 0 && (
            <span style={{ color: '#FF6B7A', fontWeight: 600 }}> · {openHigh} alta priorità</span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ist-accent-text)' }} />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            {onlyOpen ? 'Nessuna segnalazione aperta. Tutto sotto controllo.' : 'Nessuna segnalazione.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <Card
              key={s.id}
              className="p-5"
              style={!s.resolved ? { borderLeft: `3px solid ${s.severity === 'high' ? 'rgba(255,107,122,0.40)' : 'rgba(90,154,177,0.40)'}` } : {}}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: s.resolved ? 'rgba(70,211,154,0.12)' : s.severity === 'high' ? 'rgba(255,107,122,0.12)' : 'rgba(90,154,177,0.12)',
                    color: s.resolved ? '#46D39A' : s.severity === 'high' ? '#FF6B7A' : '#7CBBD0',
                  }}
                >
                  <AlertTriangle size={16} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: 'var(--ist-text)' }}>{s.student?.name ?? 'Studente'}</p>
                    {!s.resolved ? (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={s.severity === 'high'
                          ? { color: '#FF6B7A', background: 'rgba(255,107,122,0.14)', border: '1px solid rgba(255,107,122,0.22)' }
                          : { color: '#7CBBD0', background: 'rgba(90,154,177,0.14)', border: '1px solid rgba(90,154,177,0.22)' }}
                      >
                        {s.severity === 'high' ? 'Alta priorità' : 'Media priorità'}
                      </span>
                    ) : (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}
                      >
                        Risolta
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>{s.issue}</p>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--ist-text-dim)' }}>
                    Coach: {s.coach?.name ?? '—'} · {formatDate(s.created_at)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
