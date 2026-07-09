import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import {
  Hash, Megaphone, ChevronDown, ChevronRight,
  Send, ArrowLeft, Search, Pin, MessageCircle, UsersRound, Loader2, X,
  Edit2, Trash2, SmilePlus, ImagePlus, Plus, Mic, Paperclip, FileText,
} from 'lucide-react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'
import {
  Channel, MemberRole,
} from '../../data/chatData'
import { useBachecaPosts, BachecaPost, NewBachecaPost } from '../../lib/bacheca'
import {
  useChatMessages, useDmUsers, useUnreadCounts, useTypingIndicator,
  useAuthorAvatars, dmChannelId, DmUser, DbMessage, MessageMedia,
} from '../../lib/chat'
import { useChannels } from '../../lib/channels'
import { setActiveChat } from '../../lib/activeChat'
import {
  uploadChatImage, uploadChatFile, uploadChatAudio,
  isAllowedChatFile, CHAT_FILE_MAX_BYTES, CHAT_FILE_ACCEPT,
} from '../../lib/storage'
import { useAudioRecorder, isAudioRecordingSupported, formatDuration } from '../../lib/audioRecorder'
import { VoiceMessage, FileAttachment } from '../../components/chat/ChatMedia'
import { isFreeUser } from '../../lib/freeTier'
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

// Risposta preimpostata al messaggio di benvenuto automatico (canale 'benvenuto').
const WELCOME_REPLY = 'Grazie mille! Felice di essere qui 🚀'

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
  // Solo l'admin può separare i DM per tier (paganti = formazione / gratuiti = vendita).
  const [tierFilter, setTierFilter] = useState<'all' | 'full' | 'free'>('all')
  // Solo lo staff può filtrare le chat private (es. mostrare solo le non lette).
  const isStaff = userRole === 'coach' || userRole === 'mental_coach' || userRole === 'admin'
  const isAdmin = userRole === 'admin'

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
  // Admin: separa i DM per tier (studenti paganti vs gratuiti).
  const dmTierFiltered = (isAdmin && tierFilter !== 'all')
    ? dmSearched.filter(u => u.role === 'student' && (tierFilter === 'free' ? u.tier === 'free' : u.tier !== 'free'))
    : dmSearched
  const filteredDms = (isStaff && dmFilter === 'unread')
    ? dmTierFiltered.filter(u => (unreadCounts[dmChannelId(userId, u.id)] ?? 0) > 0)
    : dmTierFiltered

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
            {/* Separazione DM per tier — solo admin (paganti = formazione / gratuiti = vendita) */}
            {isAdmin && (
              <div className="flex gap-1 px-1 pb-2">
                {([['all', 'Tutti'], ['full', 'Paganti'], ['free', 'Gratuiti']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setTierFilter(val)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={tierFilter === val
                      ? { background: 'var(--ist-nav-active-bg)', color: 'var(--ist-accent-text)' }
                      : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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

              const section = (key: string, label: string, hint: string | null, list: DmUser[]) =>
                list.length > 0 ? (
                  <div key={key} className="mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider px-2 pt-2 pb-1 flex items-center gap-1.5" style={{ color: 'var(--ist-text-muted)' }}>
                      <span>{label}</span>
                      {hint && <span className="normal-case font-medium" style={{ color: 'var(--ist-text-dim)' }}>· {hint}</span>}
                      <span className="ml-auto text-[9px] px-1.5 rounded-full font-bold" style={{ background: 'var(--ist-w7)', color: 'var(--ist-text-dim)' }}>{list.length}</span>
                    </p>
                    {list.map(renderUser)}
                  </div>
                ) : null

              // Admin: sezioni separate paganti (formazione) / gratuiti (vendita) / staff.
              if (isAdmin) {
                const staff  = filteredDms.filter(u => u.role !== 'student')
                const paying = filteredDms.filter(u => u.role === 'student' && u.tier !== 'free')
                const free   = filteredDms.filter(u => u.role === 'student' && u.tier === 'free')
                return (
                  <>
                    {section('staff', 'Team & staff', null, staff)}
                    {section('paganti', 'Studenti paganti', 'formazione', paying)}
                    {section('gratuiti', 'Utenti gratuiti', 'vendita', free)}
                  </>
                )
              }

              // Coach / mental / studente: team (coach+mental) poi gli altri.
              const pinned = filteredDms.filter(u => u.role === 'coach' || u.role === 'mental_coach')
              const others = filteredDms.filter(u => u.role !== 'coach' && u.role !== 'mental_coach')
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
  initialInput?: string
  keyboardOpen?: boolean
  keyboardInset?: number
}

function ChatArea({ channel, userRole, userId, userName, onShowUserCard, onBack, isMobile, initialInput, keyboardOpen, keyboardInset = 0 }: ChatAreaProps) {
  const [input, setInput] = useState(initialInput ?? '')
  const [inputTall, setInputTall] = useState(false) // multi-riga → rettangolo stondato invece della pillola
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [showReactFor, setShowReactFor] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [fileAttachment, setFileAttachment] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Registrazione vocali (stile WhatsApp): tieni premuto il mic, scorri a
  // sinistra per annullare, scorri in alto per bloccare (hands-free).
  const recorder = useAudioRecorder()
  const [recLocked, setRecLocked] = useState(false)
  const [recCancelArmed, setRecCancelArmed] = useState(false)
  const [micHint, setMicHint] = useState(false)
  const holdingRef = useRef(false)
  const startPtRef = useRef<{ x: number; y: number } | null>(null)
  const audioSupported = isAudioRecordingSupported()

  // Anteprima locale dell'immagine selezionata (object URL, revocata al cambio).
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : null, [imageFile])
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  const { messages, loading, reactions, hasMore, loadingMore, loadMore, sendMessage: sendToDb, editMessage, deleteMessage, toggleReaction } = useChatMessages(channel.id, userId)
  const { typingUsers, notifyTyping, stopTyping } = useTypingIndicator(channel.id, userId, userName)
  // Avatar reali (foto/preset) degli autori, risolti per user_id.
  const authorAvatars = useAuthorAvatars(useMemo(() => messages.map(m => m.user_id), [messages]))

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // NB: ChatArea è montata con key={channel.id}, quindi lo stato si azzera già al
  // cambio canale. Non resettiamo `input` qui per non cancellare l'eventuale
  // testo precompilato (es. richiesta d'accesso all'admin).
  useEffect(() => { setEditingId(null); setHoveredMsgId(null); setImageFile(null); setFileAttachment(null) }, [channel.id])

  // Segnala qual è la chat aperta → sopprime le notifiche (in-app + push) del
  // canale che stai già guardando; azzera quando esci dalla chat.
  useEffect(() => {
    setActiveChat(channel.id)
    return () => setActiveChat(null)
  }, [channel.id])

  // Auto-scroll + paginazione. Distingue l'APPEND (nuovo messaggio in fondo) dal
  // PREPEND (messaggi più vecchi caricati in cima da loadMore): sul prepend NON
  // si scrolla né si conta come "nuovo", ma si conserva la posizione di lettura
  // compensando l'altezza aggiunta sopra (via useLayoutEffect, prima del paint).
  const prevMsgCount = useRef(0)
  const prevLastId = useRef<string | null>(null)
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const added = messages.length - prevMsgCount.current
    const lastId = messages[messages.length - 1]?.id ?? null
    const wasPrepend = added > 0 && prevLastId.current !== null && lastId === prevLastId.current
    prevMsgCount.current = messages.length
    prevLastId.current = lastId
    if (added <= 0) return

    if (wasPrepend) {
      const el = scrollContainerRef.current
      const r = restoreScrollRef.current
      if (el && r) el.scrollTop = el.scrollHeight - r.height + r.top
      restoreScrollRef.current = null
      return
    }

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

  // Quando si apre la tastiera (mobile), tieni l'ultimo messaggio visibile
  // appena sopra l'input (se eri già in fondo).
  useEffect(() => {
    if (keyboardOpen && isAtBottom) {
      const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 120)
      return () => clearTimeout(t)
    }
  }, [keyboardOpen])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setIsAtBottom(atBottom)
    if (atBottom) setNewMsgCount(0)
    // Vicino alla cima → carica il blocco di messaggi precedenti. Cattura altezza
    // e posizione PRIMA del prepend, così il layout effect può ripristinare la
    // vista senza salti. La guard anti-doppio è dentro loadMore (ref sincrona).
    if (el.scrollTop < 120 && hasMore && !loadingMore) {
      restoreScrollRef.current = { height: el.scrollHeight, top: el.scrollTop }
      loadMore()
    }
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
    setNewMsgCount(0)
  }

  const canPost = channel.canPost.includes(userRole)
  // Ha già scritto in questo canale? (nel 'benvenuto' = ha già risposto al
  // messaggio automatico → nasconde il tastino di risposta preimpostata.)
  const hasRepliedWelcome = messages.some(m => m.user_id === userId)

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return
    if (f.size > 15 * 1024 * 1024) { alert('Immagine troppo grande (max 15 MB).'); return }
    setFileAttachment(null)
    setImageFile(f)
  }

  // File allegato (solo staff, solo DM). Un'immagine scelta qui viene mostrata
  // inline come le foto; i documenti diventano un allegato scaricabile.
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > CHAT_FILE_MAX_BYTES) { alert('File troppo grande (max 25 MB).'); return }
    if (!isAllowedChatFile(f)) { alert('Tipo di file non consentito.'); return }
    if (f.type.startsWith('image/')) { setImageFile(f); setFileAttachment(null); return }
    setImageFile(null)
    setFileAttachment(f)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if ((!text && !imageFile && !fileAttachment) || !canPost || uploading) return
    const media: MessageMedia = {}
    setUploading(true)
    try {
      if (imageFile) {
        const url = await uploadChatImage(userId, imageFile)
        if (!url) { alert('Caricamento immagine non riuscito. Riprova.'); return }
        media.imageUrl = url
      }
      if (fileAttachment) {
        const up = await uploadChatFile(userId, fileAttachment)
        if (!up) { alert('Caricamento file non riuscito. Riprova.'); return }
        media.fileUrl = up.url; media.fileName = up.name; media.fileSize = up.size
      }
    } finally {
      setUploading(false)
    }
    setInput('')
    setInputTall(false)
    setImageFile(null)
    setFileAttachment(null)
    stopTyping()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendToDb(text, userName, userRole, media)
  }

  // ── Vocali: registra tenendo premuto, invia al rilascio ────────────────────
  const finishAndSendAudio = async () => {
    setRecCancelArmed(false)
    setRecLocked(false)
    const rec = await recorder.stop()
    // Blob vuoto/registrazione fallita: NON restare in silenzio (il vocale è
    // "fondamentale") → avvisa così l'utente riprova invece di credere sia partito.
    if (!rec) { alert('Vocale non registrato. Riprova tenendo premuto un istante in più.'); return }
    setUploading(true)
    const url = await uploadChatAudio(userId, rec.blob, rec.ext, rec.mime)
    setUploading(false)
    if (!url) { alert('Invio del vocale non riuscito. Riprova.'); return }
    await sendToDb('', userName, userRole, { audioUrl: url, audioDuration: rec.durationSec })
  }

  const cancelAudio = () => {
    setRecCancelArmed(false)
    setRecLocked(false)
    recorder.cancel()
  }

  const onMicPointerDown = async (e: React.PointerEvent) => {
    if (channel.channelKind !== 'direct' || !audioSupported || uploading || recorder.isActive()) return
    e.preventDefault()
    holdingRef.current = true
    startPtRef.current = { x: e.clientX, y: e.clientY }
    setRecCancelArmed(false)
    setRecLocked(false)
    setMicHint(false)
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
    const ok = await recorder.start()
    // L'utente potrebbe aver già rilasciato (o negato il permesso) durante l'attesa.
    if (!ok || !holdingRef.current) { recorder.cancel() }
  }

  const onMicPointerMove = (e: React.PointerEvent) => {
    if (!holdingRef.current || recLocked || !startPtRef.current) return
    const dx = e.clientX - startPtRef.current.x
    const dy = e.clientY - startPtRef.current.y
    // Solo gesti DELIBERATI: soglie ampie + direzione dominante. Così il naturale
    // "drift" del dito durante un vocale LUNGO non annulla/blocca per sbaglio
    // (era la causa dei vocali lunghi che "sparivano": bastavano ~70px = 1cm).
    setRecCancelArmed(dx < -90 && Math.abs(dx) > Math.abs(dy) * 1.3)
    if (dy < -110 && Math.abs(dy) > Math.abs(dx) * 1.3) { setRecLocked(true); holdingRef.current = false }
  }

  // Fine del "tieni premuto": rilascio normale (pointerup), interruzione di sistema
  // (pointercancel) o perdita del pointer capture (lostpointercapture) — tutti
  // tipici nel WebView iOS quando il gesto viene "rubato". In ogni caso
  // FINALIZZIAMO: altrimenti il vocale andava perso in silenzio e il recorder
  // restava bloccato. holdingRef si azzera SUBITO → niente doppia finalizzazione.
  const endHold = (e: React.PointerEvent, interrupted: boolean) => {
    if (!holdingRef.current) return // già bloccato (hands-free) o già finalizzato
    holdingRef.current = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    if (!recorder.isActive()) return // start non ancora completato → il guard in pointerDown annulla
    if (recCancelArmed) { cancelAudio(); return }
    if (recorder.getElapsedMs() < 500) { // tap troppo corto (tempo REALE) → annulla e suggerisci
      cancelAudio()
      if (!interrupted) {
        setMicHint(true)
        setTimeout(() => setMicHint(false), 1800)
      }
      return
    }
    void finishAndSendAudio()
  }

  const onMicPointerUp = (e: React.PointerEvent) => endHold(e, false)
  const onMicPointerCancel = (e: React.PointerEvent) => endHold(e, true)

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
    // Una riga → pillola; più righe → rettangolo con angoli stondati.
    setInputTall(el.scrollHeight > 44)
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

  // Audio + file: solo nelle chat private (DM). I file solo allo staff.
  const isStaff = userRole === 'coach' || userRole === 'mental_coach' || userRole === 'admin'
  const canAttachFile = isDirect && isStaff
  const showSend = !!input.trim() || !!imageFile || !!fileAttachment
  const showMic = isDirect && audioSupported && !showSend

  return (
    <div className="flex flex-col h-full relative">
      {/* Header — colore standard: bianco in chiaro, scuro in scuro (nav-bg) */}
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
        className="flex-1 overflow-y-auto px-4 py-4 lg:pb-28 no-scrollbar"
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

        {/* Caricamento dei messaggi precedenti (paginazione all'indietro) */}
        {loadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} />
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
                  {/* Avatar — solo per i messaggi ALTRUI; i miei non mostrano la mia foto */}
                  {!group.own && (
                    <button
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 self-end overflow-hidden transition-opacity hover:opacity-80 active:opacity-60"
                      onClick={(e) => {
                        e.stopPropagation()
                        onShowUserCard({ userId: group.authorId, name: group.author, role: group.authorRole, avatar: authorAvatars[group.authorId] })
                      }}
                    >
                      {(() => {
                        const a = authorAvatars[group.authorId]
                        if (a?.avatarUrl || a?.avatarPreset) {
                          return <UserAvatar user={{ name: a.name || group.author, avatarUrl: a.avatarUrl, avatarPreset: a.avatarPreset }} size={28} />
                        }
                        // Fallback: iniziale su gradiente per ruolo
                        return (
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ background: DM_AVATAR_GRADIENT[group.authorRole] ?? 'var(--ist-w12)' }}
                          >
                            {group.author.charAt(0)}
                          </span>
                        )
                      })()}
                    </button>
                  )}

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
                                    boxShadow: 'var(--ist-bubble-shadow)',
                                    borderRadius: mi === 0
                                      ? (isLastInGroup ? '18px 4px 18px 18px' : '18px 18px 4px 18px')
                                      : (isLastInGroup ? '4px 4px 18px 18px' : '4px 18px 4px 4px'),
                                    wordBreak: 'break-word',
                                  }
                                  : {
                                    background: 'var(--ist-bubble-other-bg)',
                                    color: 'var(--ist-text)',
                                    boxShadow: 'var(--ist-bubble-shadow)',
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
                                {msg.fullMsg.audio_url && (
                                  <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                                    <VoiceMessage
                                      id={msg.id}
                                      url={msg.fullMsg.audio_url}
                                      duration={msg.fullMsg.audio_duration_sec ?? 0}
                                      own={group.own}
                                    />
                                  </div>
                                )}
                                {msg.fullMsg.file_url && (
                                  <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                                    <FileAttachment
                                      url={msg.fullMsg.file_url}
                                      name={msg.fullMsg.file_name ?? 'File'}
                                      size={msg.fullMsg.file_size ?? 0}
                                      own={group.own}
                                    />
                                  </div>
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

                          {/* Tastino di risposta preimpostata al benvenuto (solo al destinatario) */}
                          {msg.fullMsg.kind === 'welcome' && msg.fullMsg.target_user_id === userId && canPost && !hasRepliedWelcome && (
                            <div className={`flex mt-2 ${group.own ? 'justify-end' : 'justify-start'}`}>
                              <button
                                onClick={() => sendToDb(WELCOME_REPLY, userName, userRole)}
                                className="px-3.5 py-2 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.03] active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', color: 'white', boxShadow: '0 4px 14px rgba(40,102,128,0.35)' }}
                              >
                                👋 {WELCOME_REPLY}
                              </button>
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
          className="flex flex-col gap-2 px-3 pt-3 flex-shrink-0 border-t z-20 lg:border lg:border-t lg:rounded-[26px] lg:absolute lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-[min(680px,calc(100%-2.5rem))] lg:shadow-[0_14px_44px_rgba(0,0,0,0.28)]"
          style={{
            borderColor: 'var(--ist-composer-border)',
            background: 'var(--ist-composer-bg)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            // Tastiera aperta: gap fisso di 12px sopra la tastiera (su Android
            // keyboardInset=0 perché il WebView si ridimensiona già; su iOS = altezza
            // tastiera). A riposo: distanza FISSA dal bordo inferiore (min 36px) così la
            // barra non finisce sotto i tasti di sistema Android, dove env(safe-area) può
            // valere 0. Se serve più/meno spazio, cambiare il 36.
            paddingBottom: keyboardOpen
              ? (keyboardInset > 0 ? keyboardInset + 12 : 12)
              : 'max(env(safe-area-inset-bottom, 0px), 36px)',
          }}
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

          {/* Anteprima file selezionato (documento, solo staff) */}
          {fileAttachment && (
            <div className="relative self-start flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)' }}>
              <FileText size={16} strokeWidth={2} style={{ color: 'var(--ist-accent-text)' }} />
              <span className="text-xs max-w-[200px] truncate" style={{ color: 'var(--ist-text)' }}>{fileAttachment.name}</span>
              <button
                onClick={() => setFileAttachment(null)}
                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
                title="Rimuovi file"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {recorder.recording && recLocked ? (
            /* Registrazione BLOCCATA (hands-free): annulla · timer · invia */
            <div className="flex items-center gap-3">
              <button
                onClick={cancelAudio}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
                style={{ background: 'var(--ist-w8)', color: '#FF6B7A' }}
                title="Annulla"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
              <div className="flex-1 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#FF6B7A' }} />
                <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--ist-text)' }}>{formatDuration(recorder.elapsedMs)}</span>
                <span className="text-xs" style={{ color: 'var(--ist-text-dim)' }}>registrazione…</span>
              </div>
              <button
                onClick={finishAndSendAudio}
                disabled={uploading}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', boxShadow: '0 4px 16px rgba(40,102,128,0.36)' }}
                title="Invia vocale"
              >
                {uploading
                  ? <Loader2 size={15} strokeWidth={2} data-inverted className="text-white animate-spin" />
                  : <Send size={15} strokeWidth={2} data-inverted className="text-white -translate-x-[1px]" />}
              </button>
            </div>
          ) : (
            <div className="relative flex items-center gap-2">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              {canAttachFile && (
                <input ref={fileInputRef} type="file" accept={CHAT_FILE_ACCEPT} className="hidden" onChange={pickFile} />
              )}
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:brightness-110"
                style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
                title="Allega immagine"
              >
                <ImagePlus size={17} strokeWidth={2} />
              </button>
              {canAttachFile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:brightness-110"
                  style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}
                  title="Allega file"
                >
                  <Paperclip size={17} strokeWidth={2} />
                </button>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                placeholder=""
                rows={1}
                className="flex-1 resize-none px-4 py-1.5 text-sm focus:outline-none no-scrollbar"
                style={{ background: 'var(--ist-input-surface)', border: '1px solid var(--ist-input-border)', borderRadius: inputTall ? 18 : 9999, transition: 'border-radius 120ms ease', color: 'var(--ist-text)', maxHeight: 120, lineHeight: 1.5 }}
              />
              {showMic ? (
                <button
                  onPointerDown={onMicPointerDown}
                  onPointerMove={onMicPointerMove}
                  onPointerUp={onMicPointerUp}
                  onPointerCancel={onMicPointerCancel}
                  onLostPointerCapture={onMicPointerCancel}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:brightness-110 hover:-translate-y-0.5 select-none touch-none"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', color: 'white', boxShadow: '0 4px 16px rgba(40,102,128,0.36)' }}
                  title="Tieni premuto per registrare un vocale"
                >
                  <Mic size={18} strokeWidth={2} data-inverted className="text-white" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!showSend || uploading}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #5A9AB1 0%, #286680 100%)', boxShadow: '0 4px 16px rgba(40,102,128,0.36)' }}
                >
                  {uploading
                    ? <Loader2 size={15} strokeWidth={2} data-inverted className="text-white animate-spin" />
                    : <Send size={15} strokeWidth={2} data-inverted className="text-white -translate-x-[1px]" />}
                </button>
              )}

              {/* Overlay mentre si tiene premuto il mic (il bottone ha il pointer capture) */}
              {recorder.recording && !recLocked && (
                <div
                  className="absolute inset-0 flex items-center gap-2 rounded-2xl px-3"
                  style={{ background: 'var(--ist-composer-bg)', pointerEvents: 'none' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#FF6B7A' }} />
                  <span className="text-sm font-medium tabular-nums" style={{ color: recCancelArmed ? '#FF6B7A' : 'var(--ist-text)' }}>
                    {formatDuration(recorder.elapsedMs)}
                  </span>
                  <span className="flex-1 text-xs flex items-center justify-end gap-1 text-right" style={{ color: recCancelArmed ? '#FF6B7A' : 'var(--ist-text-dim)' }}>
                    <Trash2 size={13} strokeWidth={2} />
                    {recCancelArmed ? 'Rilascia per annullare' : '‹ scorri per annullare · ↑ blocca'}
                  </span>
                </div>
              )}

              {/* Suggerimento se il tap è troppo breve */}
              {micHint && (
                <div
                  className="absolute right-0 -top-10 px-3 py-1.5 rounded-xl text-[11px] whitespace-nowrap"
                  style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)', color: 'var(--ist-text-muted)', boxShadow: '0 4px 14px rgba(0,0,0,0.30)' }}
                >
                  Tieni premuto per registrare
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex items-center justify-center gap-2 px-4 pt-3 flex-shrink-0 border-t z-20 lg:border lg:border-t lg:rounded-[26px] lg:absolute lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-[min(680px,calc(100%-2.5rem))] lg:shadow-[0_14px_44px_rgba(0,0,0,0.28)]"
          style={{
            borderColor: 'var(--ist-composer-border)',
            background: 'var(--ist-composer-bg)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            paddingBottom: keyboardOpen ? 12 : 'max(env(safe-area-inset-bottom, 0px), 36px)',
          }}
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
  canManage,
  onDelete,
  onTogglePin,
}: {
  post: BachecaPost
  canManage: boolean
  onDelete: () => void
  onTogglePin: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  return (
    <div
      className="rounded-3xl p-4 flex flex-col gap-3"
      style={{
        background: 'var(--ist-card-bg)',
        border: post.pinned ? '1px solid rgba(124,187,208,0.35)' : '1px solid var(--ist-border)',
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
          {post.author.charAt(0).toUpperCase()}
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
            {formatDate(post.createdAt)} alle {formatTime(post.createdAt)}
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

      {canManage && (
        <div className="flex items-center gap-2 pt-2 flex-wrap" style={{ borderTop: '1px solid var(--ist-w8)' }}>
          <button
            onClick={onTogglePin}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all"
            style={post.pinned
              ? { background: 'rgba(124,187,208,0.18)', color: 'var(--ist-accent-text)', border: '1px solid rgba(124,187,208,0.30)' }
              : { background: 'var(--ist-w6)', color: 'var(--ist-text-muted)', border: '1px solid var(--ist-w9)' }
            }
          >
            <Pin size={11} strokeWidth={2.5} />
            {post.pinned ? 'Togli evidenza' : 'Metti in evidenza'}
          </button>
          {confirmDel ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[11px]" style={{ color: 'var(--ist-text-muted)' }}>Eliminare?</span>
              <button onClick={onDelete} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(255,107,122,0.15)', color: '#FF6B7A' }}>Sì</button>
              <button onClick={() => setConfirmDel(false)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>No</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all"
              style={{ background: 'rgba(255,107,122,0.08)', color: '#FF6B7A', border: '1px solid rgba(255,107,122,0.15)' }}
            >
              <Trash2 size={11} strokeWidth={2} />
              Elimina
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── bacheca compose modal ────────────────────────────────────────────────────

function BachecaComposeModal({
  channelName,
  onClose,
  onPublish,
}: {
  channelName: string
  onClose: () => void
  onPublish: (input: NewBachecaPost) => Promise<boolean>
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tag, setTag] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = {
    background: 'var(--ist-w6)', border: '1px solid var(--ist-w10)', color: 'var(--ist-text)',
  }

  const publish = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    const ok = await onPublish({ title, content, tag, pinned })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--ist-nav-bg)', border: '1px solid var(--ist-nav-border)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--ist-w8)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--ist-text)' }}>Pubblica in #{channelName}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto no-scrollbar">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Titolo (opzionale)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Sessione live di giovedì" className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Messaggio *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Scrivi l'annuncio…" className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none resize-none no-scrollbar" style={{ ...inputStyle, lineHeight: 1.5 }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ist-text-muted)' }}>Etichetta (opzionale)</label>
            <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Es. Evento, Importante…" className="w-full px-3.5 py-2.5 text-sm rounded-2xl focus:outline-none" style={inputStyle} />
          </div>
          <label className="flex items-center gap-2.5 px-1 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-ist-400 w-4 h-4 rounded" />
            <span className="text-xs" style={{ color: 'var(--ist-text-muted)' }}>Metti in evidenza (in cima alla bacheca)</span>
          </label>
        </div>

        <div className="flex gap-3 px-5 py-4" style={{ borderTop: '1px solid var(--ist-w8)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-2xl" style={{ background: 'var(--ist-w8)', color: 'var(--ist-text-muted)' }}>Annulla</button>
          <button onClick={publish} disabled={!content.trim() || saving} className="flex-1 py-2.5 text-sm font-semibold rounded-2xl text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #5A9AB1, #286680)', boxShadow: '0 4px 14px rgba(40,102,128,0.30)' }}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Pubblica
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── bacheca area ─────────────────────────────────────────────────────────────

function BachecaArea({
  channel,
  userRole,
  userId,
  userName,
  onBack,
  isMobile,
}: {
  channel: Channel
  userRole: MemberRole
  userId: string
  userName: string
  onBack?: () => void
  isMobile?: boolean
}) {
  const { posts, loading, createPost, deletePost, togglePin } = useBachecaPosts(channel.id, userId)
  const [composing, setComposing] = useState(false)
  const canPost = channel.canPost.includes(userRole)
  const isAdmin = userRole === 'admin'

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
        {canPost && (
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5 flex-shrink-0 text-white"
            style={{
              background: 'linear-gradient(135deg, #5A9AB1, #286680)',
              boxShadow: '0 4px 14px rgba(40,102,128,0.30)',
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Pubblica
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ist-text-dim)' }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Megaphone size={32} style={{ color: 'var(--ist-text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--ist-text-dim)' }}>
              {canPost ? 'Nessun post ancora. Pubblica il primo!' : 'Nessun post ancora'}
            </p>
          </div>
        ) : (
          posts.map(post => (
            <BachecaPostCard
              key={post.id}
              post={post}
              canManage={isAdmin || post.authorId === userId}
              onDelete={() => deletePost(post.id)}
              onTogglePin={() => togglePin(post.id, !post.pinned)}
            />
          ))
        )}
      </div>

      {composing && (
        <BachecaComposeModal
          channelName={channel.name}
          onClose={() => setComposing(false)}
          onPublish={(input) => createPost(input, userName, userRole)}
        />
      )}
    </div>
  )
}

// Fa combaciare il contenitore della chat con l'AREA REALMENTE VISIBILE quando
// la tastiera è aperta, così la barra di scrittura resta appena sopra la tastiera.
// `kbOpen` è rilevato dal FOCUS su un campo di testo: nella PWA standalone iOS il
// webview si ridimensiona insieme alla tastiera (innerHeight cala con lei), quindi
// confrontare le altezze non basta — un input a fuoco = tastiera su. Le misure
// top/height arrivano da VisualViewport (aggiornate mentre la tastiera anima).
function useVisibleViewport() {
  const [vp, setVp] = useState<{ top: number; height: number; kbOpen: boolean } | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    let focused = false
    const isEditable = (el: EventTarget | null): boolean => {
      const n = el as HTMLElement | null
      return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable)
    }
    const measure = () => setVp({
      top: vv ? Math.round(vv.offsetTop) : 0,
      height: vv ? Math.round(vv.height) : window.innerHeight,
      kbOpen: focused,
    })
    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return
      focused = true
      measure()
      // ri-misura mentre la tastiera anima (VisualViewport aggiorna con ritardo)
      setTimeout(measure, 120)
      setTimeout(measure, 320)
    }
    const onFocusOut = () => { focused = false; measure() }
    measure()
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  return vp
}

// Altezza della tastiera NATIVA (app Capacitor). Con Keyboard resize:'none' il
// webview non si ridimensiona e VisualViewport non "vede" la tastiera → l'altezza
// va presa dagli eventi del plugin. Sul web resta 0 (lì si usa VisualViewport).
function useNativeKeyboardHeight() {
  const [h, setH] = useState(0)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handles: { remove: () => void }[] = []
    Keyboard.addListener('keyboardWillShow', (info) => setH(info.keyboardHeight)).then((l) => handles.push(l))
    Keyboard.addListener('keyboardWillHide', () => setH(0)).then((l) => handles.push(l))
    return () => { handles.forEach((l) => l.remove()) }
  }, [])
  return h
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth()
  const { setHideBottomNav } = useUI()
  const vp = useVisibleViewport()
  const nativeKbHeight = useNativeKeyboardHeight()
  const location = useLocation()
  const navigate = useNavigate()
  const userRole = (user?.role ?? 'student') as MemberRole
  const userId = user?.id ?? ''
  const userName = user?.name ?? ''

  // L'utente gratuito ha chat private SOLO con gli admin (contatto per l'upgrade).
  const isFree = isFreeUser(user)
  const dmUsersAll = useDmUsers(userId, userRole)
  const dmUsers = isFree ? dmUsersAll.filter(u => u.role === 'admin') : dmUsersAll
  const { channels } = useChannels()
  const [searchParams] = useSearchParams()

  const visibleChannels = channels.filter(ch => ch.roles.includes(userRole))
  // Deep-link da notifica push: /student/chat?c=<channelId> apre quel canale/DM.
  const [activeChannelId, setActiveChannelId] = useState(
    () => new URLSearchParams(location.search).get('c') || (isFree ? 'free-community' : 'generale')
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

  // Gestisce apertura DM da navigazione esterna: navigate('/student/chat', { state: { openDm: userId } }).
  // Supporta anche `prefill` (testo iniziale) e `knownUser` (per risolvere il partner
  // se non è in dmUsers) — usati dal "Richiedi l'accesso completo" verso l'admin.
  const navState = location.state as {
    openDm?: string; tab?: 'direct' | 'groups'
    prefill?: string; knownUser?: { id: string; name: string; role: MemberRole }
  } | null
  const [prefill, setPrefill] = useState<{ channelId: string; text: string } | null>(null)
  const [initialNavHandled, setInitialNavHandled] = useState(false)
  useEffect(() => {
    if (initialNavHandled || !navState) return
    setInitialNavHandled(true)
    navigate(location.pathname, { replace: true, state: null }) // pulisce lo state dall'history

    if (navState.openDm && userId) {
      const ch = dmChannelId(userId, navState.openDm)
      if (navState.knownUser) {
        const ku = navState.knownUser
        setKnownUsers(prev => ({ ...prev, [ku.id]: { name: ku.name, role: ku.role } }))
      }
      if (navState.prefill) setPrefill({ channelId: ch, text: navState.prefill })
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

  // Edge-swipe (mobile): tocco che parte dal bordo SINISTRO (~28px) e scorre
  // verso destra → torna alla lista chat. Si arma solo sul bordo per non
  // interferire con scroll/interazioni interne; soglia dx>70 e prevalenza
  // orizzontale per evitare falsi positivi.
  const edgeSwipe = useRef<{ x: number; y: number; armed: boolean } | null>(null)
  const onAreaTouchStart = (e: React.TouchEvent) => {
    if (mobileView !== 'chat') { edgeSwipe.current = null; return }
    const t = e.touches[0]
    edgeSwipe.current = { x: t.clientX, y: t.clientY, armed: t.clientX <= 28 }
  }
  const onAreaTouchEnd = (e: React.TouchEvent) => {
    const s = edgeSwipe.current
    edgeSwipe.current = null
    if (!s || !s.armed) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) goBack()
  }

  // App nativa (Keyboard resize:'none' → il webview NON si ridimensiona e
  // VisualViewport non vede la tastiera): l'altezza arriva dagli eventi del plugin.
  // iOS (resize:'none' + contentInset:'never'): il WebView NON si ridimensiona con la
  // tastiera → il container resta a schermo pieno e la barra va "alzata" con un padding
  // pari alla tastiera (dipingendo il proprio colore dietro → niente striscia scura).
  // Web/PWA: nativeKbHeight=0 → ramo VisualViewport (height area visibile).
  // ANDROID: il WebView SI ridimensiona con la tastiera (verificato anche sui device
  // reali: la barra "schizzava in alto ~2×" con keyboardInset=nativeKbHeight = DOPPIA
  // compensazione). Quindi su Android inset=0: il sistema alza già la barra sopra la
  // tastiera, basta il gap fisso di 12px del ramo keyboardOpen. iOS invece NON
  // ridimensiona (resize:'none'+contentInset:'never') → serve il lift = altezza tastiera.
  const nativeKb = nativeKbHeight > 0
  const keyboardInset = Capacitor.getPlatform() === 'android' ? 0 : nativeKbHeight

  return (
    <div className="flex overflow-hidden fixed inset-0 z-10" style={{ background: 'var(--ist-nav-bg)', paddingTop: 'env(safe-area-inset-top, 0px)', ...(vp?.kbOpen && !nativeKb ? { top: vp.top, height: vp.height, bottom: 'auto' } : null) }}>
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
        onTouchStart={onAreaTouchStart}
        onTouchEnd={onAreaTouchEnd}
      >
        {activeChannel?.type === 'bacheca' && activeGroupChannel ? (
          <BachecaArea
            channel={activeGroupChannel}
            userRole={userRole}
            userId={userId}
            userName={userName}
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
            keyboardInset={keyboardInset}
            initialInput={prefill?.channelId === activeChannelId ? prefill.text : undefined}
            keyboardOpen={(vp?.kbOpen ?? false) || nativeKb}
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
          canDm={userCard.userId !== userId && (!isFree || userCard.role === 'admin')}
          onStartDm={() => { const ch = dmChannelId(userId, userCard.userId); selectChannel(ch) }}
          onClose={() => setUserCard(null)}
        />
      )}
    </div>
  )
}
