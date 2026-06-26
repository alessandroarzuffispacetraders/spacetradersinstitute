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
          const newMsg = payload.new as DbMessage
          setMessages(prev => {
            // Evita duplicati: il messaggio potrebbe essere già stato aggiunto in modo ottimistico
            if (prev.some(m => m.id === newMsg.id)) return prev
            // Sostituisce eventuali messaggi temporanei con stesso contenuto/autore
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

  const sendMessage = async (
    content: string,
    userId: string,
    authorName: string,
    authorRole: UserRole
  ) => {
    if (!channelId || !content.trim()) return

    // Ottimistic update — il messaggio appare subito con un id temporaneo
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

    const { data } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: userId,
        author_name: authorName,
        author_role: authorRole,
        content: content.trim(),
      })
      .select()
      .single()

    // Sostituisce il messaggio temporaneo con quello reale (se Realtime non l'ha già fatto)
    if (data) {
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId)
        if (withoutTemp.some(m => m.id === (data as DbMessage).id)) return withoutTemp
        return [...withoutTemp, data as DbMessage]
      })
    }
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
