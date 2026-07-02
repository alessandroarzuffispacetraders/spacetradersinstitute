// Registra un accesso: legge l'IP reale del client, lo geolocalizza e lo salva
// in `access_logs`. Chiamata dal client subito dopo il login (fire & forget).
// L'utente è preso dal JWT (non spoofabile); scrive via service role.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Estrae il `sub` (user id) dal JWT del chiamante.
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

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

// IP privati/locali: non hanno geolocalizzazione pubblica.
function isPrivate(ip: string): boolean {
  return (
    ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') ||
    ip.startsWith('192.168.') || ip.startsWith('fc') || ip.startsWith('fd') ||
    ip.startsWith('fe80') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

async function geo(ip: string): Promise<{ city?: string; region?: string; country?: string; country_code?: string }> {
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`)
    const j = await r.json()
    if (!j || j.success === false) return {}
    return {
      city: j.city ?? undefined,
      region: j.region ?? undefined,
      country: j.country ?? undefined,
      country_code: j.country_code ?? undefined,
    }
  } catch {
    return {}
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const uid = callerId(req)
    if (!uid) return jsonRes({ error: 'unauthenticated' }, 401)

    const ip = clientIp(req)
    const ua = req.headers.get('user-agent')
    const g = ip && !isPrivate(ip) ? await geo(ip) : {}

    const res = await fetch(`${SUPABASE_URL}/rest/v1/access_logs`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: uid,
        ip,
        user_agent: ua,
        city: g.city ?? null,
        region: g.region ?? null,
        country: g.country ?? null,
        country_code: g.country_code ?? null,
      }),
    })

    if (!res.ok) return jsonRes({ error: 'insert failed', status: res.status }, 500)
    return jsonRes({ ok: true })
  } catch (err) {
    console.error('log-access error:', err)
    return jsonRes({ error: String(err) }, 500)
  }
})
