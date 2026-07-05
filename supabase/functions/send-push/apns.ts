// Invio push NATIVE APNs (iOS) per Supabase Edge Functions (Deno).
//
// ⚠️ SCAFFOLD: finché non sono impostate le variabili APNS_* (servono l'account
// Apple Developer a pagamento + una "APNs Auth Key" .p8), apnsConfigured() è false
// e sendApns() è un no-op → le push web continuano a funzionare, le native no.
//
// Setup quando l'account è approvato (vedi docs/lancio-app-nativa.md):
//   supabase secrets set APNS_KEY_ID=XXXXXXXXXX
//   supabase secrets set APNS_TEAM_ID=YYYYYYYYYY
//   supabase secrets set APNS_BUNDLE_ID=com.spacetradersinstitute.app
//   supabase secrets set APNS_AUTH_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
//   supabase secrets set APNS_PRODUCTION=true    # solo "primo tentativo": sendApns
//     ripiega comunque sull'altro ambiente su BadDeviceToken, quindi dev (sandbox) e
//     TestFlight/App Store (production) funzionano entrambi a prescindere dal valore.

const KEY_ID = Deno.env.get('APNS_KEY_ID') ?? ''
const TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? ''
const BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') ?? ''
const AUTH_KEY = Deno.env.get('APNS_AUTH_KEY') ?? '' // contenuto PEM del file .p8
const PRODUCTION = (Deno.env.get('APNS_PRODUCTION') ?? 'false').toLowerCase() === 'true'

export function apnsConfigured(): boolean {
  return !!(KEY_ID && TEAM_ID && BUNDLE_ID && AUTH_KEY)
}

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Estrae il DER PKCS#8 dal PEM della chiave .p8.
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

let cachedKey: CryptoKey | null = null
async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey
  cachedKey = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(AUTH_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  )
  return cachedKey
}

// Il provider token JWT (ES256) è valido fino a 1h; Apple chiede di NON rigenerarlo
// più di una volta ogni ~20 min → lo teniamo in cache.
let cachedJwt: { token: string; iat: number } | null = null
async function providerToken(nowSec: number): Promise<string> {
  if (cachedJwt && nowSec - cachedJwt.iat < 1800) return cachedJwt.token
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }))
  const claims = b64url(JSON.stringify({ iss: TEAM_ID, iat: nowSec }))
  const signingInput = `${header}.${claims}`
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await getSigningKey(),
    new TextEncoder().encode(signingInput),
  )
  const token = `${signingInput}.${b64url(sig)}`
  cachedJwt = { token, iat: nowSec }
  return token
}

export type ApnsPayload = { title: string; body: string; url?: string; channelId?: string }

// Invia a una lista di device token. Ritorna quanti inviati e i token "morti"
// (410 / BadDeviceToken / Unregistered) da rimuovere dal DB. No-op se non configurato.
export async function sendApns(tokens: string[], payload: ApnsPayload): Promise<{ sent: number; dead: string[] }> {
  if (!apnsConfigured() || tokens.length === 0) return { sent: 0, dead: [] }

  const nowSec = Math.floor(Date.now() / 1000)
  const jwt = await providerToken(nowSec)

  // Un device token è "production" (TestFlight/App Store) oppure "sandbox" (build
  // di sviluppo) a seconda dell'entitlement aps-environment con cui è stato firmato
  // il build. Con un solo endpoint globale metà dei token fallisce (BadDeviceToken).
  // Proviamo l'ambiente indicato da APNS_PRODUCTION e, in caso di BadDeviceToken,
  // ripieghiamo sull'altro → coprono entrambi senza doverlo sapere per ogni token.
  const PRIMARY = PRODUCTION ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  const SECONDARY = PRODUCTION ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'

  const apsBody = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default', 'thread-id': payload.channelId },
    // Chiavi custom lette dal client (Capacitor le mappa in notification.data)
    url: payload.url,
    channel_id: payload.channelId,
  })

  const postTo = async (host: string, token: string) => {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body: apsBody,
    })
    if (res.status === 200) return { ok: true as const, status: 200, reason: '' }
    return { ok: false as const, status: res.status, reason: await res.text().catch(() => '') }
  }

  const results = await Promise.allSettled(tokens.map(async (token) => {
    let r = await postTo(PRIMARY, token)
    // BadDeviceToken = ambiente sbagliato per QUESTO token → ritenta sull'altro.
    if (!r.ok && /BadDeviceToken/i.test(r.reason)) r = await postTo(SECONDARY, token)
    return { token, ...r }
  }))

  let sent = 0
  const dead: string[] = []
  for (const res of results) {
    if (res.status !== 'fulfilled') continue
    const r = res.value
    if (r.ok) { sent++; continue }
    // Morto solo se non valido in ENTRAMBI gli ambienti (BadDeviceToken dopo il
    // fallback) o app disinstallata (410/Unregistered). Auth/transienti (403/429/5xx)
    // NON cancellano il token.
    if (r.status === 410 || /BadDeviceToken|Unregistered/i.test(r.reason)) {
      dead.push(r.token)
    } else {
      console.warn('APNs send failed:', r.status, (r.reason ?? '').slice(0, 200))
    }
  }
  return { sent, dead }
}
