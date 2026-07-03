import { useState } from 'react'
import { X, Megaphone, Loader2, Check, Send } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { MemberRole } from '../../data/chatData'
import { postAnnouncement } from '../../lib/bacheca'
import { notifyBroadcast } from '../../lib/push'

type Segment = 'all' | 'full' | 'free'
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'full', label: 'Paganti' },
  { id: 'free', label: 'Gratuiti' },
]

// Annuncio broadcast: pubblica in una bacheca e/o invia una notifica push a
// tutti gli studenti (o a un segmento per tier), in un colpo solo.
export default function BroadcastModal({
  bachecaChannels,
  onClose,
}: {
  bachecaChannels: { id: string; name: string; free?: boolean }[]
  onClose: () => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const [channelId, setChannelId] = useState<string>(bachecaChannels[0]?.id ?? '')
  const [pushOn, setPushOn] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ bacheca: boolean | null; sent: number | null } | null>(null)

  const inputStyle: React.CSSProperties = {
    background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)', color: 'var(--ist-text)',
  }

  const send = async () => {
    if (!message.trim()) { setError('Scrivi il messaggio.'); return }
    if (!channelId && !pushOn) { setError('Scegli una bacheca o attiva la notifica push.'); return }
    if (!user) return
    setSending(true); setError('')

    let bacheca: boolean | null = null
    if (channelId) {
      bacheca = await postAnnouncement(channelId, user.id, user.name, user.role as MemberRole, { title, content: message })
    }
    let sent: number | null = null
    if (pushOn) {
      const url = channelId ? `/student/chat?c=${channelId}` : '/student'
      const res = await notifyBroadcast(title.trim() || '📢 Annuncio IST', message.trim(), url, segment)
      sent = res?.sent ?? 0
    }

    setSending(false)
    setResult({ bacheca, sent })
  }

  return (
    <>
      <div className="fixed inset-0 z-[100]" style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div
        className="fixed z-[101] left-1/2 top-1/2 w-full px-4"
        style={{ transform: 'translate(-50%, -50%)', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="w-full rounded-[28px] overflow-hidden"
          style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)', backdropFilter: 'blur(32px)', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,187,208,0.15)', color: '#7CBBD0' }}>
                <Megaphone size={17} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>Nuovo annuncio</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>Bacheca + notifica agli studenti</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          {result ? (
            /* Esito */
            <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(70,211,154,0.15)', color: '#46D39A' }}>
                <Check size={26} strokeWidth={2.5} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>Annuncio inviato</p>
              <div className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>
                {result.bacheca !== null && <p>{result.bacheca ? '✓ Pubblicato in bacheca' : '✗ Bacheca non riuscita'}</p>}
                {result.sent !== null && <p>🔔 Notifica inviata a {result.sent} {result.sent === 1 ? 'dispositivo' : 'dispositivi'}</p>}
              </div>
              <button onClick={onClose} className="mt-2 px-6 py-2.5 rounded-2xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
                Chiudi
              </button>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Titolo (opzionale)</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="es. Nuova live in programma" className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Messaggio *</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Scrivi l'annuncio..." className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none resize-none" style={inputStyle} />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--ist-text-muted)' }}>Destinatari notifica</label>
                  <div className="flex gap-1.5">
                    {SEGMENTS.map(s => (
                      <button key={s.id} onClick={() => setSegment(s.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={segment === s.id ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' } : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Pubblica in bacheca</label>
                  <select value={channelId} onChange={e => setChannelId(e.target.value)} className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none" style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="" style={{ background: '#0d1117' }}>Nessuna (solo notifica)</option>
                    {bachecaChannels.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#0d1117' }}>#{c.name}{c.free ? ' (free)' : ''}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer" style={{ background: pushOn ? 'rgba(124,187,208,0.08)' : 'var(--ist-w5)' }}>
                  <input type="checkbox" checked={pushOn} onChange={() => setPushOn(v => !v)} className="accent-ist-400 w-4 h-4 rounded" />
                  <span className="text-xs" style={{ color: 'var(--ist-text)' }}>Invia <strong>notifica push</strong> agli studenti</span>
                </label>

                {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}
              </div>

              <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--ist-w8)' }}>
                <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-2xl" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>Annulla</button>
                <button onClick={send} disabled={sending} className="flex-1 py-2.5 text-sm font-semibold rounded-2xl text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} strokeWidth={2.2} />}
                  {sending ? 'Invio...' : 'Invia annuncio'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
