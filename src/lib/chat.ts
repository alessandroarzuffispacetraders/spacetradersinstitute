import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { UserRole, UserTier } from '../types'
import { triggerPushNotifications } from './push'

export interface DbMessage {
  id: string
  channel_id: string
  user_id: string
  author_name: string
  author_role: UserRole
  content: string
  image_url?: string | null
  audio_url?: string | null           // vocale (bucket chat-media) — solo nei DM
  audio_duration_sec?: number | null  // durata del vocale in secondi
  file_url?: string | null            // allegato (documento/immagine) — solo staff, nei DM
  file_name?: string | null
  file_size?: number | null           // byte
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
  kind?: string | null            // 'welcome' = messaggio automatico di benvenuto
  target_user_id?: string | null  // destinatario del messaggio di sistema (es. benvenuto)
}

// Allegati opzionali di un messaggio (immagine inline, vocale, file).
export interface MessageMedia {
  imageUrl?: string | null
  audioUrl?: string | null
  audioDuration?: number | null
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
}

export interface DmUser {
  id: string
  name: string
  role: UserRole
  tier?: UserTier            // 'free' = utente gratuito; usato per separare i DM lato admin
  avatarUrl?: string
  avatarPreset?: string
}

// Per message: emoji → { count, reacted (did current user react?) }
export type ReactionMap = Record<string, Record<string, { count: number; reacted: boolean }>>

export function dmChannelId(uid1: string, uid2: string): string {
  return 'dm_' + [uid1, uid2].sort().join('_')
}

function buildReactions(
  data: { message_id: string; user_id: string; emoji: string }[],
  userId: string
): ReactionMap {
  const map: ReactionMap = {}
  for (const r of data) {
    if (!map[r.message_id]) map[r.message_id] = {}
    if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = { count: 0, reacted: false }
    map[r.message_id][r.emoji].count++
    if (r.user_id === userId) map[r.message_id][r.emoji].reacted = true
  }
  return map
}

// Quanti messaggi per pagina: all'ingresso i più recenti, poi altri blocchi
// "più vecchi" via loadMore() quando si scrolla in cima alla conversazione.
const MESSAGES_PAGE_SIZE = 50

export function useChatMessages(channelId: string | null, userId: string) {
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [hasMore, setHasMore] = useState(false)        // esistono messaggi più vecchi da caricare?
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)                 // guard sincrono anti doppio-fetch
  const msgIdsRef = useRef<Set<string>>(new Set())
  // Copia sincrona dei messaggi correnti: serve al "catch-up" (sotto) per sapere
  // qual è il più recente senza dover ricreare le callback ad ogni messaggio.
  const messagesRef = useRef<DbMessage[]>([])

  // keep refs in sync
  useEffect(() => {
    msgIdsRef.current = new Set(messages.map(m => m.id))
    messagesRef.current = messages
  }, [messages])

  // Carica le reazioni per un set di messaggi e le FONDE nella mappa esistente
  // (usato sia al primo load sia quando si aggiungono messaggi più vecchi).
  const loadReactions = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', ids)
      .then(({ data: rd }) => {
        if (rd) setReactions(prev => ({ ...prev, ...buildReactions(rd as any[], userId) }))
      })
  }, [userId])

  // Recupero "catch-up": rilegge dal server i messaggi PIÙ RECENTI di quelli che
  // abbiamo già e li fonde. Indispensabile sul NATIVO: quando iOS/iPadOS sospende
  // l'app la WebSocket realtime si chiude e i messaggi arrivati nel frattempo NON
  // vengono consegnati (postgres_changes non fa "backfill"). Al ritorno in primo
  // piano — o alla riconnessione del canale — l'app da sola non rileggeva niente,
  // così gli ultimi messaggi (sia ricevuti sia inviati da un altro device)
  // restavano invisibili anche riaprendo. Questo colma il buco.
  const catchUp = useCallback(async () => {
    if (!channelId) return
    // Il messaggio REALE (non ottimistico) più recente che abbiamo in lista.
    const list = messagesRef.current
    let newestAt: string | null = null
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].id.startsWith('temp_')) { newestAt = list[i].created_at; break }
    }
    const base = supabase.from('messages').select('*').eq('channel_id', channelId).is('deleted_at', null)
    // Con dei messaggi già in lista: prendi tutto ciò che è ≥ del più recente
    // (>= per non perdere messaggi con lo stesso timestamp; i doppioni si tolgono
    // per id). Lista vuota (es. socket mai connesso all'avvio): ricarica i più recenti.
    const { data, error } = newestAt
      ? await base.gte('created_at', newestAt).order('created_at', { ascending: true }).limit(300)
      : await base.order('created_at', { ascending: false }).limit(MESSAGES_PAGE_SIZE)
    if (error || !data) return
    const rows = data as DbMessage[]
    const ordered = newestAt ? rows : rows.slice().reverse()
    if (ordered.length === 0) return
    const added: DbMessage[] = []
    setMessages(prev => {
      const have = new Set(prev.map(m => m.id))
      const fresh = ordered.filter(m => !have.has(m.id))
      if (fresh.length === 0) return prev
      added.push(...fresh)
      // Come l'handler INSERT: togli gli ottimistici (temp_) rimpiazzati da un
      // messaggio reale appena riletto (stesso autore + contenuto), altrimenti si
      // vedrebbe il doppione del messaggio appena inviato.
      const freshKeys = new Set(fresh.map(m => `${m.user_id}|${m.content}`))
      const withoutTemp = prev.filter(m => !(m.id.startsWith('temp_') && freshKeys.has(`${m.user_id}|${m.content}`)))
      const merged = [...withoutTemp, ...fresh]
      merged.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      return merged
    })
    if (added.length) loadReactions(added.map(m => m.id))
  }, [channelId, loadReactions])

  useEffect(() => {
    if (!channelId) return

    setLoading(true)
    setMessages([])
    setReactions({})
    setHasMore(false)
    setLoadingMore(false)
    loadingMoreRef.current = false

    supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      // Prima pagina = i messaggi PIÙ RECENTI (ascending+limit prendeva invece i
      // più VECCHI: oltre la soglia la conversazione recente non si caricava più
      // all'ingresso → sembrava "sparita"). Ordina desc, poi riavvolgi sotto.
      // I più vecchi si caricano a blocchi con loadMore() scrollando in cima.
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE)
      .then(({ data, error }) => {
        if (error) console.warn('[chat] load messages error', error.message)
        if (!data) { setLoading(false); return }
        const rows = data as DbMessage[]
        // Pagina piena → probabilmente esistono altri messaggi più vecchi.
        setHasMore(rows.length === MESSAGES_PAGE_SIZE)
        // Rimetti in ordine cronologico (vecchio → nuovo) per la visualizzazione.
        const msgs = rows.slice().reverse()
        setMessages(msgs)
        setLoading(false)
        loadReactions(msgs.map(m => m.id))
      })

    // Message changes
    let subscribedOnce = false
    const msgSub = supabase
      .channel(`chat:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, (payload) => {
        const msg = payload.new as DbMessage
        if (msg.deleted_at) return
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          const withoutTemp = prev.filter(m => !(m.id.startsWith('temp_') && m.user_id === msg.user_id && m.content === msg.content))
          return [...withoutTemp, msg]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` }, (payload) => {
        const updated = payload.new as DbMessage
        if (updated.deleted_at) {
          setMessages(prev => prev.filter(m => m.id !== updated.id))
        } else {
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = (payload.old as { id: string }).id
        setMessages(prev => prev.filter(m => m.id !== id))
      })
      .subscribe((status) => {
        // Alla RI-connessione del canale (dopo un drop, es. rientro dal
        // background) colma l'eventuale buco: mentre il socket era giù i
        // postgres_changes non consegnano nulla e non c'è backfill. Il primo
        // SUBSCRIBED è quello iniziale (già coperto dal load): lo saltiamo.
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) catchUp()
          subscribedOnce = true
        }
      })

    // Reaction changes — no filter, filter client-side
    const reactSub = supabase
      .channel(`reactions:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        const { message_id, user_id, emoji } = payload.new as { message_id: string; user_id: string; emoji: string }
        // La reazione dell'utente corrente è già applicata ottimisticamente in
        // toggleReaction: ignora l'eco realtime per non contarla due volte.
        if (user_id === userId) return
        if (!msgIdsRef.current.has(message_id)) return
        setReactions(prev => {
          const cur = prev[message_id]?.[emoji] ?? { count: 0, reacted: false }
          return {
            ...prev,
            [message_id]: {
              ...(prev[message_id] ?? {}),
              [emoji]: { count: cur.count + 1, reacted: cur.reacted || user_id === userId },
            },
          }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const { message_id, user_id, emoji } = payload.old as { message_id: string; user_id: string; emoji: string }
        // Rimozione dell'utente corrente già applicata ottimisticamente: salta l'eco.
        if (user_id === userId) return
        if (!msgIdsRef.current.has(message_id)) return
        setReactions(prev => {
          const cur = prev[message_id]?.[emoji]
          if (!cur) return prev
          const newCount = Math.max(0, cur.count - 1)
          const updated = { ...prev[message_id] }
          if (newCount === 0) {
            delete updated[emoji]
          } else {
            updated[emoji] = { count: newCount, reacted: user_id === userId ? false : cur.reacted }
          }
          return { ...prev, [message_id]: updated }
        })
      })
      .subscribe()

    return () => {
      msgSub.unsubscribe()
      reactSub.unsubscribe()
    }
  }, [channelId, userId, loadReactions, catchUp])

  // Ritorno in primo piano / rete tornata online → colma i messaggi persi mentre
  // l'app era sospesa (vedi catchUp). Su iOS `visibilitychange` scatta quando la
  // WebView torna visibile; aggiungiamo anche focus/online per robustezza.
  useEffect(() => {
    if (!channelId) return
    const onVisible = () => { if (document.visibilityState === 'visible') catchUp() }
    const onOnline = () => catchUp()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [channelId, catchUp])

  // Carica un blocco di messaggi PIÙ VECCHI di quelli già in lista (paginazione
  // all'indietro): li antepone in ordine cronologico, deduplicando per id.
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !channelId) return
    const oldest = messages[0]
    if (!oldest) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE)
    loadingMoreRef.current = false
    setLoadingMore(false)
    if (error) { console.warn('[chat] load older error', error.message); return }
    if (!data) return
    const older = (data as DbMessage[]).slice().reverse()
    if (older.length < MESSAGES_PAGE_SIZE) setHasMore(false)
    if (older.length === 0) return
    setMessages(prev => {
      const have = new Set(prev.map(m => m.id))
      const fresh = older.filter(m => !have.has(m.id))
      return fresh.length ? [...fresh, ...prev] : prev
    })
    loadReactions(older.map(m => m.id))
  }, [channelId, hasMore, messages, loadReactions])

  const sendMessage = async (content: string, authorName: string, authorRole: UserRole, media?: MessageMedia) => {
    const trimmed = content.trim()
    const { imageUrl, audioUrl, audioDuration, fileUrl, fileName, fileSize } = media ?? {}
    if (!channelId || !userId || (!trimmed && !imageUrl && !audioUrl && !fileUrl)) return
    const tempId = `temp_${Date.now()}`
    const optimistic: DbMessage = {
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      content: trimmed,
      image_url: imageUrl ?? null,
      audio_url: audioUrl ?? null,
      audio_duration_sec: audioDuration ?? null,
      file_url: fileUrl ?? null,
      file_name: fileName ?? null,
      file_size: fileSize ?? null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      content: trimmed,
      image_url: imageUrl ?? null,
      audio_url: audioUrl ?? null,
      audio_duration_sec: audioDuration ?? null,
      file_url: fileUrl ?? null,
      file_name: fileName ?? null,
      file_size: fileSize ?? null,
    })
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      return
    }
    // Anteprima notifica: testo se presente, altrimenti il tipo di allegato.
    const preview = trimmed
      || (audioUrl ? '🎤 Messaggio vocale' : fileUrl ? `📎 ${fileName ?? 'File'}` : imageUrl ? '📷 Foto' : '')
    triggerPushNotifications({ channel_id: channelId, user_id: userId, author_name: authorName, content: preview })
  }

  const editMessage = useCallback(async (id: string, content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: trimmed, edited_at: new Date().toISOString() } : m))
    await supabase.from('messages').update({ content: trimmed, edited_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const deleteMessage = useCallback(async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('messages').delete().eq('id', id)
  }, [])

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return
    const alreadyReacted = reactions[messageId]?.[emoji]?.reacted ?? false
    if (alreadyReacted) {
      setReactions(prev => {
        const cur = prev[messageId]?.[emoji]
        if (!cur) return prev
        const updated = { ...prev[messageId] }
        if (cur.count <= 1) delete updated[emoji]
        else updated[emoji] = { count: cur.count - 1, reacted: false }
        return { ...prev, [messageId]: updated }
      })
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
    } else {
      setReactions(prev => ({
        ...prev,
        [messageId]: {
          ...(prev[messageId] ?? {}),
          [emoji]: { count: (prev[messageId]?.[emoji]?.count ?? 0) + 1, reacted: true },
        },
      }))
      await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id,emoji' })
    }
  }, [userId, reactions])

  return { messages, loading, reactions, hasMore, loadingMore, loadMore, sendMessage, editMessage, deleteMessage, toggleReaction }
}

// Typing indicator via Supabase Broadcast
export function useTypingIndicator(channelId: string | null, userId: string, userName: string) {
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!channelId || !userId) return

    const ch = supabase.channel(`typing:${channelId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { uid, name, isTyping } = payload as { uid: string; name: string; isTyping: boolean }
        if (uid === userId) return
        if (timeoutsRef.current[uid]) clearTimeout(timeoutsRef.current[uid])
        if (isTyping) {
          setTypingUsers(prev => prev.includes(name) ? prev : [...prev, name])
          timeoutsRef.current[uid] = setTimeout(() => {
            setTypingUsers(prev => prev.filter(n => n !== name))
          }, 4000)
        } else {
          setTypingUsers(prev => prev.filter(n => n !== name))
        }
      })
      .subscribe()

    channelRef.current = ch
    return () => {
      ch.unsubscribe()
      Object.values(timeoutsRef.current).forEach(clearTimeout)
    }
  }, [channelId, userId])

  const notifyTyping = useCallback(() => {
    if (!channelRef.current || !userId || !userName) return
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { uid: userId, name: userName, isTyping: true } })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { uid: userId, name: userName, isTyping: false } })
    }, 3000)
  }, [userId, userName])

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { uid: userId, name: userName, isTyping: false } })
  }, [userId, userName])

  return { typingUsers, notifyTyping, stopTyping }
}

export function useUnreadCounts(
  userId: string,
  channelIds: string[],
  activeChannelId: string | null
) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const channelIdsKey = channelIds.join(',')
  const activeRef = useRef(activeChannelId)

  useEffect(() => {
    activeRef.current = activeChannelId
  }, [activeChannelId])

  useEffect(() => {
    if (!userId || channelIds.length === 0) return

    async function load() {
      const { data: reads } = await supabase
        .from('channel_reads')
        .select('channel_id, last_read_at')
        .eq('user_id', userId)

      const readMap: Record<string, string> = {}
      for (const r of reads ?? []) readMap[r.channel_id] = r.last_read_at

      const baseline = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const results = await Promise.all(
        channelIds.map(async (chId) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', chId)
            .neq('user_id', userId)
            .gt('created_at', readMap[chId] ?? baseline)
          return [chId, count ?? 0] as const
        })
      )

      setCounts(Object.fromEntries(results))
    }

    load()
  }, [userId, channelIdsKey])

  useEffect(() => {
    if (!userId) return

    const sub = supabase
      .channel('unread-tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as DbMessage
        if (msg.user_id === userId) return
        if (!channelIds.includes(msg.channel_id)) return

        if (msg.channel_id === activeRef.current) {
          await supabase.from('channel_reads').upsert(
            { user_id: userId, channel_id: msg.channel_id, last_read_at: new Date().toISOString() },
            { onConflict: 'user_id,channel_id' }
          )
          window.dispatchEvent(new CustomEvent('ist:channel-read'))
        } else {
          setCounts(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] ?? 0) + 1 }))
        }
      })
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [userId, channelIdsKey])

  const markRead = useCallback(async (channelId: string) => {
    if (!userId || !channelId) return
    setCounts(prev => ({ ...prev, [channelId]: 0 }))
    await supabase.from('channel_reads').upsert(
      { user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,channel_id' }
    )
    window.dispatchEvent(new CustomEvent('ist:channel-read'))
  }, [userId])

  return { counts, markRead }
}

export interface AuthorAvatar {
  name: string
  avatarUrl?: string
  avatarPreset?: string
}

// Risolve nome + avatar (foto o preset) degli autori dei messaggi, per user_id,
// così accanto ai messaggi in chat compare la foto profilo reale.
export function useAuthorAvatars(userIds: string[]): Record<string, AuthorAvatar> {
  const [map, setMap] = useState<Record<string, AuthorAvatar>>({})
  const key = Array.from(new Set(userIds.filter(Boolean))).sort().join(',')

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length === 0) return
    let cancelled = false
    supabase
      .from('profiles_public')
      .select('id, name, avatar_url, avatar_preset')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled || !data) return
        const next: Record<string, AuthorAvatar> = {}
        for (const p of data as { id: string; name: string; avatar_url: string | null; avatar_preset: string | null }[]) {
          next[p.id] = { name: p.name, avatarUrl: p.avatar_url ?? undefined, avatarPreset: p.avatar_preset ?? undefined }
        }
        setMap(next)
      })
    return () => { cancelled = true }
  }, [key])

  return map
}

export function useDmUsers(currentUserId: string, currentRole: UserRole) {
  const [users, setUsers] = useState<DmUser[]>([])

  useEffect(() => {
    if (!currentUserId) return

    // Rubrica: solo colonne non sensibili via `profiles_public` (id/name/role/
    // avatar). L'admin, che separa i DM per tier (paganti vs gratuiti), legge il
    // tier dalla tabella base (ha accesso completo); gli altri ruoli non vedono
    // il tier altrui. Tutti possono scrivere a tutti: nessun filtro per ruolo.
    const isAdmin = currentRole === 'admin'
    const table = isAdmin ? 'profiles' : 'profiles_public'
    const cols = isAdmin
      ? 'id, name, role, tier, avatar_url, avatar_preset'
      : 'id, name, role, avatar_url, avatar_preset'
    supabase
      .from(table)
      .select(cols)
      .neq('id', currentUserId)
      .order('role')
      .then(({ data }) => {
        if (!data) return
        setUsers((data as unknown as { id: string; name: string; role: UserRole; tier?: UserTier | null; avatar_url: string | null; avatar_preset: string | null }[]).map(r => ({
          id: r.id,
          name: r.name,
          role: r.role,
          tier: r.tier ?? undefined,
          avatarUrl: r.avatar_url ?? undefined,
          avatarPreset: r.avatar_preset ?? undefined,
        })))
      })
  }, [currentUserId, currentRole])

  return users
}
