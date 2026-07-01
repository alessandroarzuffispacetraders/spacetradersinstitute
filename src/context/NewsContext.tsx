import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { normalizeRoles } from '../router/navConfig'
import { useChannels } from '../lib/channels'
import { useDmUsers, dmChannelId } from '../lib/chat'

// Novità per sezione → pallino rosso sulle icone di navigazione.
interface NewsState {
  chatNews: boolean
  flagNews: boolean
  liveNews: boolean
  compitiCoachNews: boolean
  compitiStudentNews: boolean
  hasNews: (path: string) => boolean
}

const NewsContext = createContext<NewsState>({
  chatNews: false,
  flagNews: false,
  liveNews: false,
  compitiCoachNews: false,
  compitiStudentNews: false,
  hasNews: () => false,
})

export function useNews() {
  return useContext(NewsContext)
}

// Pallino rosso riutilizzabile (va dentro un contenitore position:relative).
export function NewsDot() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: -2,
        right: -2,
        width: 9,
        height: 9,
        borderRadius: 9999,
        background: '#FF4D5E',
        boxShadow: '0 0 0 2px var(--ist-nav-bg)',
      }}
    />
  )
}

// ─── Watcher chat: canali gruppo + DM, "c'è almeno un non letto?" ──────────────
function ChatUnreadWatcher({
  userId,
  role,
  onChange,
}: {
  userId: string
  role: Parameters<typeof useDmUsers>[1]
  onChange: (b: boolean) => void
}) {
  const { channels } = useChannels()
  const dmUsers = useDmUsers(userId, role)

  // Solo i canali di gruppo "veri" (esclusi bacheca e le chat delle live `live_*`).
  const groupIds = channels.filter(c => c.type === 'chat' && !c.id.startsWith('live_')).map(c => c.id)
  const dmIds = dmUsers.map(u => dmChannelId(userId, u.id))
  const channelIds = [...groupIds, ...dmIds]
  const idsKey = channelIds.join(',')

  const refetch = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : []
    if (!userId || ids.length === 0) { onChange(false); return }

    const { data: reads } = await supabase
      .from('channel_reads')
      .select('channel_id, last_read_at')
      .eq('user_id', userId)

    const readMap: Record<string, string> = {}
    for (const r of reads ?? []) readMap[r.channel_id] = r.last_read_at

    const baseline = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const counts = await Promise.all(
      ids.map(async (chId) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', chId)
          .neq('user_id', userId)
          .gt('created_at', readMap[chId] ?? baseline)
        return count ?? 0
      })
    )
    onChange(counts.some(n => n > 0))
  }, [userId, idsKey, onChange])

  // Caricamento iniziale + quando cambia la lista canali.
  useEffect(() => { refetch() }, [refetch])

  // Un nuovo messaggio in un canale tracciato (non mio) → accende subito il pallino.
  useEffect(() => {
    if (!userId) return
    const tracked = new Set(idsKey ? idsKey.split(',') : [])
    const sub = supabase
      .channel('news:unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as { user_id: string; channel_id: string }
        if (msg.user_id === userId) return
        if (!tracked.has(msg.channel_id)) return
        onChange(true)
      })
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [userId, idsKey, onChange])

  // Quando un canale viene segnato come letto (in ChatPage) → ricontrolla e spegni.
  // Debounce: cambi rapidi di canale non scatenano una raffica di query.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    const handler = () => {
      if (t) clearTimeout(t)
      t = setTimeout(() => refetch(), 500)
    }
    window.addEventListener('ist:channel-read', handler)
    return () => {
      if (t) clearTimeout(t)
      window.removeEventListener('ist:channel-read', handler)
    }
  }, [refetch])

  return null
}

// ─── Watcher segnalazioni: flag non risolti ───────────────────────────────────
function FlagWatcher({
  mode,
  userId,
  onChange,
}: {
  mode: 'admin' | 'incoming'
  userId: string
  onChange: (b: boolean) => void
}) {
  const load = useCallback(async () => {
    let q = supabase
      .from('student_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false)
    if (mode === 'incoming') q = q.eq('recipient_id', userId)
    const { count } = await q
    onChange((count ?? 0) > 0)
  }, [mode, userId, onChange])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const sub = supabase
      .channel('news:flags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_flags' }, () => load())
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  return null
}

// ─── Watcher live: c'è una diretta "in corso" (status='live')? ────────────────
function LiveWatcher({ onChange }: { onChange: (b: boolean) => void }) {
  const load = useCallback(async () => {
    const { count } = await supabase
      .from('live_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live')
    onChange((count ?? 0) > 0)
  }, [onChange])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const sub = supabase
      .channel('news:live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_events' }, () => load())
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  return null
}

// ─── Watcher compiti (coach): consegne da rivedere (submission 'pending') ──────
function CompitiCoachWatcher({ coachId, onChange }: { coachId: string; onChange: (b: boolean) => void }) {
  const load = useCallback(async () => {
    const { count } = await supabase
      .from('submissions')
      .select('id, assignments!inner(coach_id)', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('assignments.coach_id', coachId)
    onChange((count ?? 0) > 0)
  }, [coachId, onChange])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const sub = supabase
      .channel('news:submissions-coach')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => load())
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [load])

  return null
}

// ─── Watcher compiti (studente): nuovo feedback dal coach non ancora visto ─────
function CompitiStudentWatcher({ userId, onChange }: { userId: string; onChange: (b: boolean) => void }) {
  const seenKey = 'ist_compiti_seen_' + userId

  const check = useCallback(async () => {
    const { data } = await supabase
      .from('submissions')
      .select('reviewed_at')
      .eq('status', 'reviewed')
      .order('reviewed_at', { ascending: false })
      .limit(1)
    const latest = data?.[0]?.reviewed_at as string | undefined
    if (!latest) { onChange(false); return }
    const seen = localStorage.getItem(seenKey)
    onChange(!seen || new Date(latest).getTime() > new Date(seen).getTime())
  }, [seenKey, onChange])

  useEffect(() => { check() }, [check])

  useEffect(() => {
    const sub = supabase
      .channel('news:submissions-student')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => check())
      .subscribe()
    const onSeen = () => check()
    window.addEventListener('ist:compiti-seen', onSeen)
    return () => {
      sub.unsubscribe()
      window.removeEventListener('ist:compiti-seen', onSeen)
    }
  }, [check])

  return null
}

export function NewsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [chatNews, setChatNews] = useState(false)
  const [flagNews, setFlagNews] = useState(false)
  const [liveNews, setLiveNews] = useState(false)
  const [compitiCoachNews, setCompitiCoachNews] = useState(false)
  const [compitiStudentNews, setCompitiStudentNews] = useState(false)

  const roles = user ? normalizeRoles(user.role, user.roles) : []
  const flagMode: 'admin' | 'incoming' | 'none' = roles.includes('admin')
    ? 'admin'
    : roles.includes('coach') || roles.includes('mental_coach')
      ? 'incoming'
      : 'none'
  const isCoach = roles.includes('coach')

  const hasNews = useCallback(
    (path: string) => {
      // La chat "di lettura" è la Community (/student/chat); /admin/chat è gestione canali.
      if (path.endsWith('/chat') && path !== '/admin/chat') return chatNews
      if (path.endsWith('/segnalazioni')) return flagNews
      if (path.endsWith('/live')) return liveNews
      if (path === '/coach/review') return compitiCoachNews       // Compiti (coach): nuove consegne
      if (path === '/student/compiti') return compitiStudentNews  // Compiti (studente): nuovo feedback
      return false
    },
    [chatNews, flagNews, liveNews, compitiCoachNews, compitiStudentNews]
  )

  return (
    <NewsContext.Provider
      value={{ chatNews, flagNews, liveNews, compitiCoachNews, compitiStudentNews, hasNews }}
    >
      {user && <ChatUnreadWatcher userId={user.id} role={user.role} onChange={setChatNews} />}
      {user && <LiveWatcher onChange={setLiveNews} />}
      {user && <CompitiStudentWatcher userId={user.id} onChange={setCompitiStudentNews} />}
      {user && flagMode !== 'none' && (
        <FlagWatcher mode={flagMode} userId={user.id} onChange={setFlagNews} />
      )}
      {user && isCoach && <CompitiCoachWatcher coachId={user.id} onChange={setCompitiCoachNews} />}
      {children}
    </NewsContext.Provider>
  )
}
