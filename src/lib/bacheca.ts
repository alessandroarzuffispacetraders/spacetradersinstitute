import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { MemberRole } from '../data/chatData'

export interface BachecaPost {
  id: string
  channelId: string
  authorId: string
  author: string
  authorRole: MemberRole
  title: string | null
  content: string
  tag: string | null
  pinned: boolean
  createdAt: string
  imageUrls: string[]          // fino a 4 immagini allegate
  liveEventId: string | null   // live condivisa (scheda nel post)
}

export interface NewBachecaPost {
  title?: string
  content: string
  tag?: string
  pinned?: boolean
  imageUrls?: string[]
  liveEventId?: string | null
}

interface RawPost {
  id: string; channel_id: string; author_id: string; author_name: string
  author_role: MemberRole; title: string | null; content: string
  tag: string | null; pinned: boolean; created_at: string
  image_urls?: string[] | null; live_event_id?: string | null
}

function mapPost(r: RawPost): BachecaPost {
  return {
    id: r.id, channelId: r.channel_id, authorId: r.author_id, author: r.author_name,
    authorRole: r.author_role, title: r.title, content: r.content, tag: r.tag,
    pinned: r.pinned, createdAt: r.created_at,
    imageUrls: r.image_urls ?? [], liveEventId: r.live_event_id ?? null,
  }
}

// In evidenza (pinned) prima, poi dal più recente.
function sortPosts(posts: BachecaPost[]): BachecaPost[] {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

// Inserisce un post. Immagini e live collegata arrivano con phase_live_share.sql:
// se le colonne non ci sono ancora, ripubblica senza (il testo non si perde).
async function insertPost(channelId: string, userId: string, authorName: string, authorRole: MemberRole, input: NewBachecaPost): Promise<boolean> {
  const base = {
    channel_id: channelId,
    author_id: userId,
    author_name: authorName,
    author_role: authorRole,
    title: input.title?.trim() || null,
    content: input.content.trim(),
    tag: input.tag?.trim() || null,
    pinned: input.pinned ?? false,
  }
  const extra = {
    ...(input.imageUrls?.length ? { image_urls: input.imageUrls.slice(0, 4) } : {}),
    ...(input.liveEventId ? { live_event_id: input.liveEventId } : {}),
  }
  const { error } = await supabase.from('bacheca_posts').insert({ ...base, ...extra })
  if (error && Object.keys(extra).length && /image_urls|live_event_id|PGRST204|42703/.test(`${error.code} ${error.message}`)) {
    const retry = await supabase.from('bacheca_posts').insert(base)
    return !retry.error
  }
  return !error
}

// Inserimento diretto (senza hook) di un post bacheca — usato dal broadcast admin
// e dalla condivisione delle live.
export async function postAnnouncement(
  channelId: string, userId: string, authorName: string, authorRole: MemberRole, input: NewBachecaPost,
): Promise<boolean> {
  if (!channelId || !userId || !input.content.trim()) return false
  return insertPost(channelId, userId, authorName, authorRole, input)
}

export function useBachecaPosts(channelId: string | null, userId: string) {
  const [posts, setPosts] = useState<BachecaPost[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async (id: string) => {
    const { data } = await supabase.from('bacheca_posts').select('*').eq('channel_id', id)
    setPosts(sortPosts(((data ?? []) as RawPost[]).map(mapPost)))
  }, [])

  useEffect(() => {
    if (!channelId) { setPosts([]); return }
    setLoading(true)
    reload(channelId).finally(() => setLoading(false))

    const sub = supabase
      .channel(`bacheca:${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bacheca_posts', filter: `channel_id=eq.${channelId}` }, (payload) => {
        const p = mapPost(payload.new as RawPost)
        setPosts(prev => prev.some(x => x.id === p.id) ? prev : sortPosts([...prev, p]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bacheca_posts', filter: `channel_id=eq.${channelId}` }, (payload) => {
        const p = mapPost(payload.new as RawPost)
        setPosts(prev => sortPosts(prev.map(x => x.id === p.id ? p : x)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bacheca_posts' }, (payload) => {
        const id = (payload.old as { id: string }).id
        setPosts(prev => prev.filter(x => x.id !== id))
      })
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [channelId, reload])

  const createPost = useCallback(async (input: NewBachecaPost, authorName: string, authorRole: MemberRole): Promise<boolean> => {
    if (!channelId || !userId || !input.content.trim()) return false
    const ok = await insertPost(channelId, userId, authorName, authorRole, input)
    if (!ok) return false
    await reload(channelId) // mostra subito (oltre all'eco realtime)
    return true
  }, [channelId, userId, reload])

  const deletePost = useCallback(async (id: string) => {
    setPosts(prev => prev.filter(x => x.id !== id))
    await supabase.from('bacheca_posts').delete().eq('id', id)
  }, [])

  const togglePin = useCallback(async (id: string, pinned: boolean) => {
    setPosts(prev => sortPosts(prev.map(x => x.id === id ? { ...x, pinned } : x)))
    await supabase.from('bacheca_posts').update({ pinned }).eq('id', id)
  }, [])

  return { posts, loading, createPost, deletePost, togglePin }
}

// Ultimi post degli avvisi (tutte le bacheche che l'utente può leggere: la RLS
// filtra per ruolo), dal più recente. Per la slide "Avvisi" della Home.
export function useLatestAnnouncements(limit = 3) {
  const [posts, setPosts] = useState<BachecaPost[]>([])
  useEffect(() => {
    let active = true
    supabase.from('bacheca_posts').select('*').order('created_at', { ascending: false }).limit(limit)
      .then(({ data }) => { if (active) setPosts(((data ?? []) as RawPost[]).map(mapPost)) })
    return () => { active = false }
  }, [limit])
  return posts
}
