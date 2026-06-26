import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'
import { UserRole } from '../types'

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

    // Carica messaggi iniziali
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

    // Sottoscrive al Realtime
    const sub = supabase
      .channel(`chat:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as DbMessage])
        }
      )
      .subscribe()

    channelRef.current = sub

    return () => {
      sub.unsubscribe()
    }
  }, [channelId])

  const sendMessage = async (
    content: string,
    userId: string,
    authorName: string,
    authorRole: UserRole
  ) => {
    if (!channelId || !content.trim()) return
    await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      content: content.trim(),
    })
  }

  return { messages, loading, sendMessage }
}

// Hook: carica tutti gli utenti con cui si può fare DM (non studenti, o tutti tranne se stessi)
export function useDmUsers(currentUserId: string, currentRole: UserRole) {
  const [users, setUsers] = useState<DmUser[]>([])

  useEffect(() => {
    if (!currentUserId) return

    let query = supabase
      .from('profiles')
      .select('id, name, role')
      .neq('id', currentUserId)

    // Gli studenti vedono solo staff
    if (currentRole === 'student') {
      query = query.in('role', ['coach', 'mental_coach', 'admin'])
    }

    query.order('role').then(({ data }) => {
      if (data) setUsers(data as DmUser[])
    })
  }, [currentUserId, currentRole])

  return users
}
