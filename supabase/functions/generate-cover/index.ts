// Copertine di lezioni e live e locandine delle sezioni: sempre dalla SCORTA
// (tabella cover_pool), cioè grafici quant "fotografati" nello stesso stile di
// tutte le altre copertine, con la versione scura e quella chiara.
//
// Prima questa funzione faceva disegnare a Claude un'illustrazione SVG (stile
// diverso, nessuna versione chiara). Ora qualunque «Genera», anche dalle
// versioni dell'app già installate, assegna un'immagine della scorta mai usata,
// scelta per tema (mente per il Mental Coach, trading per il resto) e per i tag
// presenti nel titolo. Le immagini si preparano con scripts/covers/plan_pool.py.
//
// POST { kind: 'lesson' | 'live' | 'category', id: uuid }
//  - permessi e scelta li fanno le funzioni del database (claim_lesson_cover,
//    claim_live_cover, claim_category_poster), chiamate con il token di chi
//    preme il pulsante: lezioni e sezioni solo admin, live admin o chi l'ha creata.
//  - risposta { ok: true, status: 'done', coverUrl, left } oppure { ok: false, error }.
//    Le app più vecchie dopo la risposta rileggono cover_status / poster_status:
//    la riga è già 'ready' con la nuova immagine.
//  - mode 'prompt' (vecchio flusso con ChatGPT) non esiste più.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { CORS, json, adminClient, HttpError } from '../_shared/http.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Kind = 'lesson' | 'live' | 'category'

// Client con il token dell'utente: le funzioni claim_* verificano auth.uid().
function userClient(token: string): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

// Parola chiave dal titolo (stessa regola di keywordFromTitle in src/lib/live.ts):
// la parte dopo "titolo: …" se c'è, senza parole vuote, al massimo 16 caratteri.
const STOP = new Set(['e', 'ed', 'di', 'del', 'della', 'dei', 'delle', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'per', 'con', 'su', 'in', 'a', 'da', 'al', 'alla', 'live', 'zoom', 'sessione', 'the', 'and', 'of'])
function keywordFromTitle(title: string): string {
  const parts = title.split(/\s[-–—:|]\s|:\s/)
  const tail = (parts.length > 1 ? parts[parts.length - 1] : title).replace(/\(.*?\)/g, ' ')
  const words = tail.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}&%+#']/gu, '')).filter(w => w && !STOP.has(w.toLowerCase()))
  if (!words.length) return title.trim().toUpperCase().slice(0, 16)
  const two = words.slice(0, 2).join(' ')
  const pick = two.length <= 16 ? two : words.reduce((a, b) => (b.length > a.length ? b : a))
  return pick.toUpperCase()
}

// Lezioni e live: se la riga non ha ancora una parola chiave, ne proponiamo una
// dal titolo (quella esistente non si tocca).
async function keywordFor(admin: SupabaseClient, kind: Kind, id: string): Promise<string | null> {
  if (kind === 'category') return null
  const { data } = await admin.from(kind === 'lesson' ? 'lessons' : 'live_events').select('title, cover_keyword').eq('id', id).maybeSingle()
  if (!data) throw new HttpError(404, kind === 'lesson' ? 'Lezione non trovata' : 'Live non trovata')
  return data.cover_keyword ? null : keywordFromTitle(data.title ?? '')
}

function rpcFor(kind: Kind, id: string, keyword: string | null): [string, Record<string, unknown>] {
  if (kind === 'lesson') return ['claim_lesson_cover', { p_lesson_id: id, p_keyword: keyword, p_force: true }]
  if (kind === 'live') return ['claim_live_cover', { p_live_id: id, p_keyword: keyword, p_force: true }]
  return ['claim_category_poster', { p_category_id: id, p_force: true }]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo non ammesso' }, 405)

  try {
    const admin = adminClient()
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) throw new HttpError(401, 'Non autenticato')
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) throw new HttpError(401, 'Token non valido')

    const body = await req.json().catch(() => ({}))
    if (body.mode === 'prompt') {
      return json({ ok: false, error: 'I prompt per ChatGPT non si usano più: premi «Genera» per avere una copertina nello stile della piattaforma.' }, 400)
    }
    const kind: Kind | null = body.kind === 'lesson' || body.kind === 'live' || body.kind === 'category' ? body.kind : null
    const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null
    if (!kind || !id) return json({ ok: false, error: 'Parametri non validi' }, 400)

    const keyword = await keywordFor(admin, kind, id)
    const [fn, args] = rpcFor(kind, id, keyword)
    const { data, error } = await userClient(token).rpc(fn, args)
    if (error) {
      const msg = error.message ?? ''
      if (/non autorizzato/i.test(msg)) throw new HttpError(403, 'Non hai i permessi per cambiare questa copertina')
      if (/non trovat/i.test(msg)) throw new HttpError(404, msg)
      if (/claim_|PGRST202|42883|does not exist/i.test(`${error.code} ${msg}`)) {
        throw new HttpError(500, "Manca l'aggiornamento del database per la scorta delle copertine (phase_cover_pool_posters.sql).")
      }
      throw new Error(msg || 'Assegnazione non riuscita')
    }
    const res = (data ?? {}) as { status?: string; cover_url?: string; left?: number }
    if (res.status === 'empty') {
      return json({ ok: false, error: 'La scorta di copertine è finita: vanno preparate immagini nuove.' }, 409)
    }
    return json({ ok: true, status: 'done', coverUrl: res.cover_url ?? null, left: res.left ?? null })
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const msg = e instanceof Error ? e.message : 'Errore'
    if (status === 500) console.error('generate-cover:', msg)
    return json({ ok: false, error: msg }, status)
  }
})
