import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { UserRole } from '../types'
import { triggerPushNotifications } from './push'

export interface DbMessage {
  id: string
  channel_id: string
  user_id: string
  author_name: string
  author_role: UserRole
  content: string
  created_at: string
}

export interface DmUser {
  id: string
  name: string
  role: UserRole
}

// Genera un channel_id deterministico per una DM tra due utenti
export function dmChannelId(uid1: string, uid2: string): string {
  return 'dm_' + [uid1, uid2].sort().join('_')
}

// Hook: carica messaggi e si sottoscrive al Realtime per un canale
export function useChatMessages(channelId: string | null) {
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!channelId) return

    setLoading(true)
    setMessages([])

    supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data as DbMessage[])
        setLoading(false)
      })

    const sub = supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const newMsg = payload.new as DbMessage
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            const withoutTemp = prev.filter(m => !(
              m.id.startsWith('temp_') &&
              m.user_id === newMsg.user_id &&
              m.content === newMsg.content
            ))
            return [...withoutTemp, newMsg]
          })
        }
      )
      .subscribe()

    channelRef.current = sub

    return () => {
      sub.unsubscribe()
    }
  }, [channelId])

  const sendMessage = (
    content: string,
    userId: string,
    authorName: string,
    authorRole: UserRole
  ) => {
    if (!channelId || !content.trim()) return

    const tempId = `temp_${Date.now()}`
    const optimistic: DbMessage = {
      id: tempId,
      channel_id: channelId,
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      content: content.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const trimmed = content.trim()

    supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: userId,
        author_name: authorName,
        author_role: authorRole,
        content: trimmed,
      })
      .then(({ error }) => {
        if (error) {
          setMessages(prev => prev.filter(m => m.id !== tempId))
          return
        }
        triggerPushNotifications({ channel_id: channelId, user_id: userId, author_name: authorName, content: trimmed })
      })
  }

  return { messages, loading, sendMessage }
}

// Hook: traccia i messaggi non letti per canale e permette di azzerarli
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

  // Carica i contatori iniziali
  useEffect(() => {
    if (!userId || channelIds.length === 0) return

    async function load() {
      const { data: reads } = await supabase
        .from('channel_reads')
        .select('channel_id, last_read_at')
        .eq('user_id', userId)

      const readMap: Record<string, string> = {}
      for (const r of reads ?? []) readMap[r.channel_id] = r.last_read_at

      // Baseline: 30 giorni fa per canali mai visitati
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

  // Realtime: aggiorna i contatori in tempo reale
  useEffect(() => {
    if (!userId) return

    const sub = supabase
      .channel('unread-tracker')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as DbMessage
          if (msg.user_id === userId) return
          if (!channelIds.includes(msg.channel_id)) return

          if (msg.channel_id === activeRef.current) {
            // L'utente sta guardando questo canale: segna come letto
            await supabase
              .from('channel_reads')
              .upsert(
                { user_id: userId, channel_id: msg.channel_id, last_read_at: new Date().toISOString() },
                { onConflict: 'user_id,channel_id' }
              )
          } else {
            setCounts(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] ?? 0) + 1 }))
          }
        }
      )
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [userId, channelIdsKey])

  const markRead = useCallback(async (channelId: string) => {
    if (!userId || !channelId) return
    setCounts(prev => ({ ...prev, [channelId]: 0 }))
    await supabase
      .from('channel_reads')
      .upsert(
        { user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,channel_id' }
      )
  }, [userId])

  return { counts, markRead }
}

// Hook: carica tutti gli utenti con cui si può fare DM
export function useDmUsers(currentUserId: string, currentRole: UserRole) {
  const [users, setUsers] = useState<DmUser[]>([])

  useEffect(() => {
    if (!currentUserId) return

    let query = supabase
      .from('profiles')
      .select('id, name, role')
      .neq('id', currentUserId)

    if (currentRole === 'student') {
      query = query.in('role', ['coach', 'mental_coach', 'admin'])
    }

    query.order('role').then(({ data }) => {
      if (data) setUsers(data as DmUser[])
    })
  }, [currentUserId, currentRole])

  return users
}
