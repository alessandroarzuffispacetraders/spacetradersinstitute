import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useIsPreview } from './previewMode'

// ─── Tipi (camelCase, stessa forma del vecchio mock liveData) ───────────────────

export type LiveStatus = 'live' | 'upcoming' | 'replay'
export type LiveRole = 'student' | 'coach' | 'mental_coach' | 'admin'

export interface LiveEvent {
  id: string
  title: string
  description: string
  host: string
  hostRole: LiveRole
  status: LiveStatus
  startsAt: string | null        // ISO
  zoomUrl: string | null
  liveEmbedUrl: string | null    // YouTube/Vimeo live → guarda in-app (opt-in)
  replayVimeoId: string | null
  durationMinutes: number | null
  accent: string
  accentEnd: string
  ownerId: string | null
}

interface RawLive {
  id: string
  title: string
  description: string
  host: string
  host_role: LiveRole
  status: LiveStatus
  starts_at: string | null
  zoom_url: string | null
  live_embed_url: string | null
  replay_vimeo_id: string | null
  duration_minutes: number | null
  accent: string
  accent_end: string
  position: number
  owner_id: string | null
}

const COLS =
  'id,title,description,host,host_role,status,starts_at,zoom_url,live_embed_url,replay_vimeo_id,duration_minutes,accent,accent_end,position,owner_id'

function toLive(r: RawLive): LiveEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    host: r.host,
    hostRole: r.host_role,
    status: r.status,
    startsAt: r.starts_at,
    zoomUrl: r.zoom_url,
    liveEmbedUrl: r.live_embed_url,
    replayVimeoId: r.replay_vimeo_id,
    durationMinutes: r.duration_minutes,
    accent: r.accent,
    accentEnd: r.accent_end,
    ownerId: r.owner_id,
  }
}

// ─── Helper di formattazione (usati dalle pagine) ───────────────────────────────

export function liveDateLabel(e: LiveEvent): string {
  if (e.status === 'live') return 'Ora in diretta'
  if (!e.startsAt) return e.status === 'upcoming' ? 'Da programmare' : ''
  const d = new Date(e.startsAt)
  if (e.status === 'replay') {
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const date = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export function liveDurationLabel(e: LiveEvent): string {
  const min = e.durationMinutes
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m} min` : `${m} min`
}

// Dati FINTI per l'anteprima (vedi previewMode). La live non ha startsAt (così
// non compare tra i "prossimi appuntamenti" del calendario); gli upcoming sono
// ancorati al caricamento → cadono nelle prossime settimane; i replay sono passati.
function previewIso(offsetDays: number, h: number, m: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
function previewEvents(): LiveEvent[] {
  const mk = (id: string, title: string, host: string, hostRole: LiveRole, status: LiveStatus, startsAt: string | null, accent: string, accentEnd: string, durationMinutes: number | null, description = ''): LiveEvent =>
    ({ id, title, description, host, hostRole, status, startsAt, zoomUrl: null, liveEmbedUrl: null, replayVimeoId: null, durationMinutes, accent, accentEnd, ownerId: null })
  return [
    mk('pv-live', 'Sessione operativa in diretta', 'Coach Marco', 'coach', 'live', null, '#7CBBD0', '#286680', null, 'Analizziamo il mercato in tempo reale e rispondiamo alle domande in chat.'),
    mk('pv-up1', 'Live analisi di mercato', 'Coach Marco', 'coach', 'upcoming', previewIso(2, 18, 0), '#7CBBD0', '#286680', 60),
    mk('pv-up2', 'Sessione mental coach di gruppo', 'Mental Coach Sara', 'mental_coach', 'upcoming', previewIso(5, 20, 30), '#B48CE0', '#6B4FA0', 60),
    mk('pv-up3', 'Q&A settimanale con il coach', 'Coach Marco', 'coach', 'upcoming', previewIso(9, 19, 0), '#7CBBD0', '#286680', 45),
    mk('pv-rep1', 'Analisi di mercato — settimana 24', 'Coach Marco', 'coach', 'replay', '2026-06-22T18:00:00Z', '#7CBBD0', '#286680', 58),
    mk('pv-rep2', 'Psicologia: uscire dalle perdite', 'Mental Coach Sara', 'mental_coach', 'replay', '2026-06-15T20:00:00Z', '#B48CE0', '#6B4FA0', 41),
    mk('pv-rep3', 'Live Q&A — gestione del rischio', 'Coach Marco', 'coach', 'replay', '2026-06-08T19:00:00Z', '#7CBBD0', '#286680', 72),
  ]
}

// ─── Student: lettura ───────────────────────────────────────────────────────────

export function useLiveEvents() {
  const preview = useIsPreview()
  const [events, setEvents] = useState<LiveEvent[]>(preview ? previewEvents() : [])
  const [loading, setLoading] = useState(!preview)

  const load = useCallback(async () => {
    if (preview) return
    setLoading(true)
    const { data } = await supabase.from('live_events').select(COLS).order('position')
    setEvents(((data as RawLive[] | null) ?? []).map(toLive))
    setLoading(false)
  }, [preview])

  useEffect(() => { load() }, [load])

  return { events, loading, reload: load }
}

export function useLiveEvent(id: string | undefined) {
  const [event, setEvent] = useState<LiveEvent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!id) { setEvent(null); setLoading(false); return }
    setLoading(true)
    supabase.from('live_events').select(COLS).eq('id', id).maybeSingle().then(({ data }) => {
      if (!active) return
      setEvent(data ? toLive(data as RawLive) : null)
      setLoading(false)
    })
    return () => { active = false }
  }, [id])

  return { event, loading }
}

// ─── Admin: CRUD ────────────────────────────────────────────────────────────────

export interface LiveInput {
  title: string
  description: string
  host: string
  hostRole: LiveRole
  status: LiveStatus
  startsAt: string | null
  zoomUrl: string | null
  liveEmbedUrl: string | null
  replayVimeoId: string | null
  durationMinutes: number | null
  accent: string
  accentEnd: string
}

function toRow(input: LiveInput) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    host: input.host.trim(),
    host_role: input.hostRole,
    status: input.status,
    starts_at: input.startsAt,
    zoom_url: input.zoomUrl?.trim() || null,
    live_embed_url: input.liveEmbedUrl?.trim() || null,
    replay_vimeo_id: input.replayVimeoId?.trim() || null,
    duration_minutes: input.durationMinutes,
    accent: input.accent,
    accent_end: input.accentEnd,
  }
}

// opts.ownerId: id da assegnare alle live create (e da filtrare se onlyOwn).
// opts.onlyOwn: true → mostra solo le live di ownerId (vista coach/mental);
// false/omesso → tutte (vista admin).
export function useLiveAdmin(opts?: { ownerId?: string; onlyOwn?: boolean }) {
  const ownerId = opts?.ownerId
  const onlyOwn = opts?.onlyOwn ?? false
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    let query = supabase.from('live_events').select(COLS).order('position')
    if (onlyOwn && ownerId) query = query.eq('owner_id', ownerId)
    const { data } = await query
    setEvents(((data as RawLive[] | null) ?? []).map(toLive))
    if (!silent) setLoading(false)
  }, [onlyOwn, ownerId])

  useEffect(() => { load() }, [load])

  const createLive = useCallback(async (input: LiveInput): Promise<boolean> => {
    const { error } = await supabase.from('live_events').insert({
      ...toRow(input), position: events.length, owner_id: ownerId ?? null,
    })
    if (!error) await load(true)
    return !error
  }, [events.length, load, ownerId])

  const updateLive = useCallback(async (id: string, input: LiveInput): Promise<boolean> => {
    const { error } = await supabase.from('live_events').update(toRow(input)).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  const deleteLive = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('live_events').delete().eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  // Azioni ciclo di vita
  const setLiveStatus = useCallback(async (id: string, status: LiveStatus): Promise<boolean> => {
    const { error } = await supabase.from('live_events').update({ status }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  const setReplay = useCallback(async (id: string, vimeoId: string): Promise<boolean> => {
    const { error } = await supabase.from('live_events')
      .update({ replay_vimeo_id: vimeoId.trim() || null, status: 'replay' }).eq('id', id)
    if (!error) await load(true)
    return !error
  }, [load])

  return { events, loading, reload: () => load(true), createLive, updateLive, deleteLive, setLiveStatus, setReplay }
}
