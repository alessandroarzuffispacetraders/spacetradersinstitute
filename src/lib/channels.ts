import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { Channel, ChannelType, ChannelAudience } from '../data/chatData'

// ─── Raw DB row → Channel (stessa forma del vecchio mock chatData.CHANNELS) ─────
// Le live-chat (type 'live') NON entrano nella lista canali della chat: si
// raggiungono dal modulo Live. Gli hook qui sotto le escludono via .neq.

interface RawChannel {
  id: string
  name: string
  description: string | null
  type: 'chat' | 'bacheca' | 'live'
  category: string
  category_icon: string
  roles: string[] | null
  can_post: string[] | null
  free: boolean | null
  position: number
  pinned: boolean
  live_event_id: string | null
}

const COLS =
  'id,name,description,type,category,category_icon,roles,can_post,free,position,pinned,live_event_id'

function toChannel(r: RawChannel): Channel {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    // 'live' non dovrebbe arrivare (escluso in query); mappato a 'chat' per sicurezza tipi.
    type: (r.type === 'live' ? 'chat' : r.type) as ChannelType,
    channelKind: 'group',
    category: r.category,
    categoryIcon: r.category_icon,
    roles: (r.roles ?? []) as ChannelAudience[],
    canPost: (r.can_post ?? []) as ChannelAudience[],
    free: r.free ?? false,
    pinned: r.pinned,
  }
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Lettura: canali visibili all'utente (RLS filtra per ruolo) ─────────────────

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('channels')
      .select(COLS)
      .neq('type', 'live')
      .order('position')
    setChannels(((data as RawChannel[] | null) ?? []).map(toChannel))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { channels, loading, reload: load }
}

// ─── Admin: CRUD canali (solo admin per RLS) ────────────────────────────────────

export interface ChannelInput {
  name: string
  description: string
  type: ChannelType
  category: string
  categoryIcon: string
  roles: ChannelAudience[]
  canPost: ChannelAudience[]
  free: boolean
}

type SaveResult = { ok: boolean; error?: string }

export function useChannelsAdmin() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('channels')
      .select(COLS)
      .neq('type', 'live')
      .order('position')
    setChannels(((data as RawChannel[] | null) ?? []).map(toChannel))
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createChannel = useCallback(async (input: ChannelInput): Promise<SaveResult> => {
    const id = slugify(input.name)
    if (!id) return { ok: false, error: 'Nome canale non valido.' }
    const { error } = await supabase.from('channels').insert({
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      category: input.category,
      category_icon: input.categoryIcon,
      roles: input.roles,
      can_post: input.canPost,
      free: input.roles.includes('free'), // derivato dall'audience 'free' nei roles
      position: channels.length,
    })
    if (error) {
      const dup = error.code === '23505' || /duplicate key/i.test(error.message)
      return { ok: false, error: dup ? 'Esiste già un canale con questo nome.' : error.message }
    }
    await load(true)
    return { ok: true }
  }, [channels.length, load])

  const updateChannel = useCallback(async (id: string, input: ChannelInput): Promise<SaveResult> => {
    const { error } = await supabase.from('channels').update({
      name: input.name.trim(),
      description: input.description.trim(),
      type: input.type,
      category: input.category,
      category_icon: input.categoryIcon,
      roles: input.roles,
      can_post: input.canPost,
      free: input.roles.includes('free'), // derivato dall'audience 'free' nei roles
    }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    await load(true)
    return { ok: true }
  }, [load])

  const deleteChannel = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('channels').delete().eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  return { channels, loading, reload: () => load(true), createChannel, updateChannel, deleteChannel }
}
