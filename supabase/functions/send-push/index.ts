import webPush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendApns } from './apns.ts'
import { sendFcm } from './fcm.ts'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

// Client service-role usato SOLO per verificare crittograficamente il JWT del
// chiamante (getUser). Necessario perché questa funzione gira con verify_jwt=false
// per compatibilità: il decode "a mano" del token NON verifica la firma ed è
// falsificabile, quindi ogni identità va confermata con getUser().
const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

async function verifyCaller(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id }
}

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

// Una subscription può essere WEB (endpoint + chiavi VAPID) o NATIVA (device token
// APNs in native_token, platform 'ios'/'android').
type Sub = { endpoint: string; keys: Record<string, string>; platform?: string; native_token?: string | null }
type PushPayload = { title: string; body: string; url?: string; channel_id?: string }

// Invia un payload a una lista mista di subscription: le web via Web Push (VAPID),
// le native via APNs (no-op finché non configurato). Pulisce endpoint e token morti.
async function dispatch(subscriptions: Sub[], payload: PushPayload) {
  const web = subscriptions.filter((s) => !s.native_token)
  const native = subscriptions.filter((s) => !!s.native_token)

  // ── WEB PUSH ──────────────────────────────────────────────────────────────
  const webJson = JSON.stringify(payload)
  const webResults = await Promise.allSettled(
    web.map((s) => webPush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, webJson)),
  )
  let sent = webResults.filter((r) => r.status === 'fulfilled').length
  const deadEndpoints = webResults
    .map((r, i) => (r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0) ? web[i].endpoint : null))
    .filter((e): e is string => e !== null)

  // ── NATIVE PUSH — split per piattaforma: iOS→APNs, Android→FCM ───────────────
  // (prima TUTTI i token native andavano ad APNs, quindi i token FCM di Android
  // non venivano mai consegnati). Ognuno no-op finché il rispettivo secret manca.
  const nativePayload = { title: payload.title, body: payload.body, url: payload.url, channelId: payload.channel_id }
  const iosTokens = native.filter((s) => s.platform !== 'android').map((s) => s.native_token as string)
  const androidTokens = native.filter((s) => s.platform === 'android').map((s) => s.native_token as string)
  const [apns, fcm] = await Promise.all([
    sendApns(iosTokens, nativePayload),
    sendFcm(androidTokens, nativePayload),
  ])
  sent += apns.sent + fcm.sent
  const deadTokens = [...apns.dead, ...fcm.dead]

  // ── Pulizia dei destinatari morti ──────────────────────────────────────────
  if (deadEndpoints.length > 0) {
    await Promise.all(deadEndpoints.map((endpoint) =>
      fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: 'DELETE', headers: REST_HEADERS,
      }).catch(() => {/* ignora */})
    ))
  }
  if (deadTokens.length > 0) {
    await Promise.all(deadTokens.map((tok) =>
      fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?native_token=eq.${encodeURIComponent(tok)}`, {
        method: 'DELETE', headers: REST_HEADERS,
      }).catch(() => {/* ignora */})
    ))
  }

  return { sent, total: subscriptions.length }
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function getProfile(userId: string): Promise<{ name: string | null; role: string; roles: string[] | null } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=name,role,roles`, { headers: REST_HEADERS })
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

function hasRole(p: { role: string; roles: string[] | null } | null, r: string): boolean {
  return !!p && (p.role === r || (p.roles ?? []).includes(r))
}

async function subsForUserIds(ids: string[]): Promise<Sub[]> {
  if (ids.length === 0) return []
  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${ids.join(',')})&select=endpoint,keys,platform,native_token`, { headers: REST_HEADERS })
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows : []
}

// Notifiche "di sistema" per le segnalazioni. Testo e destinatari sono decisi
// qui e il RUOLO del chiamante è verificato → niente push arbitrarie.
type NotifyBody = {
  type?: string; recipientId?: string; authorName?: string | null; studentName?: string | null
  // broadcast (admin → studenti)
  title?: string; body?: string; url?: string; tier?: 'all' | 'full' | 'free'
}

async function handleNotify(notify: NotifyBody, req: Request) {
  const caller = await verifyCaller(req)
  if (!caller) return jsonRes({ error: 'unauthenticated' }, 401)
  const callerProfile = await getProfile(caller.id)

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
    return jsonRes(await dispatch(subs, { title, body, url: '/admin/segnalazioni' }))
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
    return jsonRes(await dispatch(subs, { title, body, url }))
  }

  // Annuncio broadcast dell'admin → tutti gli studenti (o un segmento per tier).
  // Titolo/testo sono dell'admin (fidato: ruolo verificato).
  if (notify.type === 'broadcast') {
    if (!hasRole(callerProfile, 'admin')) return jsonRes({ error: 'forbidden' }, 403)
    const body = (notify.body ?? '').trim()
    if (!body) return jsonRes({ error: 'missing body' }, 400)
    const title = (notify.title ?? '').trim() || '📢 Annuncio IST'
    let q = `${SUPABASE_URL}/rest/v1/profiles?role=eq.student&select=id`
    if (notify.tier === 'free') q += '&tier=eq.free'
    else if (notify.tier === 'full') q += '&or=(tier.eq.full,tier.is.null)'
    const res = await fetch(q, { headers: REST_HEADERS })
    const students = await res.json().catch(() => [])
    const ids = (Array.isArray(students) ? students : []).map((s: { id: string }) => s.id)
    const subs = await subsForUserIds(ids)
    if (subs.length === 0) return jsonRes({ sent: 0, total: 0 })
    const url = (notify.url ?? '').trim() || '/student'
    const shortBody = body.length > 140 ? body.slice(0, 140) + '…' : body
    return jsonRes(await dispatch(subs, { title, body: shortBody, url }))
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

    // Verifica crittografica del chiamante: deve essere l'AUTORE del messaggio
    // (niente push falsificate a nome di altri utenti / canali arbitrari). Il
    // titolo usa il nome REALE dal profilo, non quello passato dal client.
    const caller = await verifyCaller(req)
    if (!caller) return jsonRes({ error: 'unauthenticated' }, 401)
    if (caller.id !== message.user_id) return jsonRes({ error: 'forbidden' }, 403)
    const senderName = (await getProfile(caller.id))?.name?.trim() || 'Nuovo messaggio'

    // Determina a chi mandare la notifica
    let userFilter = `user_id=neq.${message.user_id}`

    // Per DM (channel_id: "dm_uid1_uid2"), notifica solo l'altro utente
    if (message.channel_id.startsWith('dm_')) {
      const parts = message.channel_id.replace('dm_', '').split('_')
      const recipient = parts.find((id: string) => id !== message.user_id)
      if (recipient) userFilter = `user_id=eq.${recipient}`
    }

    // Recupera le subscription (web + native) di tutti i destinatari
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?${userFilter}&select=endpoint,keys,platform,native_token`,
      { headers: REST_HEADERS },
    )
    const subscriptions: Sub[] = await res.json()

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const body = message.content.length > 100 ? message.content.slice(0, 100) + '…' : message.content

    // La chat "d'uso" (community + DM) è /student/chat per tutti i ruoli:
    // click sulla notifica → apre direttamente il canale/DM interessato.
    const url = `/student/chat?c=${encodeURIComponent(message.channel_id)}`

    const result = await dispatch(subscriptions, { title: senderName, body, url, channel_id: message.channel_id })

    return new Response(JSON.stringify(result), {
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
