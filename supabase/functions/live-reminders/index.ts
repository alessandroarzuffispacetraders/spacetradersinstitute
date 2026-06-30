import webPush from 'npm:web-push@3.6.7'

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
const WINDOW = HOUR // un reminder può partire fino a 1h dopo il suo trigger (copre il gap tra i run del cron)

interface LiveRow { id: string; title: string; starts_at: string; status: string }
interface Sub { endpoint: string; keys: Record<string, string>; user_id: string }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: HEADERS })
  return await r.json() as T
}

Deno.serve(async (req) => {
  // Autorizzazione: solo il cron (header segreto) può triggerare gli invii.
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  try {
    const now = Date.now()

    const lives = await getJson<LiveRow[]>(
      `${REST}/live_events?select=id,title,starts_at,status&status=in.(upcoming,live)&starts_at=not.is.null`,
    )
    if (!Array.isArray(lives) || lives.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0 }), { status: 200 })
    }

    // Calcola i reminder dovuti adesso (entro la finestra).
    const due: { live: LiveRow; kind: string; label: string }[] = []
    for (const live of lives) {
      const startMs = Date.parse(live.starts_at)
      if (Number.isNaN(startMs)) continue
      for (const o of OFFSETS) {
        const trigger = startMs - o.ms
        if (now >= trigger && now < trigger + WINDOW) {
          due.push({ live, kind: o.kind, label: o.label })
        }
      }
    }
    if (due.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0 }), { status: 200 })
    }

    // Destinatari: tutti gli studenti con almeno una push subscription.
    const students = await getJson<{ id: string }[]>(`${REST}/profiles?select=id&role=eq.student`)
    const ids = (students ?? []).map(s => s.id)
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: due.length, recipients: 0 }), { status: 200 })
    }
    const subs = await getJson<Sub[]>(
      `${REST}/push_subscriptions?select=endpoint,keys,user_id&user_id=in.(${ids.join(',')})`,
    )

    let totalSent = 0
    const dead: string[] = []

    for (const item of due) {
      // "Claim" atomico: inserisce la riga di dedup; se è in conflitto (già
      // inviato) salta. ignore-duplicates → array vuoto se già presente.
      const claimRes = await fetch(`${REST}/live_reminders_sent`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ live_event_id: item.live.id, kind: item.kind }),
      })
      const claimed = await claimRes.json().catch(() => [])
      if (!Array.isArray(claimed) || claimed.length === 0) continue // già inviato

      const title = item.kind === 'start' ? '🔴 La live è iniziata!' : '📅 Live in arrivo'
      const body = item.kind === 'start'
        ? `«${item.live.title}» è in diretta ora. Entra!`
        : `«${item.live.title}» ${item.label}`
      const payload = JSON.stringify({ title, body, url: `/student/live/${item.live.id}` })

      const results = await Promise.allSettled(
        (subs ?? []).map(sub =>
          webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload),
        ),
      )
      totalSent += results.filter(r => r.status === 'fulfilled').length
      results.forEach((r, i) => {
        if (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)) {
          dead.push((subs ?? [])[i].endpoint)
        }
      })
    }

    // Pulisce gli endpoint morti (come send-push).
    if (dead.length > 0) {
      await Promise.all([...new Set(dead)].map(endpoint =>
        fetch(`${REST}/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
          method: 'DELETE', headers: HEADERS,
        }).catch(() => {/* ignora */}),
      ))
    }

    return new Response(JSON.stringify({ ok: true, due: due.length, sent: totalSent }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('live-reminders error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
