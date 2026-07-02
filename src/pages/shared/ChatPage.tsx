import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Hash, Megaphone, ChevronDown, ChevronRight,
  Send, ArrowLeft, Search, Pin, Check, Users, MessageCircle, UsersRound, Loader2, X,
  Edit2, Trash2, SmilePlus, ImagePlus,
} from 'lucide-react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import {
  BACHECA_POSTS,
  Channel, BachecaPost, MemberRole,
} from '../../data/chatData'
import {
  useChatMessages, useDmUsers, useUnreadCounts, useTypingIndicator,
  useAuthorAvatars, dmChannelId, DmUser, DbMessage,
} from '../../lib/chat'
import { useChannels } from '../../lib/channels'
import { uploadChatImage } from '../../lib/storage'
import UserAvatar from '../../components/ui/UserAvatar'

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

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎯']

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

// ─── user card popup ─────────────────────────────────────────────────────────

interface UserCardProps {
  userId: string
  name: string
  role: MemberRole
  avatar?: { avatarUrl?: string; avatarPreset?: string }
  canDm: boolean
  onStartDm: () => void
  onClose: () => void
}

function UserCard({ name, role, avatar, canDm, onStartDm, onClose }: UserCardProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-[300px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden"
        style={{
          background: 'var(--ist-nav-bg)',
          border: '1px solid var(--ist-nav-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
        >
          <X size={13} strokeWidth={2.5} />
        </button>

        {/* Identità */}
        <div className="flex flex-col items-center text-center px-5 pt-7 pb-5">
          {avatar?.avatarUrl || avatar?.avatarPreset ? (
            <div className="mb-3">
              <UserAvatar user={{ name, avatarUrl: avatar.avatarUrl, avatarPreset: avatar.avatarPreset }} size={64} />
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-3"
              style={{ background: DM_AVATAR_GRADIENT[role] ?? DM_AVATAR_GRADIENT.student, color: 'white' }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="w-full text-base font-semibold leading-snug break-words" style={{ color: 'var(--ist-text)' }}>
            {name}
          </p>
          <span
            className="mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: ROLE_COLOR[role], color: ROLE_TEXT[role] }}
          >
            {ROLE_LABEL[role]}
          </span>
        </div>

        {/* Azione */}
        {canDm && (
          <div className="px-4 pb-4">
            <button
              onClick={() => { onStartDm(); onClose() }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #5A9AB1, #286680)',
                color: 'white',
                boxShadow: '0 4px 14px rgba(40,102,128,0.30)',
              }}
            >
              <MessageCircle size={15} strokeWidth={2} />
              Messaggio privato
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── channel row (groups) ────────────────────────────────────────────────────

function ChannelRow({ channel, active, unread, onSelect }: { channel: Channel; active: boolean; unread: number; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(channel.id)}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-all duration-100"
      style={active
        ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
        : { color: unread > 0 ? 'var(--ist-text)' : 'var(--ist-text-muted)' }
      }
    >
      <span className="flex-shrink-0 opacity-70" style={{ color: active ? 'var(--ist-accent-text)' : 'inherit' }}>
        <ChannelIcon type={channel.type} size={14} />
      </span>
      <span className="text-sm truncate flex-1 font-medium">
        {channel.name}
      </span>
      {unread > 0 && !active && (
        <UnreadBadge count={unread} />
      )}
    </button>
  )
}


// ─── channel sidebar ──────────────────────────────────────────────────────────

interface SidebarProps {
  activeChannel: string
  onSelect: (id: string) => void
  userRole: MemberRole
  userId: string
  channels: Channel[]
  dmUsers: DmUser[]
  unreadCounts: Record<string, number>
  tab: 'groups' | 'direct'
  onTabChange: (t: 'groups' | 'direct') => void
}

function ChannelSidebar({ activeChannel, onSelect, userRole, userId, channels, dmUsers, unreadCounts, tab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [dmFilter, setDmFilter] = useState<'all' | 'unread'>('all')
  // Solo lo staff può filtrare le chat private (es. mostrare solo le non lette).
  const isStaff = userRole === 'coach' || userRole === 'mental_coach' || userRole === 'admin'

  const groupChannels = channels.filter(ch => ch.roles.includes(userRole) && ch.channelKind === 'group')

  // Group by category (only for groups tab)
  const categories: Record<string, Channel[]> = {}
  for (const ch of groupChannels) {
    if (!categories[ch.category]) categories[ch.category] = []
    categories[ch.category].push(ch)
  }

  const filteredGroups = search.trim()
    ? groupChannels.filter(ch => ch.name.toLowerCase().includes(search.toLowerCase()))
    : null

  const dmSearched = search.trim()
    ? dmUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : dmUsers
  const filteredDms = (isStaff && dmFilter === 'unread')
    ? dmSearched.filter(u => (unreadCounts[dmChannelId(userId, u.id)] ?? 0) > 0)
    : dmSearched

  const toggleCategory = (cat: string) => {
    setCollapsed(p => ({ ...p, [cat]: !p[cat] }))
  }

  const groupUnread = groupChannels.reduce((n, ch) => n + (unreadCounts[ch.id] ?? 0), 0)
  const directUnread = dmUsers.reduce((n, u) => n + (unreadCounts[dmChannelId(userId, u.id)] ?? 0), 0)
  const unreadDmCount = dmUsers.filter(u => (unreadCounts[dmChannelId(userId, u.id)] ?? 0) > 0).length

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
          onClick={() => { onTabChange('groups'); setSearch('') }}
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
          onClick={() => { onTabChange('direct'); setSearch('') }}
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
            {/* Filtro chat private — solo staff */}
            {isStaff && (
              <div className="flex gap-1 px-1 pb-2">
                <button
                  onClick={() => setDmFilter('all')}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={dmFilter === 'all'
                    ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
                    : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)' }}
                >
                  Tutte
                </button>
                <button
                  onClick={() => setDmFilter('unread')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={dmFilter === 'unread'
                    ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
                    : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)' }}
                >
                  Non lette
                  {unreadDmCount > 0 && (
                    <span
                      className="text-[9px] font-bold text-white px-1 rounded-full min-w-[15px] text-center leading-[15px]"
                      style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)' }}
                    >
                      {unreadDmCount}
                    </span>
                  )}
                </button>
              </div>
            )}
            {filteredDms.length === 0 ? (
              <p className="text-xs px-3 py-4 text-center" style={{ color: 'var(--ist-text-dim)' }}>
                {isStaff && dmFilter === 'unread' ? 'Nessuna chat non letta' : 'Nessuna chat privata'}
              </p>
            ) : (() => {
              const pinned = filteredDms.filter(u => u.role === 'coach' || u.role === 'mental_coach')
              const others = filteredDms.filter(u => u.role !== 'coach' && u.role !== 'mental_coach')

              const renderUser = (u: DmUser) => {
                const chId = dmChannelId(userId, u.id)
                const dmUnread = unreadCounts[chId] ?? 0
                return (
                  <button
                    key={u.id}
                    onClick={() => onSelect(chId)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all duration-100"
                    style={activeChannel === chId ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' } : {}}
                  >
                    <div className="relative flex-shrink-0">
                      <UserAvatar user={{ name: u.name, avatarUrl: u.avatarUrl, avatarPreset: u.avatarPreset }} size={36} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: activeChannel === chId ? 'var(--ist-accent-text)' : 'var(--ist-text)' }}>
                        {u.name}
                      </p>
                      <p className="text-[11px]" style={{ color: ROLE_TEXT[u.role] }}>
                        {ROLE_LABEL[u.role]}
                      </p>
                    </div>
                    {dmUnread > 0 && activeChannel !== chId && (
                      <UnreadBadge count={dmUnread} />
                    )}
                  </button>
                )
              }

              return (
                <>
                  {pinned.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider px-2 pt-2 pb-1" style={{ color: 'var(--ist-text-muted)' }}>
                        Il tuo team
                      </p>
                      {pinned.map(renderUser)}
                      {others.length > 0 && (
                        <div className="my-2 mx-2 h-px" style={{ background: 'var(--ist-w8)' }} />
                      )}
                    </>
                  )}
                  {others.length > 0 && (
                    <>
                      {pinned.length > 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-wider px-2 pb-1" style={{ color: 'var(--ist-text-muted)' }}>
                          Altri
                        </p>
                      )}
                      {others.map(renderUser)}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (
          filteredGroups ? (
            <div className="px-1 py-1">
              {filteredGroups.map(ch => (
                <ChannelRow key={ch.id} channel={ch} active={activeChannel === ch.id} unread={unreadCounts[ch.id] ?? 0} onSelect={onSelect} />
              ))}
              {filteredGroups.length === 0 && (
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
                        <ChannelRow key={ch.id} channel={ch} active={activeChannel === ch.id} unread={unreadCounts[ch.id] ?? 0} onSelect={onSelect} />
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
  userId: string
  userName: string
  onShowUserCard: (card: { userId: string; name: string; role: MemberRole; avatar?: { avatarUrl?: string; avatarPreset?: string } }) => void
  onBack?: () => void
  isMobile?: boolean
}

function ChatArea({ channel, userRole, userId, userName, onShowUserCard, onBack, isMobile }: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [showReactFor, setShowReactFor] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Anteprima locale dell'immagine selezionata (object URL, revocata al cambio).
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile])
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  const { messages, loading, reactions, sendMessage: sendToDb, editMessage, deleteMessage, toggleReaction } = useChatMessages(channel.id, userId)
  const { typingUsers, notifyTyping, stopTyping } = useTypingIndicator(channel.id, userId, userName)
  // Avatar reali (foto/preset) degli autori, risolti per user_id.
  const authorAvatars = useAuthorAvatars(useMemo(() => messages.map(m => m.user_id), [messages]))

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setInput(''); setEditingId(null); setHoveredMsgId(null); setImageFile(null) }, [channel.id])

  // Auto-scroll: only if already at bottom
  const prevMsgCount = useRef(0)
  useEffect(() => {
    const added = messages.length > prevMsgCount.current
    prevMsgCount.current = messages.length
    if (!added) return

    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setNewMsgCount(0)
    } else {
      // count only messages from others
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.user_id !== userId) {
        setNewMsgCount(prev => prev + 1)
      }
    }
  }, [messages.length])

  // Initial scroll to bottom on load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    }
  }, [loading])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setIsAtBottom(atBottom)
    if (atBottom) setNewMsgCount(0)
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
    setNewMsgCount(0)
  }

  const canPost = channel.canPost.includes(userRole)

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return
    if (f.size > 15 * 1024 * 1024) { alert('Immagine troppo grande (max 15 MB).'); return }
    setImageFile(f)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if ((!text && !imageFile) || !canPost || uploading) return
    let imageUrl: string | null = null
    if (imageFile) {
      setUploading(true)
      imageUrl = await uploadChatImage(userId, imageFile)
      setUploading(false)
      if (!imageUrl) { alert('Caricamento immagine non riuscito. Riprova.'); return }
    }
    setInput('')
    setImageFile(null)
    stopTyping()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendToDb(text, userName, userRole, imageUrl)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    notifyTyping()
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const startEdit = (msg: DbMessage) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
    setTimeout(() => {
      editTextareaRef.current?.focus()
      editTextareaRef.current?.select()
    }, 50)
  }

  const confirmEdit = async () => {
    if (!editingId || !editContent.trim()) return
    await editMessage(editingId, editContent)
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Eliminare questo messaggio?')) return
    await deleteMessage(id)
  }

  interface MessageGroup {
    author: string
    authorId: string
    authorRole: MemberRole
    own: boolean
    messages: { id: string; text: string; editedAt?: string | null; fullMsg: DbMessage }[]
    firstTimestamp: string
  }

  const groups: MessageGroup[] = []
  for (const msg of messages) {
    const own = msg.user_id === userId
    const last = groups[groups.length - 1]
    if (last && last.author === msg.author_name && last.own === own && sameDay(last.firstTimestamp, msg.created_at)) {
      last.messages.push({ id: msg.id, text: msg.content, editedAt: msg.edited_at, fullMsg: msg })
    } else {
      groups.push({
        author: msg.author_name,
        authorId: msg.user_id,
        authorRole: msg.author_role,
        own,
        messages: [{ id: msg.id, text: msg.content, editedAt: msg.edited_at, fullMsg: msg }],
        firstTimestamp: msg.created_at,
      })
    }
  }

  const isDirect = channel.channelKind === 'direct'
  const dmPartner = channel.dmWith

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--ist-w8)', background: 'var(--ist-nav-bg)', backdropFilter: 'blur(16px)' }}
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
          <div className="flex-shrink-0">
            <UserAvatar user={{ name: dmPartner.name, avatarUrl: dmPartner.avatarUrl, avatarPreset: dmPartner.avatarPreset }} size={36} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ist-w8)', color: 'var(--ist-accent-text)' }}>
            <ChannelIcon type={channel.type} size={15} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--ist-text)' }}>{channel.name}</span>
            {isDirect && dmPartner && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: ROLE_COLOR[dmPartner.role], color: ROLE_TEXT[dmPartner.role] }}>
                {ROLE_LABEL[dmPartner.role]}
              </span>
            )}
          </div>
          {!isDirect && channel.description ? (
            <p className="text-[11px] truncate" style={{ color: 'var(--ist-text-muted)' }}>{channel.description}</p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar"
        style={{ overscrollBehavior: 'contain' }}
        onClick={() => { setHoveredMsgId(null); setShowReactFor(null) }}
      >
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Nessun messaggio ancora. Inizia la conversazione!</p>
          </div>
        )}

        <div className="space-y-0.5">
          {groups.map((group, gi) => {
            const prevGroup = groups[gi - 1]
            const showDateSep = !prevGroup || !sameDay(prevGroup.firstTimestamp, group.firstTimestamp)

            return (
              <div key={`group-${gi}`}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px" style={{ background: 'var(--ist-w8)' }} />
                    <span className="text-[10px] font-semibold px-2" style={{ color: 'var(--ist-text-dim)' }}>{formatDate(group.firstTimestamp)}</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--ist-w8)' }} />
                  </div>
                )}

                <div className={`flex gap-2.5 mt-3 group/msggroup ${group.own ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <button
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 self-end overflow-hidden transition-opacity hover:opacity-80 active:opacity-60"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!group.own) onShowUserCard({ userId: group.authorId, name: group.author, role: group.authorRole, avatar: authorAvatars[group.authorId] })
                    }}
                  >
                    {(() => {
                      const a = authorAvatars[group.authorId]
                      if (a?.avatarUrl || a?.avatarPreset) {
                        return <UserAvatar user={{ name: a.name || group.author, avatarUrl: a.avatarUrl, avatarPreset: a.avatarPreset }} size={28} />
                      }
                      // Fallback: iniziale su gradiente (proprio = blu, altri = per ruolo)
                      return (
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                          style={{ background: group.own ? 'linear-gradient(135deg, #5A9AB1, #286680)' : (DM_AVATAR_GRADIENT[group.authorRole] ?? 'var(--ist-w12)') }}
                        >
                          {group.author.charAt(0)}
                        </span>
                      )
                    })()}
                  </button>

                  <div className={`flex flex-col gap-0.5 min-w-0 max-w-[75%] ${group.own ? 'items-end' : 'items-start'}`}>
                    {/* Author + time */}
                    <div className={`flex items-baseline gap-2 mb-0.5 ${group.own ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[11px] font-semibold" style={{ color: group.own ? 'var(--ist-bubble-own-name)' : 'var(--ist-text)' }}>
                        {group.own ? 'Tu' : group.author}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--ist-text-dim)' }}>{formatTime(group.firstTimestamp)}</span>
                      {!group.own && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: ROLE_COLOR[group.authorRole], color: ROLE_TEXT[group.authorRole] }}>
                          {ROLE_LABEL[group.authorRole]}
                        </span>
                      )}
                    </div>

                    {/* Messages */}
                    {group.messages.map((msg, mi) => {
                      const msgReactions = reactions[msg.id]
                      const hasReactions = msgReactions && Object.keys(msgReactions).length > 0
                      const isEditing = editingId === msg.id
                      const isHovered = hoveredMsgId === msg.id
                      const isLastInGroup = mi === group.messages.length - 1

                      return (
                        <div key={msg.id} className="relative w-full" style={{ marginBottom: hasReactions ? 8 : 0 }}>
                          {/* Message bubble with action bar */}
                          <div
                            className={`relative flex items-end gap-1 ${group.own ? 'flex-row-reverse' : 'flex-row'}`}
                            onMouseEnter={() => setHoveredMsgId(msg.id)}
                            onMouseLeave={() => { if (showReactFor !== msg.id) setHoveredMsgId(null) }}
                          >
                            {/* Action bar (shown on hover for desktop) */}
                            {(isHovered || showReactFor === msg.id) && !isEditing && (
                              <div
                                className={`flex items-center gap-0.5 flex-shrink-0 ${group.own ? 'mr-1' : 'ml-1'}`}
                                onClick={e => e.stopPropagation()}
                              >
                                {/* React button */}
                                <div className="relative">
                                  <button
                                    onClick={() => setShowReactFor(prev => prev === msg.id ? null : msg.id)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                                    style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
                                    title="Reagisci"
                                  >
                                    <SmilePlus size={12} strokeWidth={2} />
                                  </button>
                                  {/* Emoji picker popover */}
                                  {showReactFor === msg.id && (
                                    <div
                                      className={`absolute bottom-8 flex gap-0.5 p-1.5 rounded-2xl z-10 ${group.own ? 'right-0' : 'left-0'}`}
                                      style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.30)', backdropFilter: 'blur(16px)' }}
                                    >
                                      {QUICK_EMOJIS.map(em => (
                                        <button
                                          key={em}
                                          onClick={() => { toggleReaction(msg.id, em); setShowReactFor(null); setHoveredMsgId(null) }}
                                          className="w-8 h-8 flex items-center justify-center rounded-xl text-lg transition-all hover:scale-125 hover:bg-white/10"
                                        >
                                          {em}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Edit/Delete for own messages */}
                                {group.own && (
                                  <>
                                    <button
                                      onClick={() => startEdit(msg.fullMsg)}
                                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                                      style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
                                      title="Modifica"
                                    >
                                      <Edit2 size={11} strokeWidth={2} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                                      style={{ background: 'var(--ist-w8)', color: '#FF6B7A' }}
                                      title="Elimina"
                                    >
                                      <Trash2 size={11} strokeWidth={2} />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Bubble */}
                            {isEditing ? (
                              <div className="flex-1 flex flex-col gap-2">
                                <textarea
                                  ref={editTextareaRef}
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit() }
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  rows={1}
                                  className="w-full resize-none px-3.5 py-2.5 text-sm focus:outline-none no-scrollbar rounded-2xl"
                                  style={{ background: 'var(--ist-input-surface)', border: '1px solid var(--ist-accent-text)', color: 'var(--ist-text)', maxHeight: 120, lineHeight: 1.5 }}
                                />
                                <div className={`flex gap-2 text-xs ${group.own ? 'justify-end' : 'justify-start'}`}>
                                  <button onClick={cancelEdit} className="px-3 py-1 rounded-xl" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>Annulla</button>
                                  <button onClick={confirmEdit} className="px-3 py-1 rounded-xl font-semibold" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white' }}>Salva</button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="px-3.5 py-2.5 text-sm leading-relaxed"
                                style={group.own
                                  ? {
                                    background: 'var(--ist-bubble-own-bg)',
                                    color: 'var(--ist-bubble-own-text)',
                                    border: '1px solid var(--ist-bubble-own-border)',
                                    borderRadius: mi === 0
                                      ? (isLastInGroup ? '18px 4px 18px 18px' : '18px 18px 4px 18px')
                                      : (isLastInGroup ? '4px 4px 18px 18px' : '4px 18px 4px 4px'),
                                    wordBreak: 'break-word',
                                  }
                                  : {
                                    background: 'var(--ist-bubble-other-bg)',
                                    color: 'var(--ist-text)',
                                    border: '1px solid var(--ist-bubble-other-border)',
                                    borderRadius: mi === 0
                                      ? (isLastInGroup ? '4px 18px 18px 18px' : '18px 18px 18px 4px')
                                      : (isLastInGroup ? '4px 4px 18px 18px' : '4px 18px 4px 4px'),
                                    wordBreak: 'break-word',
                                  }
                                }
                              >
                                {msg.fullMsg.image_url && (
                                  <a
                                    href={msg.fullMsg.image_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                    style={{ marginBottom: msg.text ? 6 : 0 }}
                                  >
                                    <img
                                      src={msg.fullMsg.image_url}
                                      alt="immagine"
                                      loading="lazy"
                                      className="rounded-xl"
                                      style={{ maxWidth: '100%', maxHeight: 300, display: 'block' }}
                                    />
                                  </a>
                                )}
                                {msg.text}
                                {msg.editedAt && (
                                  <span className="text-[9px] ml-1.5 opacity-50">modificato</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reactions */}
                          {hasReactions && (
                            <div className={`flex flex-wrap gap-1 mt-1.5 ${group.own ? 'justify-end' : 'justify-start'}`}>
                              {Object.entries(msgReactions).map(([emoji, { count, reacted }]) => (
                                <button
                                  key={emoji}
                                  onClick={e => { e.stopPropagation(); toggleReaction(msg.id, emoji) }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-105 active:scale-95"
                                  style={reacted
                                    ? { background: 'rgba(124,187,208,0.25)', border: '1px solid rgba(124,187,208,0.50)', color: 'var(--ist-accent-text)' }
                                    : { background: 'var(--ist-w6)', border: '1px solid var(--ist-w9)', color: 'var(--ist-text-muted)' }
                                  }
                                >
                                  <span>{emoji}</span>
                                  <span className="font-semibold">{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 z-10"
          style={{
            bottom: canPost ? 88 : 64,
            background: 'var(--ist-nav-bg)',
            border: '1px solid var(--ist-nav-border)',
            color: 'var(--ist-text)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <ChevronDown size={13} strokeWidth={2.5} />
          {newMsgCount > 0 ? `${newMsgCount} nuovi` : 'Scorri giu'}
        </button>
      )}

      {/* Typing indicator — riga dedicata sopra l'input, sempre visibile */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0" style={{ background: 'var(--ist-nav-bg)' }}>
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: 'var(--ist-text-dim)', animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--ist-text-dim)' }}>
            {typingUsers.length === 1 ? `${typingUsers[0]} sta scrivendo…` : `${typingUsers.join(', ')} stanno scrivendo…`}
          </span>
        </div>
      )}

      {/* Input bar */}
      {canPost ? (
        <div
          className="flex flex-col gap-2 px-3 pt-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--ist-w8)', background: 'var(--ist-nav-bg)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Anteprima immagine selezionata */}
          {imagePreview && (
            <div className="relative self-start">
              <img
                src={imagePreview}
                alt="anteprima"
                className="h-16 w-16 rounded-xl object-cover"
                style={{ border: '1px solid var(--ist-w10)' }}
              />
              <button
                onClick={() => setImageFile(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)', color: 'var(--ist-text)' }}
                title="Rimuovi immagine"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:brightness-110"
              style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
              title="Allega immagine"
            >
              <ImagePlus size={17} strokeWidth={2} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              placeholder={isDirect && dmPartner ? `Scrivi a ${dmPartner.name}…` : `Scrivi in #${channel.name}…`}
              rows={1}
              className="flex-1 resize-none px-3.5 py-2.5 text-sm focus:outline-none no-scrollbar"
              style={{ background: 'var(--ist-input-surface)', border: '1px solid var(--ist-input-border)', borderRadius: 16, color: 'var(--ist-text)', maxHeight: 120, lineHeight: 1.5 }}
            />
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !imageFile) || uploading}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', boxShadow: (input.trim() || imageFile) ? '0 4px 16px rgba(40,102,128,0.36)' : 'none' }}
            >
              {uploading
                ? <Loader2 size={15} strokeWidth={2} className="text-white animate-spin" />
                : <Send size={15} strokeWidth={2} className="text-white" />}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center gap-2 px-4 pt-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--ist-w8)', background: 'var(--ist-nav-bg)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        >
          <span className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>🔒 Solo lettura — non puoi scrivere in questo canale</span>
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

export default function ChatPage() {
  const { user } = useAuth()
  const { setHideBottomNav } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const userRole = (user?.role ?? 'student') as MemberRole
  const userId = user?.id ?? ''
  const userName = user?.name ?? ''

  const dmUsers = useDmUsers(userId, userRole)
  const { channels } = useChannels()
  const [searchParams] = useSearchParams()

  const visibleChannels = channels.filter(ch => ch.roles.includes(userRole))
  // Deep-link da notifica push: /student/chat?c=<channelId> apre quel canale/DM.
  const [activeChannelId, setActiveChannelId] = useState(
    () => new URLSearchParams(location.search).get('c') || 'generale'
  )
  const [mobileView, setMobileView] = useState<'channels' | 'chat'>(
    () => (new URLSearchParams(location.search).get('c') ? 'chat' : 'channels')
  )
  const [sidebarTab, setSidebarTab] = useState<'groups' | 'direct'>(() => {
    const c = new URLSearchParams(location.search).get('c')
    const st = (location.state as { tab?: 'direct' | 'groups' } | null)?.tab
    return c?.startsWith('dm_') || st === 'direct' ? 'direct' : 'groups'
  })
  const [userCard, setUserCard] = useState<{ userId: string; name: string; role: MemberRole; avatar?: { avatarUrl?: string; avatarPreset?: string } } | null>(null)

  // Cache id→{name,role} per costruire la DM anche se il partner non è in dmUsers
  // (es. RLS su profiles che nasconde gli altri studenti). Popolata aprendo la card.
  const [knownUsers, setKnownUsers] = useState<Record<string, { name: string; role: MemberRole }>>({})
  const showUserCard = useCallback((card: { userId: string; name: string; role: MemberRole; avatar?: { avatarUrl?: string; avatarPreset?: string } }) => {
    setKnownUsers(prev => ({ ...prev, [card.userId]: { name: card.name, role: card.role } }))
    setUserCard(card)
  }, [])

  // Lista di tutti i channel ID noti (gruppi + DM)
  const allChannelIds = useMemo(() => [
    ...visibleChannels.map(ch => ch.id),
    ...dmUsers.map(u => dmChannelId(userId, u.id)),
  ], [visibleChannels.map(ch => ch.id).join(','), dmUsers.map(u => u.id).join(',')])

  const { counts: unreadCounts, markRead } = useUnreadCounts(userId, allChannelIds, activeChannelId)

  useEffect(() => {
    setHideBottomNav(mobileView === 'chat')
    return () => setHideBottomNav(false)
  }, [mobileView, setHideBottomNav])

  // Segna come letto il canale iniziale al mount
  useEffect(() => {
    if (userId && activeChannelId) markRead(activeChannelId)
  }, [userId])

  // Gestisce apertura DM da navigazione esterna: navigate('/student/chat', { state: { openDm: userId } })
  const navState = location.state as { openDm?: string; tab?: 'direct' | 'groups' } | null
  const [initialNavHandled, setInitialNavHandled] = useState(false)
  useEffect(() => {
    if (initialNavHandled || !navState) return
    setInitialNavHandled(true)
    navigate(location.pathname, { replace: true, state: null }) // pulisce lo state dall'history

    if (navState.openDm && userId) {
      const ch = dmChannelId(userId, navState.openDm)
      setActiveChannelId(ch)
      setMobileView('chat')
      setSidebarTab('direct')
      markRead(ch)
    }
  }, [navState, userId, initialNavHandled])

  // Deep-link da notifica push (?c=<channelId>): apre direttamente il canale/DM.
  // Vale sia al primo caricamento sia con l'app già aperta (SW → soft-nav).
  useEffect(() => {
    const c = searchParams.get('c')
    if (!c || !userId) return
    setActiveChannelId(c)
    setMobileView('chat')
    setSidebarTab(c.startsWith('dm_') ? 'direct' : 'groups')
    markRead(c)
    navigate(location.pathname, { replace: true }) // pulisce il parametro dall'URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userId])

  const activeGroupChannel = channels.find(ch => ch.id === activeChannelId)
  const isDmChannel = activeChannelId.startsWith('dm_')

  const dmPartnerId = isDmChannel
    ? activeChannelId.replace('dm_', '').split('_').find(id => id !== userId) ?? null
    : null

  const activeDmUser = isDmChannel
    ? (dmUsers.find(u => u.id === dmPartnerId)
       ?? (dmPartnerId && knownUsers[dmPartnerId]
           ? { id: dmPartnerId, name: knownUsers[dmPartnerId].name, role: knownUsers[dmPartnerId].role, avatarUrl: undefined, avatarPreset: undefined }
           : null))
    : null

  const activeDmChannel: Channel | null = activeDmUser
    ? {
      id: activeChannelId,
      name: activeDmUser.name,
      description: ROLE_LABEL[activeDmUser.role],
      type: 'chat',
      channelKind: 'direct',
      category: 'Privati',
      categoryIcon: '',
      roles: ['student', 'coach', 'mental_coach', 'admin'],
      canPost: ['student', 'coach', 'mental_coach', 'admin'],
      dmWith: { name: activeDmUser.name, role: activeDmUser.role, avatarUrl: activeDmUser.avatarUrl, avatarPreset: activeDmUser.avatarPreset },
    }
    : null

  const activeChannel = activeGroupChannel ?? activeDmChannel

  const selectChannel = (id: string) => {
    setActiveChannelId(id)
    setMobileView('chat')
    markRead(id)
  }

  const goBack = () => setMobileView('channels')

  return (
    <div className="flex overflow-hidden fixed inset-0 z-10" style={{ background: 'var(--ist-nav-bg)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 ${mobileView === 'channels' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[240px] lg:ml-[108px] flex-col overflow-hidden`}
        style={{ height: '100%' }}
      >
        <ChannelSidebar
          activeChannel={activeChannelId}
          onSelect={selectChannel}
          userRole={userRole}
          userId={userId}
          channels={channels}
          dmUsers={dmUsers}
          unreadCounts={unreadCounts}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
        />
      </div>

      {/* Chat / Bacheca area */}
      <div
        className={`flex-1 min-w-0 flex flex-col overflow-hidden ${mobileView === 'chat' ? 'flex' : 'hidden'} lg:flex`}
        style={{ height: '100%' }}
      >
        {activeChannel?.type === 'bacheca' && activeGroupChannel ? (
          <BachecaArea
            channel={activeGroupChannel}
            userRole={userRole}
            onBack={goBack}
            isMobile={mobileView === 'chat'}
          />
        ) : activeChannel ? (
          <ChatArea
            key={activeChannelId}
            channel={activeChannel}
            userRole={userRole}
            userId={userId}
            userName={userName}
            onShowUserCard={showUserCard}
            onBack={goBack}
            isMobile={mobileView === 'chat'}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Seleziona un canale</p>
          </div>
        )}
      </div>

      {!activeChannel && (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>Seleziona un canale</p>
        </div>
      )}

      {/* UserCard rendered at top level — outside overflow-hidden containers */}
      {userCard && (
        <UserCard
          userId={userCard.userId}
          name={userCard.name}
          role={userCard.role}
          avatar={userCard.avatar}
          canDm={userCard.userId !== userId}
          onStartDm={() => { const ch = dmChannelId(userId, userCard.userId); selectChannel(ch) }}
          onClose={() => setUserCard(null)}
        />
      )}
    </div>
  )
}
