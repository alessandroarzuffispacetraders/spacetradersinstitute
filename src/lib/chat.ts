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
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
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

export function useChatMessages(channelId: string | null, userId: string) {
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [reactions, setReactions] = useState<ReactionMap>({})
  const msgIdsRef = useRef<Set<string>>(new Set())

  // keep msgIdsRef in sync
  useEffect(() => {
    msgIdsRef.current = new Set(messages.map(m => m.id))
  }, [messages])

  useEffect(() => {
    if (!channelId) return

    setLoading(true)
    setMessages([])
    setReactions({})

    supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const msgs = data as DbMessage[]
        setMessages(msgs)
        setLoading(false)

        if (msgs.length === 0) return
        supabase
          .from('message_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', msgs.map(m => m.id))
          .then(({ data: rd }) => {
            if (rd) setReactions(buildReactions(rd as any[], userId))
          })
      })

    // Message changes
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
      .subscribe()

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
  }, [channelId, userId])

  const sendMessage = async (content: string, authorName: string, authorRole: UserRole, imageUrl?: string | null) => {
    const trimmed = content.trim()
    if (!channelId || !userId || (!trimmed && !imageUrl)) return
    const tempId = `temp_${Date.now()}`
    const optimistic: DbMessage = {
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      content: trimmed,
      image_url: imageUrl ?? null,
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
    })
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      return
    }
    triggerPushNotifications({ channel_id: channelId, user_id: userId, author_name: authorName, content: trimmed || '📷 Foto' })
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

  return { messages, loading, reactions, sendMessage, editMessage, deleteMessage, toggleReaction }
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
