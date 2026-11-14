import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// Copertine dei video generate dall'AI (edge function generate-cover).
//
// La funzione risponde subito "pending" e disegna in background (può volerci
// più di un minuto); qui seguiamo lo stato rileggendo la riga finché diventa
// 'ready' o 'error'. Lo stato dei lavori in corso vive in un piccolo store di
// modulo, così la riga admin, la finestra di modifica e la generazione in
// blocco vedono tutte lo stesso "in generazione…" anche se si smontano.

export type CoverKind = 'lesson' | 'live'

export interface CoverResult {
  ok: boolean
  coverUrl?: string | null
  keyword?: string | null
  error?: string
}

const TABLE: Record<CoverKind, 'lessons' | 'live_events'> = { lesson: 'lessons', live: 'live_events' }
const POLL_MS = 4000
const POLL_TIMEOUT_MS = 7 * 60_000

// Colonne delle copertine assenti (migrazione phase_video_covers.sql non ancora
// applicata): Postgres risponde 42703 "column … does not exist".
export function isMissingCoverColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42703' || /cover_(url|keyword|status|notes|error|updated_at)/i.test(err.message ?? '')
}

export const MIGRATION_MISSING_MSG =
  'Le copertine AI non sono ancora attive: va applicata la migrazione phase_video_covers.sql e pubblicata la funzione generate-cover.'

// ─── Store dei lavori in corso ──────────────────────────────────────────────

export interface CoverJob { running: boolean; error?: string }
const IDLE: CoverJob = { running: false }
const jobs = new Map<string, CoverJob>()
const inflight = new Map<string, Promise<CoverResult>>()
const listeners = new Set<() => void>()

const jobKey = (kind: CoverKind, id: string) => `${kind}:${id}`

function setJob(key: string, job: CoverJob) {
  jobs.set(key, job)
  listeners.forEach(l => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useCoverJob(kind: CoverKind, id: string): CoverJob {
  return useSyncExternalStore(subscribe, () => jobs.get(jobKey(kind, id)) ?? IDLE)
}

// ─── Chiamata + attesa del risultato ────────────────────────────────────────

async function invokeErrorMessage(error: unknown): Promise<string> {
  // FunctionsHttpError porta la Response in `context`: dentro c'è il nostro { error }.
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context
  if (ctx?.json) {
    try {
      const body = await ctx.json() as { error?: string }
      if (body?.error) return body.error
    } catch { /* corpo non JSON */ }
  }
  const msg = (error as { message?: string } | null)?.message ?? ''
  if (/not found|404|Failed to send/i.test(msg)) return MIGRATION_MISSING_MSG
  return msg || 'Generazione non riuscita'
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function waitForCover(kind: CoverKind, id: string): Promise<CoverResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    const { data, error } = await supabase
      .from(TABLE[kind])
      .select('cover_status, cover_url, cover_keyword, cover_error')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      if (isMissingCoverColumn(error)) return { ok: false, error: MIGRATION_MISSING_MSG }
      continue // errore di rete momentaneo: riprova al giro dopo
    }
    const row = data as { cover_status: string | null; cover_url: string | null; cover_keyword: string | null; cover_error: string | null } | null
    if (!row) return { ok: false, error: 'Contenuto non trovato' }
    if (row.cover_status === 'ready') return { ok: true, coverUrl: row.cover_url, keyword: row.cover_keyword }
    if (row.cover_status === 'error') return { ok: false, error: row.cover_error || 'Generazione non riuscita' }
  }
  return { ok: false, error: 'Tempo scaduto: la generazione non ha risposto. Riprova.' }
}

// Genera (o rigenera, con eventuale richiesta di modifica) la copertina.
// Se per quel contenuto c'è già un lavoro in corso, restituisce quello.
export function generateCover(kind: CoverKind, id: string, feedback?: string): Promise<CoverResult> {
  const key = jobKey(kind, id)
  const running = inflight.get(key)
  if (running) return running

  const task = (async (): Promise<CoverResult> => {
    setJob(key, { running: true })
    let result: CoverResult
    try {
      const { data, error } = await supabase.functions.invoke('generate-cover', {
        body: { kind, id, feedback: feedback?.trim() || undefined },
      })
      if (error) {
        result = { ok: false, error: await invokeErrorMessage(error) }
      } else {
        const body = data as { ok?: boolean; status?: string; error?: string } | null
        if (!body?.ok) result = { ok: false, error: body?.error || 'Generazione non riuscita' }
        else result = await waitForCover(kind, id)
      }
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : 'Generazione non riuscita' }
    }
    setJob(key, result.ok ? IDLE : { running: false, error: result.error })
    inflight.delete(key)
    return result
  })()

  inflight.set(key, task)
  return task
}

// ─── Generazione in blocco ("genera quelle mancanti") ───────────────────────

export interface CoverTarget { kind: CoverKind; id: string }

// Lezioni (tutte le sezioni, anche bozze) e replay ancora senza copertina.
export async function listMissingCovers(): Promise<{ items: CoverTarget[]; error?: string }> {
  const [lessons, replays] = await Promise.all([
    supabase.from('lessons').select('id').is('cover_url', null),
    supabase.from('live_events').select('id').is('cover_url', null).eq('status', 'replay').eq('event_type', 'live'),
  ])
  const err = lessons.error ?? replays.error
  if (err) return { items: [], error: isMissingCoverColumn(err) ? MIGRATION_MISSING_MSG : err.message }
  return {
    items: [
      ...((lessons.data ?? []) as { id: string }[]).map(r => ({ kind: 'lesson' as const, id: r.id })),
      ...((replays.data ?? []) as { id: string }[]).map(r => ({ kind: 'live' as const, id: r.id })),
    ],
  }
}

// Al massimo 2 generazioni insieme: abbastanza veloce, senza saturare i limiti.
export async function generateMissingCovers(
  items: CoverTarget[],
  onProgress: (done: number, total: number, failed: number) => void,
  concurrency = 2,
): Promise<{ done: number; failed: number }> {
  let next = 0, done = 0, failed = 0
  onProgress(0, items.length, 0)
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      const res = await generateCover(item.kind, item.id)
      done++
      if (!res.ok) failed++
      onProgress(done, items.length, failed)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return { done, failed }
}
