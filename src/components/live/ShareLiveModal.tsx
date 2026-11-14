import { useEffect, useState } from 'react'
import { X, Download, Share2, Loader2, Send, Check, MessageCircle, Megaphone, Bell, WandSparkles, CircleAlert } from 'lucide-react'
import { LiveEvent } from '../../lib/live'
import {
  SHARE_FORMATS, ShareFormat, composeShareImage, saveShareImage, countAudience, AUDIENCE_LABEL,
  defaultInviteMessage, broadcastLiveInvite, notifyLiveBroadcast, bachecaChannels,
} from '../../lib/liveShare'
import { postAnnouncement } from '../../lib/bacheca'
import { useAuth } from '../../context/AuthContext'
import { MemberRole } from '../../data/chatData'

// Condividi una live: immagine pronta per i social (scarica / condividi) e,
// per l'admin, invio della scheda in chat privata a chi è rivolta la live,
// post negli annunci e notifica push.
export default function ShareLiveModal({ event: e, onClose, onClaimCover }: {
  event: LiveEvent
  onClose: () => void
  onClaimCover?: () => Promise<unknown>
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [format, setFormat] = useState<ShareFormat>('post')
  const [preview, setPreview] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator

  // Anteprima dell'immagine (ricomposta a ogni cambio di formato/copertina)
  useEffect(() => {
    let url: string | null = null; let alive = true
    setRendering(true)
    composeShareImage(e, format).then(b => {
      if (!alive) return
      url = URL.createObjectURL(b); setPreview(url)
    }).catch(() => alive && setPreview(null)).finally(() => alive && setRendering(false))
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [e, format])

  // Invio (solo admin)
  const [message, setMessage] = useState(defaultInviteMessage(e))
  const [toChat, setToChat] = useState(true)
  const [toBacheca, setToBacheca] = useState(false)
  const [toPush, setToPush] = useState(true)
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])
  const [channelId, setChannelId] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ chat?: number; bacheca?: boolean; push?: number | null; error?: string } | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    countAudience(e.audience).then(setCount)
    bachecaChannels().then(list => { setChannels(list); if (list[0]) setChannelId(list[0].id) })
  }, [isAdmin, e.audience])

  const send = async () => {
    if (!user || sending || !message.trim()) return
    setSending(true); setResult(null)
    const r: NonNullable<typeof result> = {}
    if (toChat) {
      const res = await broadcastLiveInvite(e.id, message)
      if (res.ok) r.chat = res.sent; else r.error = res.error
    }
    if (toBacheca && channelId) {
      r.bacheca = await postAnnouncement(channelId, user.id, user.name, user.role as MemberRole, {
        title: e.title, content: message, tag: e.status === 'replay' ? 'Replay' : 'Live', liveEventId: e.id,
      })
    }
    if (toPush) r.push = (await notifyLiveBroadcast(e, message))?.sent ?? null
    setResult(r); setSending(false)
  }

  const fmt = SHARE_FORMATS.find(f => f.id === format)!
  const inputStyle: React.CSSProperties = { background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)', color: 'var(--ist-text)' }
  const toggle = (on: boolean, set: (v: boolean) => void, icon: React.ReactNode, label: string, hint: string) => (
    <button
      onClick={() => set(!on)}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-colors"
      style={{ background: on ? 'rgba(124,187,208,0.12)' : 'var(--ist-w5)', border: `1px solid ${on ? 'rgba(124,187,208,0.35)' : 'var(--ist-w9)'}` }}
    >
      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: on ? 'rgba(124,187,208,0.18)' : 'var(--ist-w8)', color: on ? 'var(--ist-accent-text)' : 'var(--ist-text-dim)' }}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>{label}</span>
        <span className="block text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>{hint}</span>
      </span>
      <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: on ? '#5A9AB1' : 'transparent', border: on ? 'none' : '1.5px solid var(--ist-w20)' }}>
        {on && <Check size={13} strokeWidth={3} color="white" />}
      </span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div
        className={`w-full ${isAdmin ? 'max-w-4xl' : 'max-w-lg'} rounded-[28px] overflow-hidden my-auto`}
        style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}
        onClick={ev => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold" style={{ color: 'var(--ist-text)' }}>Condividi la live</h2>
            <p className="text-xs truncate" style={{ color: 'var(--ist-text-muted)' }}>{e.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className={`p-5 sm:p-6 ${isAdmin ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''}`}>
          {/* Immagine per i social */}
          <div className="space-y-3 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Immagine per i social</p>
            <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: 'var(--ist-w5)' }}>
              {SHARE_FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                  style={format === f.id ? { background: 'var(--ist-w12)', color: 'var(--ist-text)' } : { color: 'var(--ist-text-muted)' }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative mx-auto rounded-2xl overflow-hidden" style={{ aspectRatio: `${fmt.w} / ${fmt.h}`, maxHeight: 420, background: '#05070d', border: '1px solid var(--ist-w10)' }}>
              {preview && <img src={preview} alt="Anteprima" className="w-full h-full object-contain" />}
              {rendering && <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(5,7,13,0.45)' }}><Loader2 size={22} className="animate-spin text-white" /></div>}
            </div>
            <p className="text-[11px] text-center" style={{ color: 'var(--ist-text-dim)' }}>{fmt.hint} · {fmt.w}×{fmt.h}</p>
            {!e.coverUrl && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(246,200,95,0.1)', color: '#F6C85F' }}>
                <CircleAlert size={14} className="flex-shrink-0" />
                <span className="flex-1">Questa live non ha ancora una copertina.</span>
                {onClaimCover && (
                  <button disabled={claiming} onClick={async () => { setClaiming(true); await onClaimCover(); setClaiming(false) }} className="flex items-center gap-1 font-bold underline disabled:opacity-60">
                    {claiming ? <Loader2 size={12} className="animate-spin" /> : <WandSparkles size={12} />} Assegnala
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => saveShareImage(e, format)} disabled={rendering}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}>
                <Download size={15} strokeWidth={2.4} /> Scarica
              </button>
              {canShareFiles && (
                <button onClick={() => saveShareImage(e, format, true)} disabled={rendering}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--ist-w8)', color: 'var(--ist-text)' }}>
                  <Share2 size={15} strokeWidth={2.2} /> Condividi
                </button>
              )}
            </div>
          </div>

          {/* Invio nella piattaforma (solo admin) */}
          {isAdmin && (
            <div className="space-y-3 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>Invia nella piattaforma</p>
              <p className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>
                Destinatari: <b style={{ color: 'var(--ist-text)' }}>{AUDIENCE_LABEL[e.audience]}</b>
                {count !== null && <> · {count} {count === 1 ? 'persona' : 'persone'}</>}
                <span className="block text-[11px] mt-0.5" style={{ color: 'var(--ist-text-dim)' }}>Si cambia da «Modifica» → Audience della live.</span>
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Messaggio</label>
                <textarea value={message} onChange={ev => setMessage(ev.target.value)} rows={4} className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none resize-none" style={{ ...inputStyle, lineHeight: 1.5 }} />
              </div>
              {toggle(toChat, setToChat, <MessageCircle size={15} />, 'Chat privata', 'Ognuno riceve il messaggio con la scheda della live')}
              {toggle(toBacheca, setToBacheca, <Megaphone size={15} />, 'Annunci', 'Post con copertina e scheda della live')}
              {toBacheca && channels.length > 1 && (
                <select value={channelId} onChange={ev => setChannelId(ev.target.value)} className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none" style={inputStyle}>
                  {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              )}
              {toggle(toPush, setToPush, <Bell size={15} />, 'Notifica push', 'Avviso sul telefono che apre la live')}

              {result && (
                <div className="px-3.5 py-2.5 rounded-2xl text-xs space-y-0.5" style={{ background: result.error ? 'rgba(255,107,122,0.1)' : 'rgba(70,211,154,0.1)', color: result.error ? '#FF6B7A' : '#46D39A' }}>
                  {result.chat !== undefined && <p>✓ Inviata in chat privata a {result.chat} {result.chat === 1 ? 'persona' : 'persone'}</p>}
                  {result.bacheca !== undefined && <p>{result.bacheca ? '✓ Pubblicata negli annunci' : '✗ Annuncio non pubblicato'}</p>}
                  {result.push !== undefined && <p>{result.push === null ? '✗ Notifica non inviata' : `✓ Notifica inviata a ${result.push} dispositivi`}</p>}
                  {result.error && <p>✗ {result.error}</p>}
                </div>
              )}
              <button onClick={send} disabled={sending || !message.trim() || (!toChat && !toBacheca && !toPush) || (toBacheca && !channelId)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 45%, #0A3346 100%)', boxShadow: '0 4px 14px rgba(40,102,128,0.3)' }}>
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} strokeWidth={2.4} />}
                {sending ? 'Invio…' : 'Invia'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
