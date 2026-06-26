import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Send, Users, Radio, Play, Pause,
  MoreVertical, MicOff, Clock, Ban, X, Shield, ChevronDown,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import { LIVE_EVENTS, LIVE_CHAT_SEED, BOT_MESSAGES, LiveChatMessage, LiveRole } from '../../data/liveData'

// ─── constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<LiveRole, string> = {
  admin:        'Admin',
  coach:        'Coach',
  mental_coach: 'Mental Coach',
  student:      '',
}
const ROLE_BADGE: Record<LiveRole, { bg: string; text: string }> = {
  admin:        { bg: 'rgba(90,154,177,0.22)',  text: '#7CBBD0' },
  coach:        { bg: 'rgba(90,154,177,0.22)',  text: '#7CBBD0' },
  mental_coach: { bg: 'rgba(160,120,255,0.20)', text: '#A078FF' },
  student:      { bg: 'transparent',            text: 'transparent' },
}
const AVATAR_GRAD: Record<LiveRole, string> = {
  admin:        'linear-gradient(135deg,#5A9AB1,#286680)',
  coach:        'linear-gradient(135deg,#5A9AB1,#286680)',
  mental_coach: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
  student:      'linear-gradient(135deg,#374151,#6b7280)',
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

type ModeAction = 'timeout5' | 'timeout15' | 'timeout60' | 'mute' | 'ban'
interface ModState {
  muted:    Set<string>
  banned:   Set<string>
  timeouts: Map<string, number>
}

// ─── Moderation menu ─────────────────────────────────────────────────────────

function ModerationMenu({ msg, modState, onAction, onClose }: {
  msg: LiveChatMessage
  modState: ModState
  onAction: (a: ModeAction, id: string) => void
  onClose: () => void
}) {
  const isMuted   = modState.muted.has(msg.authorId)
  const isBanned  = modState.banned.has(msg.authorId)
  const timedOut  = modState.timeouts.has(msg.authorId)

  const Item = ({ icon, label, danger, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-white/[0.04]"
      style={{ color: danger ? '#FF6B7A' : 'var(--ist-text-muted)' }}
    >
      <span style={{ color: danger ? '#FF6B7A' : 'var(--ist-text-dim)', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  )

  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 w-52 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--ist-nav-bg)',
        border: '1px solid var(--ist-nav-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
        <Shield size={12} strokeWidth={2} style={{ color: '#F6C85F' }} />
        <span className="text-xs font-semibold truncate" style={{ color: 'var(--ist-text-muted)' }}>
          {msg.author}
        </span>
      </div>

      {!isBanned && !timedOut && (
        <>
          <Item icon={<Clock size={12} strokeWidth={2} />} label="Timeout 5 min"  onClick={() => { onAction('timeout5',  msg.authorId); onClose() }} />
          <Item icon={<Clock size={12} strokeWidth={2} />} label="Timeout 15 min" onClick={() => { onAction('timeout15', msg.authorId); onClose() }} />
          <Item icon={<Clock size={12} strokeWidth={2} />} label="Timeout 1 ora"  onClick={() => { onAction('timeout60', msg.authorId); onClose() }} />
          <div style={{ borderTop: '1px solid var(--ist-w7)' }} />
        </>
      )}
      {timedOut && (
        <Item icon={<Clock size={12} strokeWidth={2} />} label="Rimuovi timeout" onClick={() => { onAction('timeout5', msg.authorId); onClose() }} />
      )}
      {!isBanned && (
        <Item
          icon={<MicOff size={12} strokeWidth={2} />}
          label={isMuted ? 'Togli mute' : 'Muta in chat'}
          danger={!isMuted}
          onClick={() => { onAction('mute', msg.authorId); onClose() }}
        />
      )}
      <Item
        icon={<Ban size={12} strokeWidth={2} />}
        label={isBanned ? 'Rimuovi ban' : 'Rimuovi dalla live'}
        danger={!isBanned}
        onClick={() => { onAction('ban', msg.authorId); onClose() }}
      />
    </div>
  )
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

function ChatBubble({ msg, canModerate, modState, onAction }: {
  msg: LiveChatMessage
  canModerate: boolean
  modState: ModState
  onAction: (a: ModeAction, id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const isBanned  = modState.banned.has(msg.authorId)
  const isMuted   = modState.muted.has(msg.authorId)
  const timedOut  = modState.timeouts.has(msg.authorId)
  const isStaff   = msg.authorRole !== 'student'
  const badge     = ROLE_BADGE[msg.authorRole]

  if (isBanned) {
    return (
      <div className="px-4 py-2 flex items-center gap-2 select-none" style={{ opacity: 0.35 }}>
        <Ban size={10} strokeWidth={2} style={{ color: '#FF6B7A' }} />
        <span className="text-[10px] italic" style={{ color: 'var(--ist-text-dim)' }}>
          Utente rimosso dalla live
        </span>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`px-4 py-2.5 flex gap-2.5 group transition-colors hover:bg-black/[0.03] ${isMuted ? 'opacity-40' : ''}`}
    >
      {/* Avatar */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white mt-px"
        style={{ background: AVATAR_GRAD[msg.authorRole] }}
      >
        {msg.author.charAt(0)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span
            className="text-[11px] font-semibold"
            style={{ color: isStaff ? badge.text : 'var(--ist-text)' }}
          >
            {msg.author}
          </span>
          {isStaff && (
            <span
              className="text-[9px] font-bold px-1.5 py-px rounded-full"
              style={{ background: badge.bg, color: badge.text }}
            >
              {ROLE_LABEL[msg.authorRole]}
            </span>
          )}
          {isMuted && (
            <span className="text-[9px] font-bold px-1.5 py-px rounded-full"
              style={{ background: 'rgba(255,107,122,0.12)', color: '#FF6B7A' }}>
              MUTATO
            </span>
          )}
          {timedOut && (
            <span className="text-[9px] font-bold px-1.5 py-px rounded-full"
              style={{ background: 'rgba(246,200,95,0.12)', color: '#F6C85F' }}>
              TIMEOUT
            </span>
          )}
          <span className="text-[9px] ml-auto flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>
            {formatTs(msg.ts)}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed break-words" style={{ color: 'var(--ist-text-muted)' }}>
          {msg.text}
        </p>
      </div>

      {/* Moderation trigger */}
      {canModerate && !msg.own && (
        <div className="flex-shrink-0 relative self-start mt-0.5">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'var(--ist-w10)', color: 'var(--ist-text-dim)' }}
          >
            <MoreVertical size={11} strokeWidth={2} />
          </button>
          {menuOpen && (
            <ModerationMenu
              msg={msg}
              modState={modState}
              onAction={onAction}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Video Player (always dark) ───────────────────────────────────────────────

function VideoPlayer({
  isLive, accent, accentEnd, viewers, duration,
}: {
  isLive: boolean; accent: string; accentEnd: string; viewers?: number; duration?: string
}) {
  const [playing, setPlaying]   = useState(isLive)
  const [progress, setProgress] = useState(0)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isLive && playing) {
      interval.current = setInterval(() => setProgress(p => Math.min(p + 0.18, 100)), 120)
    } else {
      if (interval.current) clearInterval(interval.current)
    }
    return () => { if (interval.current) clearInterval(interval.current) }
  }, [playing, isLive])

  const durationMin = duration ? parseInt(duration) : 60
  const elapsed     = Math.round((progress / 100) * durationMin * 60)
  const fmt         = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div
      data-inverted="true"
      className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden"
      style={{
        aspectRatio: '16/9',
        background: `radial-gradient(ellipse at 20% 30%, ${accent}25 0%, transparent 55%), #07090f`,
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Play overlay */}
      {!playing && (
        <button onClick={() => setPlaying(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-3 group">
          <div
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accentEnd})`,
              boxShadow: `0 0 40px ${accent}55, 0 8px 28px rgba(0,0,0,0.45)`,
            }}
          >
            <Play size={26} strokeWidth={2} fill="white" color="white" style={{ marginLeft: 3 }} />
          </div>
          {!isLive && (
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
              {progress > 0 ? `Riprendi da ${fmt(elapsed)}` : 'Player · integrazione provider streaming'}
            </p>
          )}
        </button>
      )}

      {/* Pause overlay */}
      {playing && !isLive && (
        <button onClick={() => setPlaying(false)} className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex gap-2">
            <div className="w-2.5 h-9 rounded-full" style={{ background: 'rgba(255,255,255,0.80)' }} />
            <div className="w-2.5 h-9 rounded-full" style={{ background: 'rgba(255,255,255,0.80)' }} />
          </div>
        </button>
      )}

      {/* Badges */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full pointer-events-auto"
            style={{ background: 'rgba(255,80,80,0.90)', color: 'white', backdropFilter: 'blur(8px)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.60)', color: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)' }}>
            REPLAY
          </span>
        )}
        <div className="flex items-center gap-1.5 pointer-events-none">
          {isLive && viewers && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.60)', color: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)' }}>
              <Users size={10} strokeWidth={2} /> {viewers}
            </span>
          )}
          {!isLive && duration && (
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.60)', color: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)' }}>
              {duration}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12"
        style={{ background: 'linear-gradient(transparent,rgba(0,0,0,0.75))' }}
      >
        {!isLive && (
          <>
            <div
              className="h-1.5 rounded-full mb-3 cursor-pointer relative"
              style={{ background: 'rgba(255,255,255,0.18)' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                setProgress(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
              }}
            >
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: accent, minWidth: progress > 0 ? 5 : 0 }}>
                {progress > 0 && (
                  <div className="absolute right-0 top-1/2 w-3.5 h-3.5 rounded-full shadow"
                    style={{ background: 'white', transform: 'translateY(-50%) translateX(50%)' }} />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {fmt(elapsed)} / {duration}
              </span>
              <button
                onClick={() => setPlaying(p => !p)}
                className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {playing ? <><Pause size={12} strokeWidth={2} /> Pausa</> : <><Play size={12} strokeWidth={2} /> Riproduci</>}
              </button>
            </div>
          </>
        )}
        {isLive && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full w-full rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accentEnd})`, opacity: 0.80 }} />
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>IN DIRETTA</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

function ChatPanel({
  messages, input, setInput, onSend,
  canModerate, modState, onAction,
  chatRef, isLive, slowCooldown, accent,
}: {
  messages: LiveChatMessage[]
  input: string
  setInput: (v: string) => void
  onSend: () => void
  canModerate: boolean
  modState: ModState
  onAction: (a: ModeAction, id: string) => void
  chatRef: React.RefObject<HTMLDivElement>
  isLive: boolean
  slowCooldown: number
  accent: string
}) {
  return (
    <div className="flex flex-col h-full" style={{ minHeight: 360 }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--ist-border)',
          background: 'var(--ist-nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {isLive
          ? <span className="w-1.5 h-1.5 rounded-full bg-[#FF5050] animate-pulse flex-shrink-0" />
          : <Radio size={12} strokeWidth={2} style={{ color: 'var(--ist-text-dim)', flexShrink: 0 }} />
        }
        <span className="text-sm font-semibold flex-1" style={{ color: 'var(--ist-text)' }}>
          {isLive ? 'Chat live' : 'Chat replay'}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
          {messages.length} msg
        </span>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto no-scrollbar py-1.5" style={{ minHeight: 0 }}>
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            canModerate={canModerate}
            modState={modState}
            onAction={onAction}
          />
        ))}
      </div>

      {/* Input */}
      {isLive ? (
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--ist-border)' }}>
          {slowCooldown > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-xs"
              style={{ background: 'rgba(246,200,95,0.08)', color: '#F6C85F', border: '1px solid rgba(246,200,95,0.15)' }}
            >
              <Clock size={11} strokeWidth={2} />
              Slow mode — attendi {slowCooldown}s
            </div>
          )}
          <div
            className="flex items-end gap-2 px-3 py-2.5 rounded-2xl"
            style={{ background: 'var(--ist-w8)', border: '1px solid var(--ist-border)' }}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
              placeholder="Scrivi un messaggio..."
              rows={1}
              disabled={slowCooldown > 0}
              className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
              style={{ color: 'var(--ist-text)', maxHeight: 80, scrollbarWidth: 'none' }}
            />
            <button
              onClick={onSend}
              disabled={!input.trim() || slowCooldown > 0}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: input.trim() && slowCooldown === 0 ? accent : 'var(--ist-w12)',
                opacity: !input.trim() || slowCooldown > 0 ? 0.45 : 1,
              }}
            >
              <Send size={13} strokeWidth={2} color="white" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="px-4 py-3 flex-shrink-0 text-center text-[11px]"
          style={{ borderTop: '1px solid var(--ist-border)', color: 'var(--ist-text-dim)' }}
        >
          Chat storica del replay · Solo lettura
        </div>
      )}
    </div>
  )
}

// ─── Sanction tag ─────────────────────────────────────────────────────────────

function SanctionTag({ uid, type, messages, onRemove }: {
  uid: string; type: 'mute' | 'ban' | 'timeout'
  messages: LiveChatMessage[]; onRemove: () => void
}) {
  const name   = messages.find(m => m.authorId === uid)?.author ?? uid
  const styles = {
    mute:    { bg: 'rgba(255,107,122,0.09)', text: '#FF6B7A', label: 'Mutato' },
    ban:     { bg: 'rgba(255,107,122,0.15)', text: '#FF6B7A', label: 'Bannato' },
    timeout: { bg: 'rgba(246,200,95,0.09)',  text: '#F6C85F', label: 'Timeout' },
  }
  const s = styles[type]
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
      style={{ background: s.bg, border: `1px solid ${s.text}20` }}>
      <span className="text-[10px] font-semibold flex-1" style={{ color: s.text }}>
        {name} — {s.label}
      </span>
      <button onClick={onRemove} className="transition-opacity hover:opacity-60" style={{ color: s.text }}>
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentLivePlayer() {
  const { liveId } = useParams<{ liveId: string }>()
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const { setHideBottomNav } = useUI()

  const event = LIVE_EVENTS.find(e => e.id === liveId)

  const [messages, setMessages] = useState<LiveChatMessage[]>(LIVE_CHAT_SEED)
  const [input, setInput]       = useState('')
  const [viewers, setViewers]   = useState(event?.viewers ?? 0)
  const [modState, setModState] = useState<ModState>({ muted: new Set(), banned: new Set(), timeouts: new Map() })
  const [showModePanel, setShowModePanel] = useState(false)
  const [slowMode, setSlowMode]     = useState(0)
  const [slowCooldown, setSlowCooldown] = useState(0)
  const chatRef  = useRef<HTMLDivElement>(null)
  const botIdx   = useRef(0)
  const msgId    = useRef(100)

  const canModerate = user?.role === 'admin' || user?.role === 'coach'
  const isLive      = event?.status === 'live'

  useEffect(() => {
    setHideBottomNav(true)
    return () => setHideBottomNav(false)
  }, [setHideBottomNav])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // Simulated incoming messages
  useEffect(() => {
    if (!isLive) return
    const delays = [3200, 5100, 2800, 7300, 4000, 6200, 3700, 4800]
    let i = 0; let t: ReturnType<typeof setTimeout>
    const schedule = () => {
      t = setTimeout(() => {
        const bot = BOT_MESSAGES[botIdx.current % BOT_MESSAGES.length]
        botIdx.current++
        if (!modState.banned.has(bot.authorId) && !modState.muted.has(bot.authorId)) {
          setMessages(prev => [...prev.slice(-120), { ...bot, id: `auto-${msgId.current++}`, ts: Date.now() }])
        }
        i++; schedule()
      }, delays[i % delays.length])
    }
    schedule()
    const vt = setInterval(() => setViewers(v => Math.max(20, v + Math.floor(Math.random() * 5) - 2)), 8000)
    return () => { clearTimeout(t); clearInterval(vt) }
  }, [isLive, modState])

  // Slow mode countdown
  useEffect(() => {
    if (slowCooldown <= 0) return
    const t = setInterval(() => setSlowCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [slowCooldown])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || !user || slowCooldown > 0) return
    setMessages(prev => [...prev.slice(-120), {
      id: `own-${msgId.current++}`,
      authorId: 'u-marco',
      author: user.name,
      authorRole: user.role as LiveRole,
      text, ts: Date.now(), own: true,
    }])
    setInput('')
    if (slowMode > 0) setSlowCooldown(slowMode)
  }, [input, user, slowMode, slowCooldown])

  const handleModAction = useCallback((action: ModeAction, authorId: string) => {
    setModState(prev => {
      const muted = new Set(prev.muted), banned = new Set(prev.banned), timeouts = new Map(prev.timeouts)
      switch (action) {
        case 'mute':      muted.has(authorId)  ? muted.delete(authorId)  : muted.add(authorId);   break
        case 'ban':       banned.has(authorId) ? banned.delete(authorId) : (banned.add(authorId), muted.delete(authorId), timeouts.delete(authorId)); break
        case 'timeout5':  timeouts.has(authorId) ? timeouts.delete(authorId) : timeouts.set(authorId, Date.now() + 300000);  break
        case 'timeout15': timeouts.set(authorId, Date.now() + 900000);  break
        case 'timeout60': timeouts.set(authorId, Date.now() + 3600000); break
      }
      return { muted, banned, timeouts }
    })
  }, [])

  if (!event) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>Evento non trovato.</p>
        <button onClick={() => navigate('/student/live')} className="text-sm font-medium" style={{ color: 'var(--ist-accent-text)' }}>
          ← Live & Replay
        </button>
      </div>
    )
  }

  const totalActions = modState.muted.size + modState.banned.size + modState.timeouts.size

  return (
    <div className="flex flex-col lg:flex-row" style={{ minHeight: '100vh' }}>

      {/* ── LEFT / VIDEO + INFO ── */}
      <div className="flex-1 min-w-0 p-4 lg:p-6 lg:pr-3 flex flex-col gap-5">

        {/* Back */}
        <button
          onClick={() => navigate('/student/live')}
          className="flex items-center gap-1.5 text-sm font-medium w-fit transition-opacity hover:opacity-70"
          style={{ color: 'var(--ist-text-muted)' }}
        >
          <ChevronLeft size={15} strokeWidth={2.5} />
          Live & Replay
        </button>

        {/* Player */}
        <VideoPlayer
          isLive={isLive}
          accent={event.accent}
          accentEnd={event.accentEnd}
          viewers={viewers}
          duration={event.duration}
        />

        {/* Info */}
        <div>
          <div className="flex items-start gap-3 flex-wrap mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold leading-tight mb-1" style={{ color: 'var(--ist-text)' }}>
                {event.title}
              </h1>
              <p className="text-sm" style={{ color: 'var(--ist-text-muted)' }}>
                {event.host} · {ROLE_LABEL[event.hostRole] || event.hostRole}
                {event.date && <> · <span style={{ color: 'var(--ist-text-dim)' }}>{event.date}</span></>}
              </p>
            </div>
            {isLive && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,80,80,0.10)', color: '#FF5050', border: '1px solid rgba(255,80,80,0.20)' }}
              >
                <Users size={12} strokeWidth={2} />
                {viewers} spettatori
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            {event.description}
          </p>
        </div>

        {/* Moderation panel — admin/coach only */}
        {canModerate && isLive && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--ist-card-bg)',
              border: '1px solid rgba(246,200,95,0.22)',
              boxShadow: 'var(--ist-card-shadow)',
            }}
          >
            <button
              onClick={() => setShowModePanel(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <Shield size={14} strokeWidth={2} style={{ color: '#F6C85F' }} />
              <span className="text-sm font-semibold flex-1 text-left" style={{ color: '#F6C85F' }}>
                Moderazione
              </span>
              {totalActions > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,107,122,0.12)', color: '#FF6B7A' }}
                >
                  {totalActions} attive
                </span>
              )}
              <ChevronDown
                size={14}
                strokeWidth={2}
                style={{
                  color: '#F6C85F',
                  transform: showModePanel ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {showModePanel && (
              <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(246,200,95,0.12)' }}>
                {/* Slow mode */}
                <div className="flex items-center gap-2 pt-3 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: 'var(--ist-text-muted)' }}>Slow mode:</span>
                  {[0, 5, 15, 30, 60].map(sec => (
                    <button
                      key={sec}
                      onClick={() => setSlowMode(sec)}
                      className="text-xs px-3 py-1 rounded-full transition-all font-medium"
                      style={slowMode === sec ? {
                        background: 'rgba(246,200,95,0.15)',
                        color: '#F6C85F',
                        border: '1px solid rgba(246,200,95,0.30)',
                      } : {
                        background: 'var(--ist-w6)',
                        color: 'var(--ist-text-muted)',
                        border: '1px solid var(--ist-border)',
                      }}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>

                {/* Active sanctions */}
                {totalActions > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ist-text-dim)' }}>
                      Sanzioni attive
                    </p>
                    {Array.from(modState.muted).map(uid => (
                      <SanctionTag key={uid} uid={uid} type="mute" messages={messages} onRemove={() => handleModAction('mute', uid)} />
                    ))}
                    {Array.from(modState.timeouts.keys()).map(uid => (
                      <SanctionTag key={uid} uid={uid} type="timeout" messages={messages} onRemove={() => handleModAction('timeout5', uid)} />
                    ))}
                    {Array.from(modState.banned).map(uid => (
                      <SanctionTag key={uid} uid={uid} type="ban" messages={messages} onRemove={() => handleModAction('ban', uid)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile chat */}
        <div
          className="lg:hidden rounded-3xl overflow-hidden"
          style={{
            background: 'var(--ist-card-bg)',
            border: '1px solid var(--ist-border)',
            boxShadow: 'var(--ist-card-shadow)',
          }}
        >
          <ChatPanel
            messages={messages} input={input} setInput={setInput} onSend={sendMessage}
            canModerate={canModerate} modState={modState} onAction={handleModAction}
            chatRef={chatRef} isLive={isLive} slowCooldown={slowCooldown} accent={event.accent}
          />
        </div>
      </div>

      {/* ── RIGHT / CHAT sidebar (desktop) ── */}
      <div
        className="hidden lg:flex flex-col w-[320px] xl:w-[360px] flex-shrink-0"
        style={{
          borderLeft: '1px solid var(--ist-border)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: 'var(--ist-nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <ChatPanel
          messages={messages} input={input} setInput={setInput} onSend={sendMessage}
          canModerate={canModerate} modState={modState} onAction={handleModAction}
          chatRef={chatRef} isLive={isLive} slowCooldown={slowCooldown} accent={event.accent}
        />
      </div>
    </div>
  )
}
