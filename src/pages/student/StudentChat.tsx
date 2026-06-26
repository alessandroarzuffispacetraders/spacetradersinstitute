import { useState, useRef, useEffect } from 'react'
import {
  Hash, Megaphone, ChevronDown, ChevronRight,
  Send, ArrowLeft, Search, Pin, Check, Users, MessageCircle, UsersRound,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import {
  CHANNELS, MESSAGES, BACHECA_POSTS,
  Channel, ChatMessage, BachecaPost, MemberRole,
} from '../../data/chatData'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Oggi'
  if (d.toDateString() === yesterday.toDateString()) return 'Ieri'
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  mental_coach: 'Mental Coach',
  student: 'Studente',
}

const ROLE_COLOR: Record<MemberRole, string> = {
  admin: 'rgba(90,154,177,0.18)',
  coach: 'rgba(40,102,128,0.20)',
  mental_coach: 'rgba(139,92,246,0.18)',
  student: 'var(--ist-w10)',
}
const ROLE_TEXT: Record<MemberRole, string> = {
  admin: 'var(--ist-accent-text)',
  coach: 'var(--ist-accent-text)',
  mental_coach: '#8b5cf6',
  student: 'var(--ist-text-muted)',
}

const DM_AVATAR_GRADIENT: Record<MemberRole, string> = {
  admin: 'linear-gradient(135deg, #5A9AB1, #286680)',
  coach: 'linear-gradient(135deg, #5A9AB1, #286680)',
  mental_coach: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
  student: 'linear-gradient(135deg, #374151, #6b7280)',
}

// ─── channel icon ────────────────────────────────────────────────────────────

function ChannelIcon({ type, size = 14 }: { type: 'chat' | 'bacheca'; size?: number }) {
  if (type === 'bacheca') return <Megaphone size={size} strokeWidth={2} />
  return <Hash size={size} strokeWidth={2} />
}

// ─── unread badge ─────────────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-auto text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)' }}
    >
      {count}
    </span>
  )
}

// ─── channel row (groups) ────────────────────────────────────────────────────

function ChannelRow({ channel, active, onSelect }: { channel: Channel; active: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(channel.id)}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-all duration-100"
      style={active
        ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
        : {
          color: (channel.unread ?? 0) > 0 ? 'var(--ist-text)' : 'var(--ist-text-muted)',
        }
      }
    >
      <span className="flex-shrink-0 opacity-70" style={{ color: active ? 'var(--ist-accent-text)' : 'inherit' }}>
        <ChannelIcon type={channel.type} size={14} />
      </span>
      <span className="text-sm truncate flex-1 font-medium">
        {channel.name}
      </span>
      {(channel.unread ?? 0) > 0 && !active && (
        <UnreadBadge count={channel.unread!} />
      )}
    </button>
  )
}

// ─── DM row (directs) ────────────────────────────────────────────────────────

function DmRow({ channel, active, onSelect }: { channel: Channel; active: boolean; onSelect: (id: string) => void }) {
  const dm = channel.dmWith!
  return (
    <button
      onClick={() => onSelect(channel.id)}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all duration-100"
      style={active ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' } : {}}
    >
      {/* Avatar with online dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: DM_AVATAR_GRADIENT[dm.role], color: 'white' }}
        >
          {dm.name.charAt(0)}
        </div>
        <div
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background: dm.online ? '#46D39A' : 'var(--ist-w12)',
            borderColor: 'var(--ist-nav-bg)',
          }}
        />
      </div>

      {/* Name and role */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: active ? 'var(--ist-accent-text)' : 'var(--ist-text)' }}>
          {dm.name}
        </p>
        <p className="text-[11px]" style={{ color: ROLE_TEXT[dm.role] }}>
          {ROLE_LABEL[dm.role]}
        </p>
      </div>

      {(channel.unread ?? 0) > 0 && !active && (
        <UnreadBadge count={channel.unread!} />
      )}
    </button>
  )
}

// ─── channel sidebar ──────────────────────────────────────────────────────────

interface SidebarProps {
  activeChannel: string
  onSelect: (id: string) => void
  userRole: MemberRole
}

function ChannelSidebar({ activeChannel, onSelect, userRole }: SidebarProps) {
  const [tab, setTab] = useState<'groups' | 'direct'>('groups')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const allVisible = CHANNELS.filter(ch => ch.roles.includes(userRole))
  const groupChannels = allVisible.filter(ch => ch.channelKind === 'group')
  const directChannels = allVisible.filter(ch => ch.channelKind === 'direct')

  const activeChannels = tab === 'groups' ? groupChannels : directChannels

  // Group by category (only for groups tab)
  const categories: Record<string, Channel[]> = {}
  for (const ch of groupChannels) {
    if (!categories[ch.category]) categories[ch.category] = []
    categories[ch.category].push(ch)
  }

  const filtered = search.trim()
    ? activeChannels.filter(ch => ch.name.toLowerCase().includes(search.toLowerCase()))
    : null

  const toggleCategory = (cat: string) => {
    setCollapsed(p => ({ ...p, [cat]: !p[cat] }))
  }

  const groupUnread = groupChannels.reduce((n, ch) => n + (ch.unread ?? 0), 0)
  const directUnread = directChannels.reduce((n, ch) => n + (ch.unread ?? 0), 0)

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--ist-nav-bg)',
        borderRight: '1px solid var(--ist-nav-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--ist-w8)' }}
      >
        <span className="text-sm font-bold" style={{ color: 'var(--ist-text)' }}>
          IST Community
        </span>
        <button
          className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'var(--ist-w6)', color: 'var(--ist-text-muted)' }}
          onClick={() => document.getElementById('channel-search')?.focus()}
        >
          <Search size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 px-2 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--ist-w8)' }}
      >
        <button
          onClick={() => { setTab('groups'); setSearch('') }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={tab === 'groups'
            ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
            : { color: 'var(--ist-text-muted)' }
          }
        >
          <UsersRound size={13} strokeWidth={2} />
          Gruppi
          {groupUnread > 0 && tab !== 'groups' && (
            <span
              className="text-[10px] font-bold text-white px-1 rounded-full min-w-[16px] text-center leading-[16px]"
              style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
            >
              {groupUnread}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('direct'); setSearch('') }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={tab === 'direct'
            ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
            : { color: 'var(--ist-text-muted)' }
          }
        >
          <MessageCircle size={13} strokeWidth={2} />
          Privati
          {directUnread > 0 && tab !== 'direct' && (
            <span
              className="text-[10px] font-bold text-white px-1 rounded-full min-w-[16px] text-center leading-[16px]"
              style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
            >
              {directUnread}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
        <input
          id="channel-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'groups' ? 'Cerca canale...' : 'Cerca chat...'}
          className="w-full px-3 py-1.5 text-xs rounded-xl focus:outline-none"
          style={{
            background: 'var(--ist-input-surface)',
            border: '1px solid var(--ist-input-border)',
            color: 'var(--ist-text)',
          }}
        />
      </div>

      {/* Channel / DM list */}
      <div className="flex-1 overflow-y-auto py-1 pb-24 lg:pb-1 no-scrollbar">
        {/* ── DIRECT TAB ── */}
        {tab === 'direct' && (
          <div className="px-1 py-1">
            {(filtered ?? directChannels).length === 0 ? (
              <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--ist-text-dim)' }}>
                Nessuna chat privata
              </p>
            ) : (
              (filtered ?? directChannels).map(ch => (
                <DmRow
                  key={ch.id}
                  channel={ch}
                  active={activeChannel === ch.id}
                  onSelect={onSelect}
                />
              ))
            )}
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (
          filtered ? (
            <div className="px-1 py-1">
              {filtered.map(ch => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  active={activeChannel === ch.id}
                  onSelect={onSelect}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--ist-text-dim)' }}>
                  Nessun canale trovato
                </p>
              )}
            </div>
          ) : (
            Object.entries(categories).map(([cat, channels]) => {
              const catIcon = channels[0]?.categoryIcon ?? ''
              const isCollapsed = collapsed[cat]
              return (
                <div key={cat} className="mb-1">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-1 w-full px-2 py-1 rounded-lg transition-colors text-left"
                    style={{ color: 'var(--ist-text-muted)' }}
                  >
                    {isCollapsed
                      ? <ChevronRight size={11} strokeWidth={2.5} className="flex-shrink-0" />
                      : <ChevronDown size={11} strokeWidth={2.5} className="flex-shrink-0" />
                    }
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                      {catIcon} {cat}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="px-1">
                      {channels.map(ch => (
                        <ChannelRow
                          key={ch.id}
                          channel={ch}
                          active={activeChannel === ch.id}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )
        )}
      </div>
    </div>
  )
}

// ─── chat area ────────────────────────────────────────────────────────────────

interface ChatAreaProps {
  channel: Channel
  userRole: MemberRole
  userName: string
  onBack?: () => void
  isMobile?: boolean
}

function ChatArea({ channel, userRole, userName, onBack, isMobile }: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(MESSAGES[channel.id] ?? [])
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessages(MESSAGES[channel.id] ?? [])
    setInput('')
  }, [channel.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const canPost = channel.canPost.includes(userRole)

  const sendMessage = () => {
    const text = input.trim()
    if (!text || !canPost) return
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      author: userName,
      authorRole: userRole,
      text,
      timestamp: new Date().toISOString(),
      own: true,
    }
    setMessages(prev => [...prev, msg])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  interface MessageGroup {
    author: string
    authorRole: MemberRole
    own: boolean
    messages: ChatMessage[]
    firstTimestamp: string
  }

  const groups: MessageGroup[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const own = !!msg.own
    const last = groups[groups.length - 1]
    if (
      last &&
      last.author === msg.author &&
      last.own === own &&
      sameDay(last.firstTimestamp, msg.timestamp)
    ) {
      last.messages.push(msg)
    } else {
      groups.push({
        author: msg.author,
        authorRole: msg.authorRole,
        own,
        messages: [msg],
        firstTimestamp: msg.timestamp,
      })
    }
  }

  const isDirect = channel.channelKind === 'direct'
  const dmPartner = channel.dmWith

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--ist-w8)',
          background: 'var(--ist-nav-bg)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {isMobile && onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-text)' }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        )}

        {isDirect && dmPartner ? (
          <div className="relative flex-shrink-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: DM_AVATAR_GRADIENT[dmPartner.role], color: 'white' }}
            >
              {dmPartner.name.charAt(0)}
            </div>
            <div
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: dmPartner.online ? '#46D39A' : 'var(--ist-w12)',
                borderColor: 'var(--ist-nav-bg)',
              }}
            />
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-accent-text)' }}
          >
            <ChannelIcon type={channel.type} size={15} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--ist-text)' }}>
              {channel.name}
            </span>
            {isDirect && dmPartner && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: ROLE_COLOR[dmPartner.role], color: ROLE_TEXT[dmPartner.role] }}
              >
                {ROLE_LABEL[dmPartner.role]}
              </span>
            )}
          </div>
          {isDirect && dmPartner ? (
            <p className="text-[11px]" style={{ color: dmPartner.online ? '#46D39A' : 'var(--ist-text-dim)' }}>
              {dmPartner.online ? 'Online' : 'Offline'}
            </p>
          ) : channel.description ? (
            <p className="text-[11px] truncate" style={{ color: 'var(--ist-text-muted)' }}>
              {channel.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 no-scrollbar">
        {groups.map((group, gi) => {
          const prevGroup = groups[gi - 1]
          const showDateSep = !prevGroup || !sameDay(prevGroup.firstTimestamp, group.firstTimestamp)

          return (
            <div key={`group-${gi}`}>
              {showDateSep && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--ist-w8)' }} />
                  <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--ist-text-dim)' }}>
                    {formatDate(group.firstTimestamp)}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--ist-w8)' }} />
                </div>
              )}

              <div className={`flex gap-2.5 mt-2 ${group.own ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
                  style={group.own
                    ? { background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }
                    : { background: DM_AVATAR_GRADIENT[group.authorRole] ?? 'var(--ist-avatar-other-bg)', color: 'white' }
                  }
                >
                  {group.author.charAt(0)}
                </div>

                {/* Messages column */}
                <div className={`flex flex-col gap-0.5 min-w-0 max-w-[72%] ${group.own ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-baseline gap-2 ${group.own ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-semibold" style={{ color: group.own ? 'var(--ist-bubble-own-name)' : 'var(--ist-text)' }}>
                      {group.own ? 'Tu' : group.author}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
                      {formatTime(group.firstTimestamp)}
                    </span>
                    {!group.own && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: ROLE_COLOR[group.authorRole], color: ROLE_TEXT[group.authorRole] }}
                      >
                        {ROLE_LABEL[group.authorRole]}
                      </span>
                    )}
                  </div>

                  {group.messages.map((msg, mi) => (
                    <div
                      key={msg.id}
                      className="px-3.5 py-2 text-sm leading-relaxed"
                      style={group.own
                        ? {
                          background: 'var(--ist-bubble-own-bg)',
                          color: 'var(--ist-bubble-own-text)',
                          border: '1px solid var(--ist-bubble-own-border)',
                          borderRadius: mi === 0 ? '18px 18px 4px 18px' : '18px 4px 4px 18px',
                          ...(mi === group.messages.length - 1 ? { borderRadius: '18px 4px 18px 18px' } : {}),
                        }
                        : {
                          background: 'var(--ist-bubble-other-bg)',
                          color: 'var(--ist-text)',
                          border: '1px solid var(--ist-bubble-other-border)',
                          borderRadius: mi === 0 ? '18px 18px 18px 4px' : '4px 18px 18px 4px',
                          ...(mi === group.messages.length - 1 ? { borderRadius: '4px 18px 18px 18px' } : {}),
                        }
                      }
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      {canPost ? (
        <div
          className="flex items-end gap-2 px-3 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--ist-w8)', background: 'var(--ist-nav-bg)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            placeholder={isDirect && dmPartner ? `Scrivi a ${dmPartner.name}...` : `Scrivi in #${channel.name}...`}
            rows={1}
            className="flex-1 resize-none px-3.5 py-2.5 text-sm focus:outline-none no-scrollbar"
            style={{
              background: 'var(--ist-input-surface)',
              border: '1px solid var(--ist-input-border)',
              borderRadius: 16,
              color: 'var(--ist-text)',
              maxHeight: 120,
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)',
              boxShadow: input.trim() ? '0 4px 16px rgba(40,102,128,0.36)' : 'none',
            }}
          >
            <Send size={15} strokeWidth={2} className="text-white" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--ist-w8)', background: 'var(--ist-nav-bg)' }}
        >
          <span className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>
            🔒 Solo lettura — non puoi scrivere in questo canale
          </span>
        </div>
      )}
    </div>
  )
}

// ─── bacheca post card ────────────────────────────────────────────────────────

function BachecaPostCard({
  post,
  onReact,
  onRead,
}: {
  post: BachecaPost
  onReact: (postId: string, emoji: string) => void
  onRead: (postId: string) => void
}) {
  return (
    <div
      className="rounded-3xl p-4 flex flex-col gap-3"
      style={{
        background: 'var(--ist-card-bg)',
        border: '1px solid var(--ist-border)',
        boxShadow: 'var(--ist-card-shadow)',
      }}
    >
      {post.pinned && (
        <div className="flex items-center gap-1.5">
          <Pin size={11} strokeWidth={2.5} style={{ color: 'var(--ist-accent-text)' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ist-accent-text)' }}>
            In evidenza
          </span>
        </div>
      )}

      {post.tag && (
        <span
          className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(124,187,208,0.15)', color: 'var(--ist-accent-text)' }}
        >
          {post.tag}
        </span>
      )}

      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }}
        >
          {post.author.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: 'var(--ist-text)' }}>
              {post.author}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: ROLE_COLOR[post.authorRole], color: ROLE_TEXT[post.authorRole] }}
            >
              {ROLE_LABEL[post.authorRole]}
            </span>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>
            {formatDate(post.timestamp)} alle {formatTime(post.timestamp)}
          </span>
        </div>
      </div>

      {post.title && (
        <h3 className="text-base font-bold leading-snug" style={{ color: 'var(--ist-text)' }}>
          {post.title}
        </h3>
      )}

      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--ist-text-muted)' }}>
        {post.content}
      </p>

      {post.attachmentType === 'event' && post.attachmentData && (
        <div
          className="rounded-2xl p-3 flex items-start gap-3"
          style={{ background: 'rgba(124,187,208,0.10)', border: '1px solid rgba(124,187,208,0.20)' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(124,187,208,0.20)' }}
          >
            <span className="text-sm">📅</span>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--ist-accent-text)' }}>
              {post.attachmentData.label}
            </p>
            {post.attachmentData.date && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ist-text-muted)' }}>
                {post.attachmentData.date}
              </p>
            )}
            {post.attachmentData.url && (
              <a
                href={post.attachmentData.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] mt-1 inline-block underline"
                style={{ color: 'var(--ist-accent-text)' }}
              >
                Unisciti →
              </a>
            )}
          </div>
        </div>
      )}
      {post.attachmentType === 'link' && post.attachmentData && (
        <div
          className="rounded-2xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(124,187,208,0.10)', border: '1px solid rgba(124,187,208,0.20)' }}
        >
          <span className="text-base">🔗</span>
          <a
            href={post.attachmentData.url}
            className="text-xs font-semibold underline"
            style={{ color: 'var(--ist-accent-text)' }}
          >
            {post.attachmentData.label}
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {post.reactions.map(r => (
          <button
            key={r.emoji}
            onClick={() => onReact(post.id, r.emoji)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all active:scale-95"
            style={r.reacted
              ? { background: 'rgba(124,187,208,0.20)', border: '1px solid rgba(124,187,208,0.40)' }
              : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w9)' }
            }
          >
            <span>{r.emoji}</span>
            <span style={{ color: r.reacted ? 'var(--ist-accent-text)' : 'var(--ist-text-muted)' }}>{r.count}</span>
          </button>
        ))}
      </div>

      <div
        className="flex items-center justify-between pt-2"
        style={{ borderTop: '1px solid var(--ist-w8)' }}
      >
        <button
          onClick={() => onRead(post.id)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-all active:scale-95"
          style={post.readByMe
            ? { background: 'rgba(70,211,154,0.15)', color: '#46D39A', border: '1px solid rgba(70,211,154,0.25)' }
            : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w9)' }
          }
        >
          <Check size={12} strokeWidth={2.5} />
          {post.readByMe ? 'Letto' : 'Segna come letto'}
        </button>

        <div className="flex items-center gap-1" style={{ color: 'var(--ist-text-dim)' }}>
          <Users size={11} strokeWidth={2} />
          <span className="text-[11px]">{post.readCount}/{post.totalReaders} lettori</span>
        </div>
      </div>
    </div>
  )
}

// ─── bacheca area ─────────────────────────────────────────────────────────────

function BachecaArea({
  channel,
  userRole,
  onBack,
  isMobile,
}: {
  channel: Channel
  userRole: MemberRole
  onBack?: () => void
  isMobile?: boolean
}) {
  const [posts, setPosts] = useState<BachecaPost[]>(BACHECA_POSTS[channel.id] ?? [])

  useEffect(() => {
    setPosts(BACHECA_POSTS[channel.id] ?? [])
  }, [channel.id])

  const handleReact = (postId: string, emoji: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id !== postId
          ? p
          : {
            ...p,
            reactions: p.reactions.map(r =>
              r.emoji !== emoji
                ? r
                : { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
            ),
          }
      )
    )
  }

  const handleRead = (postId: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id !== postId
          ? p
          : {
            ...p,
            readByMe: !p.readByMe,
            readCount: p.readByMe ? p.readCount - 1 : p.readCount + 1,
          }
      )
    )
  }

  const sorted = [...posts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--ist-w8)',
          background: 'var(--ist-nav-bg)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {isMobile && onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: 'var(--ist-w8)', color: 'var(--ist-text)' }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        )}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(124,187,208,0.15)', color: 'var(--ist-accent-text)' }}
        >
          <Megaphone size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>
              {channel.name}
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,187,208,0.15)', color: 'var(--ist-accent-text)' }}
            >
              Bacheca
            </span>
          </div>
          {channel.description && (
            <p className="text-[11px] truncate" style={{ color: 'var(--ist-text-muted)' }}>
              {channel.description}
            </p>
          )}
        </div>
        {channel.canPost.includes(userRole) && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1, #286680)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(40,102,128,0.30)',
            }}
          >
            + Pubblica
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Megaphone size={32} style={{ color: 'var(--ist-text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
              Nessun post ancora
            </p>
          </div>
        ) : (
          sorted.map(post => (
            <BachecaPostCard
              key={post.id}
              post={post}
              onReact={handleReact}
              onRead={handleRead}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StudentChat() {
  const { user } = useAuth()
  const { setHideBottomNav } = useUI()
  const userRole = (user?.role ?? 'student') as MemberRole
  const userName = user?.name ?? 'Marco Rossi'

  const visibleChannels = CHANNELS.filter(ch => ch.roles.includes(userRole))
  const firstGroup = visibleChannels.find(ch => ch.channelKind === 'group')
  const [activeChannelId, setActiveChannelId] = useState(firstGroup?.id ?? visibleChannels[0]?.id ?? 'generale')

  const [mobileView, setMobileView] = useState<'channels' | 'chat'>('channels')

  useEffect(() => {
    setHideBottomNav(mobileView === 'chat')
    return () => setHideBottomNav(false)
  }, [mobileView, setHideBottomNav])

  const activeChannel = CHANNELS.find(ch => ch.id === activeChannelId) ?? visibleChannels[0]

  const selectChannel = (id: string) => {
    setActiveChannelId(id)
    setMobileView('chat')
  }

  const goBack = () => {
    setMobileView('channels')
  }

  return (
    <div
      className="flex overflow-hidden fixed inset-0 z-10"
      style={{ background: 'var(--ist-nav-bg)' }}
    >
      {/* Sidebar */}
      <div
        className={`
          flex-shrink-0
          ${mobileView === 'channels' ? 'flex' : 'hidden'}
          lg:flex
          w-full lg:w-[240px] lg:ml-[108px]
          flex-col
          overflow-hidden
        `}
        style={{ height: '100%' }}
      >
        <ChannelSidebar
          activeChannel={activeChannelId}
          onSelect={selectChannel}
          userRole={userRole}
        />
      </div>

      {/* Chat / Bacheca area */}
      <div
        className={`
          flex-1 min-w-0 flex flex-col overflow-hidden
          ${mobileView === 'chat' ? 'flex' : 'hidden'}
          lg:flex
        `}
        style={{ height: '100%' }}
      >
        {activeChannel?.type === 'bacheca' ? (
          <BachecaArea
            channel={activeChannel}
            userRole={userRole}
            onBack={goBack}
            isMobile={mobileView === 'chat'}
          />
        ) : (
          <ChatArea
            key={activeChannelId}
            channel={activeChannel}
            userRole={userRole}
            userName={userName}
            onBack={goBack}
            isMobile={mobileView === 'chat'}
          />
        )}
      </div>

      {!activeChannel && (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
            Seleziona un canale
          </p>
        </div>
      )}
    </div>
  )
}
