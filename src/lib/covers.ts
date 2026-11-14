import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// Copertine dei video generate dall'AI (edge function generate-cover) e
// locandine verticali delle serie (kind 'category', colonne poster_*).
//
// La funzione risponde subito "pending" e disegna in background (può volerci
// più di un minuto); qui seguiamo lo stato rileggendo la riga finché diventa
// 'ready' o 'error'. Lo stato dei lavori in corso vive in un piccolo store di
// modulo, così la riga admin, la finestra di modifica e la generazione in
// blocco vedono tutte lo stesso "in generazione…" anche se si smontano.

export type CoverKind = 'lesson' | 'live' | 'category'

export interface CoverResult {
  ok: boolean
  coverUrl?: string | null
  keyword?: string | null
  error?: string
}

const TABLE: Record<CoverKind, 'lessons' | 'live_events' | 'categories'> = {
  lesson: 'lessons', live: 'live_events', category: 'categories',
}
// Le serie usano poster_* (categories.cover_url è la copertina caricata a mano).
const COL: Record<CoverKind, 'cover' | 'poster'> = { lesson: 'cover', live: 'cover', category: 'poster' }
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

// Colonne delle locandine assenti (migrazione phase_series_posters.sql non ancora applicata).
export function isMissingPosterColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return /poster_(url|status|notes|error|updated_at)/i.test(err.message ?? '')
}

export const POSTER_MIGRATION_MISSING_MSG =
  'Le locandine AI delle serie non sono ancora attive: va applicata la migrazione phase_series_posters.sql e ripubblicata la funzione generate-cover.'

const missingMsg = (kind: CoverKind) => kind === 'category' ? POSTER_MIGRATION_MISSING_MSG : MIGRATION_MISSING_MSG

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

async function invokeErrorMessage(error: unknown, kind: CoverKind): Promise<string> {
  // FunctionsHttpError porta la Response in `context`: dentro c'è il nostro { error }.
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context
  if (ctx?.json) {
    try {
      const body = await ctx.json() as { error?: string }
      if (body?.error) return body.error
    } catch { /* corpo non JSON */ }
  }
  const msg = (error as { message?: string } | null)?.message ?? ''
  if (/not found|404|Failed to send/i.test(msg)) return missingMsg(kind)
  return msg || 'Generazione non riuscita'
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function waitForCover(kind: CoverKind, id: string): Promise<CoverResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  const c = COL[kind]
  const cols = kind === 'category'
    ? 'poster_status, poster_url, poster_error'
    : 'cover_status, cover_url, cover_keyword, cover_error'
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    const { data, error } = await supabase
      .from(TABLE[kind])
      .select(cols)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      if (kind === 'category' ? isMissingPosterColumn(error) : isMissingCoverColumn(error)) {
        return { ok: false, error: missingMsg(kind) }
      }
      continue // errore di rete momentaneo: riprova al giro dopo
    }
    const row = data as Record<string, string | null> | null
    if (!row) return { ok: false, error: 'Contenuto non trovato' }
    if (row[`${c}_status`] === 'ready') {
      return { ok: true, coverUrl: row[`${c}_url`] ?? null, keyword: kind === 'category' ? null : (row.cover_keyword ?? null) }
    }
    if (row[`${c}_status`] === 'error') return { ok: false, error: row[`${c}_error`] || 'Generazione non riuscita' }
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
        result = { ok: false, error: await invokeErrorMessage(error, kind) }
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

// Serie senza locandina (per prime: sono le più visibili), poi lezioni (tutte
// le sezioni, anche bozze) e replay ancora senza copertina. Se manca solo una
// delle due migrazioni, si genera quello che si può e lo si segnala in `notice`.
export async function listMissingCovers(): Promise<{ items: CoverTarget[]; error?: string; notice?: string }> {
  const [series, lessons, replays] = await Promise.all([
    supabase.from('categories').select('id, position').is('poster_url', null).order('position'),
    supabase.from('lessons').select('id').is('cover_url', null),
    supabase.from('live_events').select('id').is('cover_url', null).eq('status', 'replay').eq('event_type', 'live'),
  ])

  const coversErr = lessons.error ?? replays.error
  const coversMissing = !!coversErr && isMissingCoverColumn(coversErr)
  if (coversErr && !coversMissing) return { items: [], error: coversErr.message }
  // La query delle serie usa solo id/position/poster_url: un 42703 qui è poster_url.
  const postersMissing = !!series.error && (series.error.code === '42703' || isMissingPosterColumn(series.error))
  if (series.error && !postersMissing) return { items: [], error: series.error.message }
  if (coversMissing && postersMissing) return { items: [], error: MIGRATION_MISSING_MSG }

  return {
    items: [
      ...(postersMissing ? [] : ((series.data ?? []) as { id: string }[]).map(r => ({ kind: 'category' as const, id: r.id }))),
      ...(coversMissing ? [] : ((lessons.data ?? []) as { id: string }[]).map(r => ({ kind: 'lesson' as const, id: r.id }))),
      ...(coversMissing ? [] : ((replays.data ?? []) as { id: string }[]).map(r => ({ kind: 'live' as const, id: r.id }))),
    ],
    notice: postersMissing ? POSTER_MIGRATION_MISSING_MSG : coversMissing ? MIGRATION_MISSING_MSG : undefined,
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
