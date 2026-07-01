import { Loader2, Inbox } from 'lucide-react'
import Card from './Card'
import { useIncomingFlags } from '../../lib/coaching'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Segnalazioni RICEVUTE dall'admin (per coach e mental coach). Il destinatario
// può segnarle risolte/riaprirle.
export default function IncomingFlags({ userId, emptyText }: { userId: string; emptyText?: string }) {
  const { flags, loading, setResolved } = useIncomingFlags(userId)

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} /></div>
  }

  if (flags.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Inbox size={22} strokeWidth={1.8} className="mx-auto mb-2" style={{ color: 'var(--ist-text-dim)' }} />
        <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>{emptyText ?? 'Nessuna segnalazione ricevuta.'}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {flags.map((s) => (
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
              <Inbox size={16} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-semibold text-sm" style={{ color: 'var(--ist-text)' }}>
                  {s.student?.name ?? 'Segnalazione'}
                </p>
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
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ color: '#46D39A', background: 'rgba(70,211,154,0.14)', border: '1px solid rgba(70,211,154,0.22)' }}>
                    Risolta
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>{s.issue}</p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--ist-text-dim)' }}>
                Dall'admin{s.author?.name ? ` (${s.author.name})` : ''} · {formatDate(s.created_at)}
              </p>
            </div>
            <button
              onClick={() => setResolved(s.id, !s.resolved)}
              className="text-xs font-medium flex-shrink-0 transition-opacity hover:opacity-80"
              style={{ color: s.resolved ? 'var(--ist-text-dim)' : 'var(--ist-accent-text)' }}
            >
              {s.resolved ? 'Riapri' : 'Segna risolta'}
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
