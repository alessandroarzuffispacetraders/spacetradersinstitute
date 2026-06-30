import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Send, Radio, Calendar, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import VimeoPlayer from '../../components/ui/VimeoPlayer'
import { useLiveEvent, liveDateLabel, LiveRole } from '../../lib/live'
import { useChatMessages, DbMessage } from '../../lib/chat'
import { UserRole } from '../../types'

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

function formatTs(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

// ─── Chat bubble (messaggio reale) ─────────────────────────────────────────────

function ChatBubble({ msg, own }: { msg: DbMessage; own: boolean }) {
  const role = (msg.author_role ?? 'student') as LiveRole
  const isStaff = role !== 'student'
  const badge = ROLE_BADGE[role]

  return (
    <div className="px-4 py-2.5 flex gap-2.5 group transition-colors hover:bg-black/[0.03]">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white mt-px"
        style={{ background: AVATAR_GRAD[role] }}
      >
        {msg.author_name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span
            className="text-[11px] font-semibold"
            style={{ color: own ? 'var(--ist-accent-text)' : isStaff ? badge.text : 'var(--ist-text)' }}
          >
            {own ? 'Tu' : msg.author_name}
          </span>
          {isStaff && (
            <span
              className="text-[9px] font-bold px-1.5 py-px rounded-full"
              style={{ background: badge.bg, color: badge.text }}
            >
              {ROLE_LABEL[role]}
            </span>
          )}
          <span className="text-[9px] ml-auto flex-shrink-0" style={{ color: 'var(--ist-text-dim)' }}>
            {formatTs(msg.created_at)}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed break-words" style={{ color: 'var(--ist-text-muted)' }}>
          {msg.content}
        </p>
      </div>
    </div>
  )
}

// ─── Chat panel (reale, con scroll proprio) ────────────────────────────────────

function LiveChatPanel({
  messages, loading, userId, input, setInput, onSend, isLive,
}: {
  messages: DbMessage[]
  loading: boolean
  userId: string
  input: string
  setInput: (v: string) => void
  onSend: () => void
  isLive: boolean
}) {
  const chatRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

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
          {isLive ? 'Chat live' : 'Chat'}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
          {messages.length} msg
        </span>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto no-scrollbar py-1.5" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[11px] py-10 px-4" style={{ color: 'var(--ist-text-dim)' }}>
            Ancora nessun messaggio. Scrivi tu il primo!
          </p>
        ) : (
          messages.map(msg => (
            <ChatBubble key={msg.id} msg={msg} own={msg.user_id === userId} />
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--ist-border)' }}>
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
            className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed no-scrollbar"
            style={{ color: 'var(--ist-text)', maxHeight: 80 }}
          />
          <button
            onClick={onSend}
            disabled={!input.trim()}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-45"
            style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
          >
            <Send size={13} strokeWidth={2} color="white" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stage (live/upcoming = Zoom · replay = Vimeo) ─────────────────────────────

function LiveStage({ event }: { event: NonNullable<ReturnType<typeof useLiveEvent>['event']> }) {
  if (event.status === 'replay') {
    return <VimeoPlayer vimeoId={event.replayVimeoId} accent={event.accent} />
  }

  const isLive = event.status === 'live'
  return (
    <div
      data-inverted="true"
      className="relative w-full rounded-2xl lg:rounded-3xl overflow-hidden flex flex-col items-center justify-center text-center gap-4 px-6"
      style={{
        aspectRatio: '16/9',
        background: `radial-gradient(ellipse at 20% 30%, ${event.accent}28 0%, transparent 55%), #07090f`,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
      }}
    >
      {isLive ? (
        <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(255,80,80,0.90)', color: 'white' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE ORA
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
          <Calendar size={11} strokeWidth={2} />
          {liveDateLabel(event)}
        </span>
      )}

      <p className="text-sm max-w-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {isLive
          ? 'La sessione è in diretta su Zoom. Entra e partecipa anche dalla chat qui sotto.'
          : 'La live non è ancora iniziata. Potrai entrare su Zoom quando sarà in diretta.'}
      </p>

      {event.zoomUrl ? (
        <a
          href={event.zoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-full transition-transform hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${event.accent}, ${event.accentEnd})`,
            color: 'white',
            boxShadow: `0 6px 22px ${event.accent}55`,
          }}
        >
          <ExternalLink size={15} strokeWidth={2.5} />
          Entra nella live (Zoom)
        </a>
      ) : (
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Link Zoom non ancora disponibile
        </span>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentLivePlayer() {
  const { liveId } = useParams<{ liveId: string }>()
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const { setHideBottomNav } = useUI()

  const { event, loading } = useLiveEvent(liveId)
  const channelId = liveId ? `live_${liveId}` : null
  const userId = user?.id ?? ''
  const { messages, loading: chatLoading, sendMessage } = useChatMessages(channelId, userId)
  const [input, setInput] = useState('')

  const isLive = event?.status === 'live'

  useEffect(() => {
    setHideBottomNav(true)
    return () => setHideBottomNav(false)
  }, [setHideBottomNav])

  const onSend = () => {
    const text = input.trim()
    if (!text || !user) return
    sendMessage(text, user.name, user.role as UserRole)
    setInput('')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: 'var(--ist-text-muted)' }} />
      </div>
    )
  }

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

  return (
    <div className="flex flex-col lg:flex-row" style={{ minHeight: '100vh' }}>

      {/* ── LEFT / STAGE + INFO ── */}
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

        {/* Stage */}
        <LiveStage event={event} />

        {/* Info */}
        <div>
          <h1 className="text-lg font-bold leading-tight mb-1" style={{ color: 'var(--ist-text)' }}>
            {event.title}
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--ist-text-muted)' }}>
            {event.host} · {ROLE_LABEL[event.hostRole] || event.hostRole}
            {' · '}<span style={{ color: 'var(--ist-text-dim)' }}>{liveDateLabel(event)}</span>
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ist-text-muted)' }}>
            {event.description}
          </p>
        </div>

        {/* Mobile chat */}
        <div
          className="lg:hidden rounded-3xl overflow-hidden"
          style={{
            background: 'var(--ist-card-bg)',
            border: '1px solid var(--ist-border)',
            boxShadow: 'var(--ist-card-shadow)',
          }}
        >
          <LiveChatPanel
            messages={messages} loading={chatLoading} userId={userId}
            input={input} setInput={setInput} onSend={onSend} isLive={isLive}
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
        <LiveChatPanel
          messages={messages} loading={chatLoading} userId={userId}
          input={input} setInput={setInput} onSend={onSend} isLive={isLive}
        />
      </div>
    </div>
  )
}
