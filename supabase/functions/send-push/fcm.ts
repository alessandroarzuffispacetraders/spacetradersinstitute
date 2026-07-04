// Push NATIVE per ANDROID via FCM HTTP v1. No-op finché FCM_SERVICE_ACCOUNT non è
// configurato (il ramo APNs/iOS in apns.ts resta totalmente indipendente).
// Autentica con un service account: firma un JWT RS256 → access token OAuth2 →
// POST a fcm.googleapis.com/v1/projects/<id>/messages:send.

const SERVICE_ACCOUNT_RAW = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? ''

let sa: { client_email: string; private_key: string; project_id: string } | null = null
try { if (SERVICE_ACCOUNT_RAW) sa = JSON.parse(SERVICE_ACCOUNT_RAW) } catch { sa = null }

let cachedToken: { token: string; exp: number } | null = null

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

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

// Access token OAuth2 (scope firebase.messaging), con cache in memoria ~1h.
async function getAccessToken(): Promise<string | null> {
  if (!sa) return null
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signingInput = `${header}.${claims}`
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) }
  return data.access_token
}

// Invia il payload a una lista di token FCM. Ritorna { sent, dead } (i dead = token
// non più registrati, da rimuovere dal DB — stesso schema di sendApns).
export async function sendFcm(
  tokens: string[],
  payload: { title: string; body: string; url?: string; channelId?: string },
): Promise<{ sent: number; dead: string[] }> {
  if (!sa || tokens.length === 0) return { sent: 0, dead: [] }
  const accessToken = await getAccessToken()
  if (!accessToken) return { sent: 0, dead: [] }

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  let sent = 0
  const dead: string[] = []

  await Promise.all(tokens.map(async (token) => {
    const message = {
      message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: {
          ...(payload.url ? { url: payload.url } : {}),
          ...(payload.channelId ? { channel_id: payload.channelId } : {}),
        },
        android: {
          priority: 'HIGH',
          notification: {
            sound: 'default',
            ...(payload.channelId ? { tag: payload.channelId } : {}),
          },
        },
      },
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
      if (res.status === 200) { sent++; return }
      // 404 UNREGISTERED = token non più valido → pulizia.
      if (res.status === 404) { dead.push(token); return }
    } catch { /* rete: ignora, non marcare morto */ }
  }))

  return { sent, dead }
}
