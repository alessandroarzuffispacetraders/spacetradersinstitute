import webPush from 'npm:web-push@3.6.7'
import { sendApns } from '../send-push/apns.ts'
import { sendFcm } from '../send-push/fcm.ts'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

webPush.setVapidDetails('mailto:admin@innerspacetrad.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const REST = `${SUPABASE_URL}/rest/v1`
const HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }

// Offset prima dello start (ms) + copy della notifica.
const HOUR = 3_600_000
const DAY = 24 * HOUR
const OFFSETS: { kind: string; ms: number; label: string }[] = [
  { kind: '2d',    ms: 2 * DAY, label: 'tra 2 giorni' },
  { kind: '1d',    ms: 1 * DAY, label: 'domani' },
  { kind: '5h',    ms: 5 * HOUR, label: 'tra 5 ore' },
  { kind: '1h',    ms: 1 * HOUR, label: 'tra 1 ora' },
  { kind: 'start', ms: 0,        label: 'è iniziata!' },
]
// Annuncio Zoom (bacheca + push all'audience) "poco prima" dell'inizio.
const ZOOM_ANNOUNCE_MS = 15 * 60_000
const WINDOW = HOUR // un trigger può partire fino a 1h dopo (copre il gap tra i run del cron)

interface LiveRow {
  id: string; title: string; starts_at: string; status: string
  is_external: boolean; audience: string; zoom_url: string | null
}
interface Sub {
  endpoint: string; keys: Record<string, string>; user_id: string
  native_token: string | null; platform: string | null
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: HEADERS })
  return await r.json() as T
}

// Invio a una lista MISTA di subscription: web via VAPID, native via APNs (iOS) /
// FCM (Android). Ritorna endpoint web morti + token native morti da ripulire.
async function dispatchAll(subs: Sub[], payload: { title: string; body: string; url: string }) {
  const web = subs.filter(s => !s.native_token)
  const ios = subs.filter(s => s.native_token && s.platform === 'ios').map(s => s.native_token as string)
  const android = subs.filter(s => s.native_token && s.platform === 'android').map(s => s.native_token as string)

  const webJson = JSON.stringify(payload)
  const webResults = await Promise.allSettled(
    web.map(s => webPush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, webJson)),
  )
  let sent = webResults.filter(r => r.status === 'fulfilled').length
  const deadEndpoints = webResults
    .map((r, i) => (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? web[i].endpoint : null))
    .filter((e): e is string => e !== null)

  const ap = await sendApns(ios, { title: payload.title, body: payload.body, url: payload.url })
  const fc = await sendFcm(android, { title: payload.title, body: payload.body, url: payload.url })
  sent += ap.sent + fc.sent
  return { sent, deadEndpoints, deadTokens: [...ap.dead, ...fc.dead] }
}

// Studenti destinatari in base all'audience della live ('all' | 'full' | 'free').
const idsCache = new Map<string, string[]>()
async function studentIdsFor(audience: string): Promise<string[]> {
  if (idsCache.has(audience)) return idsCache.get(audience)!
  let q = `${REST}/profiles?select=id&role=eq.student`
  if (audience === 'free') q += '&tier=eq.free'
  else if (audience === 'full') q += '&or=(tier.eq.full,tier.is.null)'
  const rows = await getJson<{ id: string }[]>(q)
  const ids = (rows ?? []).map(r => r.id)
  idsCache.set(audience, ids)
  return ids
}

const subsCache = new Map<string, Sub[]>()
async function subsFor(audience: string): Promise<Sub[]> {
  if (subsCache.has(audience)) return subsCache.get(audience)!
  const ids = await studentIdsFor(audience)
  if (ids.length === 0) { subsCache.set(audience, []); return [] }
  const subs = await getJson<Sub[]>(
    `${REST}/push_subscriptions?select=endpoint,keys,user_id,native_token,platform&user_id=in.(${ids.join(',')})`,
  )
  const arr = Array.isArray(subs) ? subs : []
  subsCache.set(audience, arr)
  return arr
}

// "Claim" atomico del dedup (live, kind): true = da inviare ora, false = già fatto.
async function claim(liveId: string, kind: string): Promise<boolean> {
  const res = await fetch(`${REST}/live_reminders_sent`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ live_event_id: liveId, kind }),
  })
  const rows = await res.json().catch(() => [])
  return Array.isArray(rows) && rows.length > 0
}

async function cleanupDead(endpoints: string[], tokens: string[]) {
  await Promise.all([
    ...[...new Set(endpoints)].map(e =>
      fetch(`${REST}/push_subscriptions?endpoint=eq.${encodeURIComponent(e)}`, { method: 'DELETE', headers: HEADERS }).catch(() => {})),
    ...[...new Set(tokens)].map(t =>
      fetch(`${REST}/push_subscriptions?native_token=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: HEADERS }).catch(() => {})),
  ])
}

// Posta il link Zoom nella bacheca "Link Zoom" a nome del primo admin (service role
// → bypassa la RLS, quindi funziona anche per live create da coach/mental).
async function postZoomToBacheca(live: LiveRow) {
  const admins = await getJson<{ id: string; name: string | null }[]>(
    `${REST}/profiles?select=id,name&role=eq.admin&order=created_at.asc&limit=1`,
  )
  const admin = Array.isArray(admins) ? admins[0] : null
  if (!admin) return
  const when = new Date(live.starts_at).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const content = `🔗 Entra nella live su Zoom:\n${live.zoom_url}\n\n🕒 Inizio: ${when}`
  await fetch(`${REST}/bacheca_posts`, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({
      channel_id: 'link-zoom', author_id: admin.id, author_name: admin.name ?? 'Admin',
      author_role: 'admin', title: live.title, content, pinned: false,
    }),
  }).catch(() => {/* ignora */})
}

Deno.serve(async (req) => {
  // Autorizzazione: solo il cron (header segreto) può triggerare gli invii.
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  try {
    const now = Date.now()

    // Solo le LIVE vere (i reminder di calendario, event_type='reminder', non notificano).
    const lives = await getJson<LiveRow[]>(
      `${REST}/live_events?select=id,title,starts_at,status,is_external,audience,zoom_url&status=in.(upcoming,live)&starts_at=not.is.null&event_type=eq.live`,
    )
    if (!Array.isArray(lives) || lives.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0 }), { status: 200 })
    }

    const dueNormal: { live: LiveRow; kind: string; label: string }[] = []
    const dueZoom: LiveRow[] = []
    for (const live of lives) {
      const startMs = Date.parse(live.starts_at)
      if (Number.isNaN(startMs)) continue
      for (const o of OFFSETS) {
        const trigger = startMs - o.ms
        if (now >= trigger && now < trigger + WINDOW) dueNormal.push({ live, kind: o.kind, label: o.label })
      }
      if (live.is_external && live.zoom_url) {
        const t = startMs - ZOOM_ANNOUNCE_MS
        if (now >= t && now < t + WINDOW) dueZoom.push(live)
      }
    }
    if (dueNormal.length === 0 && dueZoom.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0 }), { status: 200 })
    }

    const deadEndpoints: string[] = []
    const deadTokens: string[] = []
    let totalSent = 0

    // ── Reminder normali: a TUTTI gli studenti (web + native) ──
    for (const item of dueNormal) {
      if (!(await claim(item.live.id, item.kind))) continue
      const title = item.kind === 'start' ? '🔴 La live è iniziata!' : '📅 Live in arrivo'
      const body = item.kind === 'start'
        ? `«${item.live.title}» è in diretta ora. Entra!`
        : `«${item.live.title}» ${item.label}`
      const r = await dispatchAll(await subsFor('all'), { title, body, url: `/student/live/${item.live.id}` })
      totalSent += r.sent; deadEndpoints.push(...r.deadEndpoints); deadTokens.push(...r.deadTokens)
    }

    // ── Annuncio Zoom (live esterne): post in bacheca "Link Zoom" + push all'audience ──
    for (const live of dueZoom) {
      if (!(await claim(live.id, 'zoom'))) continue
      await postZoomToBacheca(live)
      const r = await dispatchAll(await subsFor(live.audience ?? 'all'), {
        title: `🔗 Link Zoom — ${live.title}`,
        body: 'La live sta per iniziare su Zoom. Tocca per il link e partecipa.',
        url: '/student/chat?c=link-zoom',
      })
      totalSent += r.sent; deadEndpoints.push(...r.deadEndpoints); deadTokens.push(...r.deadTokens)
    }

    await cleanupDead(deadEndpoints, deadTokens)

    return new Response(JSON.stringify({ ok: true, normal: dueNormal.length, zoom: dueZoom.length, sent: totalSent }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('live-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
