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

// Colonne dei soggetti per ChatGPT assenti (migrazione phase_cover_prompts.sql).
export function isMissingPromptColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return /(cover|poster)_prompt/i.test(err.message ?? '')
}

export const PROMPT_MIGRATION_MISSING_MSG =
  'I prompt per ChatGPT non sono ancora attivi: va applicata la migrazione phase_cover_prompts.sql e ripubblicata la funzione generate-cover.'

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

// ═══ Copertine create con ChatGPT ═══════════════════════════════════════════
// Flusso principale: Claude sceglie il SOGGETTO (funzione generate-cover,
// mode 'prompt'), l'app ci costruisce il prompt completo (coverPrompts.ts),
// l'admin lo incolla in ChatGPT, scarica l'immagine e la carica qui. Le
// immagini caricate finiscono nelle stesse colonne delle copertine AI
// (lessons.cover_url / categories.poster_url), quindi l'app studente non cambia.

export type PromptKind = 'lesson' | 'category'

export interface PromptResult {
  ok: boolean
  subject?: CoverPromptSubject
  error?: string
}

// Stesso contenuto di CoverSubject in coverPrompts.ts (qui senza import per
// evitare un ciclo content.ts ↔ covers.ts ↔ coverPrompts.ts).
export interface CoverPromptSubject { visual?: string; soggetto: string; contorno: string; parolaChiave?: string }

const promptJobs = new Map<string, CoverJob>()
const promptInflight = new Map<string, Promise<PromptResult>>()

function setPromptJob(key: string, job: CoverJob) {
  promptJobs.set(key, job)
  listeners.forEach(l => l())
}

export function usePromptJob(kind: PromptKind, id: string): CoverJob {
  return useSyncExternalStore(subscribe, () => promptJobs.get(jobKey(kind, id)) ?? IDLE)
}

// Chiede a Claude il soggetto (pochi secondi) e lo salva sulla riga.
export function preparePrompt(kind: PromptKind, id: string, feedback?: string): Promise<PromptResult> {
  const key = jobKey(kind, id)
  const running = promptInflight.get(key)
  if (running) return running

  const task = (async (): Promise<PromptResult> => {
    setPromptJob(key, { running: true })
    let result: PromptResult
    try {
      const { data, error } = await supabase.functions.invoke('generate-cover', {
        body: { kind, id, mode: 'prompt', feedback: feedback?.trim() || undefined },
      })
      if (error) {
        const msg = await invokeErrorMessage(error, kind)
        result = { ok: false, error: /cover_prompt|poster_prompt|column/i.test(msg) ? PROMPT_MIGRATION_MISSING_MSG : msg }
      } else {
        const body = data as ({ ok?: boolean; error?: string } & Partial<CoverPromptSubject>) | null
        if (!body?.ok || !body.soggetto || !body.contorno) result = { ok: false, error: body?.error || 'Prompt non riuscito' }
        else result = { ok: true, subject: { visual: body.visual, soggetto: body.soggetto, contorno: body.contorno, parolaChiave: body.parolaChiave } }
      }
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : 'Prompt non riuscito' }
    }
    setPromptJob(key, result.ok ? IDLE : { running: false, error: result.error })
    promptInflight.delete(key)
    return result
  })()

  promptInflight.set(key, task)
  return task
}

// "Prepara tutti i prompt": al massimo 2 insieme.
export async function prepareAllPrompts(
  items: { kind: PromptKind; id: string }[],
  onProgress: (done: number, total: number, failed: number) => void,
  concurrency = 2,
): Promise<{ done: number; failed: number }> {
  let next = 0, done = 0, failed = 0
  onProgress(0, items.length, 0)
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++]
      const res = await preparePrompt(item.kind, item.id)
      done++
      if (!res.ok) failed++
      onProgress(done, items.length, failed)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return { done, failed }
}

// Un'immagine "caricata" (da ChatGPT) si riconosce dal nome del file; le
// copertine vettoriali generate dalla funzione hanno un altro nome.
export function isUploadedCover(url: string | null | undefined): boolean {
  return !!url && /\/upload-\d+\.(webp|jpe?g|png)(\?|$)/i.test(url)
}

// Copia negli appunti, con ripiego per i browser che non hanno l'API moderna.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

// ─── Caricamento dell'immagine ──────────────────────────────────────────────

const UPLOAD_MAX: Record<PromptKind, { w: number; h: number }> = {
  lesson: { w: 1600, h: 1067 },   // 3:2 (mostrata in 16:9)
  category: { w: 1000, h: 1500 }, // 2:3
}
const MAX_INPUT_BYTES = 25 * 1024 * 1024

// Le immagini di ChatGPT pesano 2–3 MB: le riduciamo in WebP (o JPEG dove il
// browser non sa codificare WebP) prima di caricarle.
async function compressImage(file: File, maxW: number, maxH: number): Promise<{ blob: Blob; ext: string; type: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Il browser non riesce a elaborare l\'immagine')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const toBlob = (type: string, q: number) => new Promise<Blob | null>(r => canvas.toBlob(r, type, q))
  const webp = await toBlob('image/webp', 0.86)
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp', type: 'image/webp' }
  const jpeg = await toBlob('image/jpeg', 0.88)
  if (!jpeg) throw new Error('Conversione dell\'immagine non riuscita')
  return { blob: jpeg, ext: 'jpg', type: 'image/jpeg' }
}

export interface UploadResult { ok: boolean; url?: string; error?: string }

// Carica l'immagine scelta dall'admin e la imposta come copertina (lezioni:
// con la parola chiave) o come locandina (serie). Pulizia best-effort dei file
// precedenti nella stessa cartella.
export async function uploadCoverImage(kind: PromptKind, id: string, file: File, keyword?: string): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Scegli un file immagine (PNG, JPG o WebP).' }
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: 'Immagine troppo pesante (massimo 25 MB).' }
  try {
    const { w, h } = UPLOAD_MAX[kind]
    const { blob, ext, type } = await compressImage(file, w, h)
    const folder = `${kind}/${id}`
    const path = `${folder}/upload-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('video-covers').upload(path, blob, {
      contentType: type, cacheControl: '31536000', upsert: false,
    })
    if (upErr) return { ok: false, error: `Caricamento non riuscito: ${upErr.message}` }
    const url = supabase.storage.from('video-covers').getPublicUrl(path).data.publicUrl

    const now = new Date().toISOString()
    const fields: Record<string, string | null> = kind === 'lesson'
      ? { cover_url: url, cover_status: 'ready', cover_error: null, cover_updated_at: now, cover_keyword: (keyword ?? '').trim().toLocaleUpperCase('it-IT').slice(0, 24) || null }
      : { poster_url: url, poster_status: 'ready', poster_error: null, poster_updated_at: now }
    const { error: updErr } = await supabase.from(kind === 'lesson' ? 'lessons' : 'categories').update(fields).eq('id', id)
    if (updErr) {
      await supabase.storage.from('video-covers').remove([path])
      return { ok: false, error: isMissingCoverColumn(updErr) || isMissingPosterColumn(updErr) ? missingMsg(kind) : `Salvataggio non riuscito: ${updErr.message}` }
    }

    // Pulizia: tutti gli altri file della cartella (vecchie versioni, SVG).
    try {
      const { data: files } = await supabase.storage.from('video-covers').list(folder, { limit: 100 })
      const old = (files ?? []).map(f => `${folder}/${f.name}`).filter(p => p !== path)
      if (old.length) await supabase.storage.from('video-covers').remove(old)
    } catch { /* best-effort */ }

    return { ok: true, url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Caricamento non riuscito' }
  }
}

