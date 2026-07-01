import webPush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

webPush.setVapidDetails(
  'mailto:admin@innerspacetrad.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REST_HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
}

// Invia un payload già pronto a una lista di subscription; pulisce gli endpoint morti.
async function sendToSubscriptions(
  subscriptions: { endpoint: string; keys: Record<string, string> }[],
  payload: string,
) {
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload),
    ),
  )
  const sent = results.filter((r) => r.status === 'fulfilled').length
  const dead = results
    .map((r, i) => (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? subscriptions[i].endpoint : null))
    .filter((e): e is string => e !== null)
  if (dead.length > 0) {
    await Promise.all(dead.map((endpoint) =>
      fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: 'DELETE', headers: REST_HEADERS,
      }).catch(() => {/* ignora */})
    ))
  }
  return { sent, total: subscriptions.length }
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Estrae il `sub` (user id) dal JWT del chiamante (base64url → JSON del payload).
function callerId(req: Request): string | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const parts = token.split('.')
  if (parts.length < 3) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(b64))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch { return null }
}

async function getProfile(userId: string): Promise<{ role: string; roles: string[] | null } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,roles`, { headers: REST_HEADERS })
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

function hasRole(p: { role: string; roles: string[] | null } | null, r: string): boolean {
  return !!p && (p.role === r || (p.roles ?? []).includes(r))
}

async function subsForUserIds(ids: string[]): Promise<{ endpoint: string; keys: Record<string, string> }[]> {
  if (ids.length === 0) return []
  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${ids.join(',')})&select=endpoint,keys`, { headers: REST_HEADERS })
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

// Notifiche "di sistema" per le segnalazioni. Testo e destinatari sono decisi
// qui e il RUOLO del chiamante è verificato → niente push arbitrarie.
type NotifyBody = { type?: string; recipientId?: string; authorName?: string | null; studentName?: string | null }

async function handleNotify(notify: NotifyBody, req: Request) {
  const caller = callerId(req)
  if (!caller) return jsonRes({ error: 'unauthenticated' }, 401)
  const callerProfile = await getProfile(caller)

  // Segnalazione creata da coach/mental → notifica TUTTI gli admin.
  if (notify.type === 'flag_to_admin') {
    if (!(hasRole(callerProfile, 'coach') || hasRole(callerProfile, 'mental_coach') || hasRole(callerProfile, 'admin'))) {
      return jsonRes({ error: 'forbidden' }, 403)
    }
    const adminsRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.admin&select=id`, { headers: REST_HEADERS })
    const admins = await adminsRes.json().catch(() => [])
    const ids = (Array.isArray(admins) ? admins : []).map((a: { id: string }) => a.id)
    const subs = await subsForUserIds(ids)
    if (subs.length === 0) return jsonRes({ sent: 0 })
    const author = (notify.authorName ?? '').trim() || 'Un membro dello staff'
    const student = (notify.studentName ?? '').trim()
    const title = '📩 Nuova segnalazione'
    const body = `${author} ha inviato una segnalazione${student ? ` su ${student}` : ''}.`
    return jsonRes(await sendToSubscriptions(subs, JSON.stringify({ title, body, url: '/admin/segnalazioni' })))
  }

  // Segnalazione inviata dall'admin → notifica il destinatario (coach/mental).
  if (notify.type === 'flag_to_recipient') {
    if (!hasRole(callerProfile, 'admin')) return jsonRes({ error: 'forbidden' }, 403)
    const recipientId = notify.recipientId
    if (!recipientId) return jsonRes({ error: 'missing recipient' }, 400)
    const subs = await subsForUserIds([recipientId])
    if (subs.length === 0) return jsonRes({ sent: 0 })
    const recipient = await getProfile(recipientId)
    const url = hasRole(recipient, 'mental_coach') && !hasRole(recipient, 'coach')
      ? '/mental-coach/segnalazioni' : '/coach/segnalazioni'
    const student = (notify.studentName ?? '').trim()
    const title = '📩 Nuova segnalazione dall\'admin'
    const body = `Hai ricevuto una segnalazione dall'admin${student ? ` su ${student}` : ''}.`
    return jsonRes(await sendToSubscriptions(subs, JSON.stringify({ title, body, url })))
  }

  return jsonRes({ error: 'unknown notify type' }, 400)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const payload = await req.json() as {
      message?: { channel_id: string; user_id: string; author_name: string; content: string }
      notify?: NotifyBody
    }

    // Modalità notifica di sistema per le segnalazioni (verifica il ruolo del chiamante).
    if (payload.notify) return await handleNotify(payload.notify, req)

    const message = payload.message!

    // Determina a chi mandare la notifica
    let userFilter = `user_id=neq.${message.user_id}`

    // Per DM (channel_id: "dm_uid1_uid2"), notifica solo l'altro utente
    if (message.channel_id.startsWith('dm_')) {
      const parts = message.channel_id.replace('dm_', '').split('_')
      const recipient = parts.find((id: string) => id !== message.user_id)
      if (recipient) userFilter = `user_id=eq.${recipient}`
    }

    // Recupera le subscription di tutti i destinatari
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?${userFilter}&select=endpoint,keys`,
      { headers: REST_HEADERS },
    )
    const subscriptions: { endpoint: string; keys: Record<string, string> }[] = await res.json()

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = message.content.length > 100 ? message.content.slice(0, 100) + '…' : message.content

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webPush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: message.author_name, body, channel_id: message.channel_id }),
        )
      ),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length

    // Rimuovi gli endpoint morti (410 Gone / 404) così non restano duplicati
    const dead = results
      .map((r, i) => (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? subscriptions[i].endpoint : null))
      .filter((e): e is string => e !== null)

    if (dead.length > 0) {
      await Promise.all(dead.map((endpoint) =>
        fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }).catch(() => {/* ignora */})
      ))
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-push error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
