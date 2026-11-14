// Copertine dei video generate dall'AI (lezioni e replay delle live) e
// locandine verticali delle serie (categorie del catalogo).
//
// Claude disegna un'illustrazione SVG SENZA testo nello stile della piattaforma
// e sceglie una parola chiave dal titolo; la parola la scrive poi l'app sopra
// la grafica (carattere sempre identico e leggibile). L'admin può chiedere
// modifiche a parole ("più semplice", "metti un toro"): arrivano come feedback.
//
// POST { kind: 'lesson' | 'live' | 'category', id: uuid, feedback?: string }
//  - lezioni e serie: solo admin; live/replay: admin oppure chi ha creato la live.
//  - 'category' = locandina 2:3 della serie (colonne poster_*, nessuna parola
//    chiave: il titolo della serie lo scrive l'app nel terzo inferiore).
//  - risponde SUBITO 202 { ok, status: 'pending' } e genera in background
//    (EdgeRuntime.waitUntil): un'illustrazione può richiedere più dei ~150 s
//    entro cui Supabase vuole una risposta. Il client segue lo stato sulla riga
//    (cover_status / poster_status: pending → ready | error) e rilegge l'URL.
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'
import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { CORS, json, adminClient, HttpError } from '../_shared/http.ts'
import { COVER_SYSTEM_PROMPT, POSTER_SYSTEM_PROMPT } from './prompt.ts'

// Modello e sforzo configurabili senza ridistribuire (supabase secrets set …).
const MODEL = Deno.env.get('COVER_MODEL') || 'claude-opus-5-5'
const EFFORT = (Deno.env.get('COVER_EFFORT') || 'medium') as 'low' | 'medium' | 'high'
const BUCKET = 'video-covers'
const MAX_FEEDBACK_CHARS = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Kind = 'lesson' | 'live' | 'category'
const TABLE: Record<Kind, 'lessons' | 'live_events' | 'categories'> = {
  lesson: 'lessons', live: 'live_events', category: 'categories',
}
// Prefisso delle colonne: le serie usano poster_* (categories.cover_url resta
// la copertina caricata a mano dall'admin).
const COL: Record<Kind, 'cover' | 'poster'> = { lesson: 'cover', live: 'cover', category: 'poster' }

// Formato della tela e peso massimo per tipo. I token includono anche il
// ragionamento del modello: lo stile "Monte Carlo data-art" produce SVG con
// molti percorsi (copertine ~12–25 KB, locandine ~25–45 KB), quindi margine ampio.
interface CanvasSpec { width: number; height: number; maxBytes: number; maxTokens: number }
const CANVAS: Record<Kind, CanvasSpec> = {
  lesson:   { width: 1600, height: 900,  maxBytes: 80_000,  maxTokens: 32_000 },
  live:     { width: 1600, height: 900,  maxBytes: 80_000,  maxTokens: 32_000 },
  category: { width: 1000, height: 1500, maxBytes: 100_000, maxTokens: 48_000 },
}

interface CoverContext {
  title: string
  accent: string
  lines: string[]            // righe di contesto per il prompt
  previousKeyword: string | null
  previousNotes: string | null
  ownerId: string | null     // solo live
}

// ─── Autenticazione e permessi ────────────────────────────────────────────────

async function requireUser(admin: SupabaseClient, req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new HttpError(401, 'Non autenticato')
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw new HttpError(401, 'Token non valido')
  return user
}

// Stessa regola di public.is_admin(): role = 'admin' oppure 'admin' fra i roles.
async function isAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('role, roles').eq('id', userId).maybeSingle()
  if (!data) return false
  if (data.role === 'admin') return true
  return JSON.stringify(data.roles ?? '').toLowerCase().includes('admin')
}

// ─── Contesto del video ───────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', build: 'Build', test: 'Test', deploy: 'Deploy',
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

async function loadLessonContext(admin: SupabaseClient, id: string): Promise<CoverContext> {
  const { data, error } = await admin
    .from('lessons')
    .select('id, title, description, cover_keyword, cover_notes, courses ( title, description, categories ( title, description, phase, accent, section ) )')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`lettura lezione: ${error.message}`)
  if (!data) throw new HttpError(404, 'Lezione non trovata')

  const course = one(data.courses as unknown as Record<string, unknown> | Record<string, unknown>[])
  const category = one(course?.categories as Record<string, unknown> | Record<string, unknown>[] | undefined)
  const accent = typeof category?.accent === 'string' ? category.accent : '#7CBBD0'
  const phase = PHASE_LABEL[String(category?.phase ?? '')] ?? ''
  const isMental = category?.section === 'mental'

  return {
    title: data.title,
    accent,
    previousKeyword: data.cover_keyword ?? null,
    previousNotes: data.cover_notes ?? null,
    ownerId: null,
    lines: [
      `Tipo: lezione di un videocorso${isMental ? " dell'area Mental Coach (psicologia del trader)" : ''}`,
      `Titolo della lezione: ${data.title}`,
      data.description ? `Descrizione della lezione: ${data.description}` : '',
      course?.title ? `Corso: ${course.title}` : '',
      category?.title ? `Tappa del percorso: ${category.title}${phase ? ` (fase ${phase})` : ''}` : '',
      `Colore d'accento: ${accent}`,
    ].filter(Boolean),
  }
}

async function loadLiveContext(admin: SupabaseClient, id: string): Promise<CoverContext> {
  const { data, error } = await admin
    .from('live_events')
    .select('id, title, description, host, host_role, status, accent, accent_end, owner_id, cover_keyword, cover_notes')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`lettura live: ${error.message}`)
  if (!data) throw new HttpError(404, 'Live non trovata')

  const accent = data.accent || '#7CBBD0'
  const isMental = data.host_role === 'mental_coach'
  return {
    title: data.title,
    accent,
    previousKeyword: data.cover_keyword ?? null,
    previousNotes: data.cover_notes ?? null,
    ownerId: data.owner_id ?? null,
    lines: [
      `Tipo: ${data.status === 'replay' ? 'registrazione (replay)' : 'sessione'} di una live${isMental ? ' del mental coach (psicologia del trader)' : ' con il coach'}`,
      `Titolo: ${data.title}`,
      data.description ? `Descrizione: ${data.description}` : '',
      `Colore d'accento: ${accent}${data.accent_end ? ` (secondario ${data.accent_end})` : ''}`,
    ].filter(Boolean),
  }
}

interface RawPosterLesson { title: string; position: number | null }
interface RawPosterCourse { title: string; position: number | null; lessons: RawPosterLesson[] | null }

const MAX_POSTER_LESSONS = 15
const byPos = <T extends { position: number | null }>(a: T, b: T) => (a.position ?? 0) - (b.position ?? 0)

async function loadCategoryContext(admin: SupabaseClient, id: string): Promise<CoverContext> {
  const { data, error } = await admin
    .from('categories')
    .select('id, title, description, phase, accent, section, poster_notes, courses ( title, position, lessons ( title, position ) )')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`lettura serie: ${error.message}`)
  if (!data) throw new HttpError(404, 'Serie non trovata')

  const accent = typeof data.accent === 'string' && data.accent ? data.accent : '#7CBBD0'
  const phase = PHASE_LABEL[String(data.phase ?? '')] ?? ''
  const isMental = data.section === 'mental'
  const courses = ((data.courses ?? []) as RawPosterCourse[]).slice().sort(byPos)
  const lessons = courses
    .flatMap(c => (c.lessons ?? []).slice().sort(byPos).map(l => l.title))
    .filter(Boolean)
    .slice(0, MAX_POSTER_LESSONS)

  return {
    title: data.title,
    accent,
    previousKeyword: null,
    previousNotes: data.poster_notes ?? null,
    ownerId: null,
    lines: [
      `Tipo: locandina di una serie di videocorsi${isMental ? " dell'area Mental Coach (psicologia del trader)" : ''}`,
      `Titolo della serie: ${data.title}`,
      data.description ? `Descrizione: ${data.description}` : '',
      phase ? `Fase del percorso: ${phase}` : '',
      courses.length ? `Capitoli: ${courses.map(c => c.title).join(' · ')}` : '',
      lessons.length ? `Alcune puntate: ${lessons.join(' · ')}` : '',
      `Colore d'accento: ${accent}`,
    ].filter(Boolean),
  }
}

function buildUserMessage(ctx: CoverContext, feedback: string, kind: Kind): string {
  const parts = [ctx.lines.join('\n')]
  if (ctx.previousKeyword) {
    parts.push(`Parola chiave attuale: ${ctx.previousKeyword} (cambiala solo se la richiesta dell'admin lo chiede o se non rappresenta bene il titolo).`)
  }
  if (feedback) {
    if (ctx.previousNotes && ctx.previousNotes !== feedback) {
      parts.push(`Indicazioni date in precedenza dall'admin: ${ctx.previousNotes}`)
    }
    parts.push(`Richiesta di modifica dell'admin (ha la precedenza, sempre nel rispetto dello stile e dei divieti): ${feedback}`)
  } else if (ctx.previousNotes) {
    parts.push(`Indicazioni date in precedenza dall'admin (continua a rispettarle): ${ctx.previousNotes}`)
  }
  parts.push(kind === 'category' ? 'Disegna la locandina.' : 'Disegna la copertina.')
  return parts.join('\n\n')
}

// ─── Generazione (Claude) ─────────────────────────────────────────────────────

async function generateCover(ctx: CoverContext, feedback: string, kind: Kind): Promise<{ keyword: string | null; svg: string }> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  // Streaming + finalMessage(): output lungo (SVG), niente timeout HTTP lato SDK.
  // fallbacks 'default': se il modello declina per policy (falso positivo), il
  // server riprova sul modello di riserva consigliato invece di fallire.
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: CANVAS[kind].maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT },
    system: [{ type: 'text', text: kind === 'category' ? POSTER_SYSTEM_PROMPT : COVER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(ctx, feedback, kind) }],
  })
  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') {
    throw new Error('il modello ha rifiutato la richiesta: prova a riformulare la modifica')
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('illustrazione troppo complessa (risposta troncata): chiedi una versione più semplice')
  }

  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  const kw = text.match(/<keyword>([\s\S]*?)<\/keyword>/i)?.[1] ?? ''
  const svg = text.match(/<svg[\s\S]*<\/svg>/i)?.[0] ?? ''
  if (!svg) throw new Error('risposta del modello senza SVG')

  // Le locandine non hanno parola chiave: il titolo della serie lo scrive l'app.
  return { keyword: kind === 'category' ? null : normalizeKeyword(kw, ctx.title), svg }
}

// Maiuscolo, niente virgolette/punteggiatura ai bordi, max 16 caratteri.
function normalizeKeyword(raw: string, title: string): string {
  let k = raw.replace(/["'«»“”`*_]/g, '').replace(/\s+/g, ' ').trim()
  if (!k) k = title.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? ''
  k = k.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLocaleUpperCase('it-IT')
  if (k.length > 16) {
    const words = k.split(' ')
    k = words[0].length <= 16 ? words[0] : words[0].slice(0, 16)
  }
  return k
}

// ─── Pulizia dell'SVG ─────────────────────────────────────────────────────────
// Nell'app l'SVG è mostrato via <img> (lì gli script non girano comunque), ma
// il file è pubblico e aprendolo direttamente nel browser verrebbe eseguito:
// togliamo tutto ciò che può caricare risorse o eseguire codice, più il testo
// (le parole le scrive l'app). Radice riscritta in forma canonica.

// <style> resta (il modello lo usa per i bagliori), ma @import e url() esterni
// vengono comunque eliminati sotto.
const DROP_ELEMENTS = 'script|foreignObject|image|iframe|object|embed|audio|video|a|text|animate|animateTransform|animateMotion|set'

function sanitizeSvg(raw: string, spec: CanvasSpec): string {
  let s = raw.trim()
  const start = s.search(/<svg[\s>]/i)
  const end = s.toLowerCase().lastIndexOf('</svg>')
  if (start < 0 || end < 0) throw new Error('SVG non valido')
  s = s.slice(start, end + 6)

  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<!\[CDATA\[|\]\]>/g, '')
  s = s.replace(/<!DOCTYPE[^>]*>/gi, '')
  s = s.replace(new RegExp(`<(${DROP_ELEMENTS})\\b[^>]*?\\/>`, 'gi'), '')
  s = s.replace(new RegExp(`<(${DROP_ELEMENTS})\\b[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '')
  s = s.replace(new RegExp(`<\\/?(${DROP_ELEMENTS})\\b[^>]*>`, 'gi'), '') // residui non chiusi
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  s = s.replace(/\s+(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*'|(?!["'#])[^\s>]+)/gi, '')
  s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none')
  s = s.replace(/javascript:/gi, '')
  s = s.replace(/@import[^;]*;?/gi, '')

  // Radice canonica: namespace, viewBox (quello del modello se valido),
  // riempimento a tutta cornice nelle card (slice = come object-fit: cover).
  const rootMatch = s.match(/^<svg\b[^>]*>/i)
  if (!rootMatch) throw new Error('SVG non valido')
  const vb = rootMatch[0].match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i)
  const viewBox = vb && Number(vb[3]) > 0 && Number(vb[4]) > 0
    ? `${vb[1]} ${vb[2]} ${vb[3]} ${vb[4]}`
    : `0 0 ${spec.width} ${spec.height}`
  const root = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" width="${spec.width}" height="${spec.height}" preserveAspectRatio="xMidYMid slice">`
  s = root + s.slice(rootMatch[0].length)

  if (new TextEncoder().encode(s).length > spec.maxBytes) throw new Error('SVG troppo pesante')
  if (!/<(path|rect|circle|ellipse|line|polyline|polygon|g)\b/i.test(s)) throw new Error('SVG vuoto')
  return s
}

// ─── Lavoro in background ─────────────────────────────────────────────────────

async function runJob(admin: SupabaseClient, kind: Kind, id: string, ctx: CoverContext, feedback: string) {
  const table = TABLE[kind]
  const col = COL[kind]
  try {
    const { keyword, svg } = await generateCover(ctx, feedback, kind)
    const clean = sanitizeSvg(svg, CANVAS[kind])

    const folder = `${kind}/${id}`
    const path = `${folder}/${Date.now()}.svg`
    const { error: upErr } = await admin.storage.from(BUCKET).upload(
      path,
      new Blob([clean], { type: 'image/svg+xml' }),
      { contentType: 'image/svg+xml', cacheControl: '31536000', upsert: true },
    )
    if (upErr) throw new Error(`upload: ${upErr.message}`)
    const coverUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    const fields: Record<string, string | null> = {
      [`${col}_url`]: coverUrl,
      [`${col}_status`]: 'ready',
      [`${col}_error`]: null,
      [`${col}_notes`]: feedback || ctx.previousNotes,
      [`${col}_updated_at`]: new Date().toISOString(),
    }
    if (kind !== 'category') fields.cover_keyword = keyword
    const { error: updErr } = await admin.from(table).update(fields).eq('id', id)
    if (updErr) throw new Error(`salvataggio: ${updErr.message}`)

    // Pulizia delle versioni precedenti (best-effort: un errore qui non conta).
    // Teniamo il file appena caricato E quello a cui punta ora la riga: con due
    // rigenerazioni sovrapposte vince l'ultima scrittura, mai un link rotto.
    const { data: row } = await admin.from(table).select(`${col}_url`).eq('id', id).maybeSingle()
    const keep = new Set([path])
    const marker = `/${BUCKET}/`
    const currentRaw = (row as Record<string, unknown> | null)?.[`${col}_url`]
    const current = typeof currentRaw === 'string' ? currentRaw : ''
    if (current.includes(marker)) keep.add(current.slice(current.indexOf(marker) + marker.length))
    const { data: files } = await admin.storage.from(BUCKET).list(folder, { limit: 100 })
    const old = (files ?? []).map(f => `${folder}/${f.name}`).filter(p => !keep.has(p))
    if (old.length) await admin.storage.from(BUCKET).remove(old)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`generate-cover ${kind}/${id}:`, msg)
    await admin.from(table).update({
      [`${col}_status`]: 'error',
      [`${col}_error`]: msg.slice(0, 300),
      [`${col}_updated_at`]: new Date().toISOString(),
    }).eq('id', id)
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo non ammesso' }, 405)

  try {
    const admin = adminClient()
    const user = await requireUser(admin, req)

    const body = await req.json().catch(() => ({}))
    const kind: Kind | null = body.kind === 'lesson' || body.kind === 'live' || body.kind === 'category' ? body.kind : null
    const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null
    const feedback = typeof body.feedback === 'string' ? body.feedback.trim().slice(0, MAX_FEEDBACK_CHARS) : ''
    if (!kind || !id) return json({ ok: false, error: 'Parametri non validi' }, 400)

    // Permessi PRIMA di leggere il contenuto (chi non può non scopre se esiste).
    const userIsAdmin = await isAdmin(admin, user.id)
    if (kind === 'lesson' && !userIsAdmin) throw new HttpError(403, 'Solo un admin può generare la copertina di una lezione')
    if (kind === 'category' && !userIsAdmin) throw new HttpError(403, 'Solo un admin può generare la locandina di una serie')
    const ctx = kind === 'lesson' ? await loadLessonContext(admin, id)
      : kind === 'category' ? await loadCategoryContext(admin, id)
      : await loadLiveContext(admin, id)
    if (!userIsAdmin && ctx.ownerId !== user.id) throw new HttpError(403, 'Solo un admin o chi ha creato la live può generarne la copertina')

    const col = COL[kind]
    const { error: pendErr } = await admin.from(TABLE[kind]).update({
      [`${col}_status`]: 'pending',
      [`${col}_error`]: null,
      [`${col}_updated_at`]: new Date().toISOString(),
    }).eq('id', id)
    if (pendErr) throw new Error(`stato: ${pendErr.message}`)

    const job = runJob(admin, kind, id, ctx, feedback)
    const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
    if (edge?.waitUntil) {
      edge.waitUntil(job)
      return json({ ok: true, status: 'pending' }, 202)
    }
    // Fuori dall'edge runtime (es. test locali) aspettiamo la fine.
    await job
    return json({ ok: true, status: 'done' })
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const msg = e instanceof Error ? e.message : 'Errore'
    if (status === 500) console.error('generate-cover:', msg)
    return json({ ok: false, error: msg }, status)
  }
})
