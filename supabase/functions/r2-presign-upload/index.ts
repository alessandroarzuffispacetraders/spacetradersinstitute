// Mints a short-lived presigned PUT URL so an admin can upload a file straight
// to the private R2 bucket from the browser (bypassing Supabase size limits).
// R2 credentials live ONLY here (function secrets), never in the client.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')!
const R2_ACCOUNT_ID        = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY_ID     = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET            = Deno.env.get('R2_BUCKET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY })
const ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

// Keep object keys safe and predictable.
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Non autenticato' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Server-side admin check (never trust the client).
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !caller) return json({ error: 'Token non valido' }, 401)

    const { data: prof } = await admin.from('profiles').select('role, roles').eq('id', caller.id).single()
    const isAdmin = prof?.role === 'admin' || (Array.isArray(prof?.roles) && prof!.roles.includes('admin'))
    if (!isAdmin) return json({ error: 'Permesso negato: solo admin' }, 403)

    const { kind, lessonId, filename } = await req.json() as {
      kind?: 'video' | 'attachment'; lessonId?: string; filename?: string
    }
    if (!lessonId || !filename) return json({ error: 'Parametri mancanti (lessonId, filename)' }, 400)
    if (kind !== 'video' && kind !== 'attachment') return json({ error: 'kind non valido' }, 400)

    const objectKey = kind === 'video'
      ? `lessons/${lessonId}/video/${crypto.randomUUID()}-${sanitize(filename)}`
      : `lessons/${lessonId}/attachments/${crypto.randomUUID()}-${sanitize(filename)}`

    // Presign a PUT via query auth (UNSIGNED-PAYLOAD): the browser can then PUT
    // the bytes with any Content-Type. Valid for 1 hour.
    const u = new URL(`${ENDPOINT}/${R2_BUCKET}/${objectKey}`)
    u.searchParams.set('X-Amz-Expires', '3600')
    const signed = await r2.sign(u.toString(), { method: 'PUT', aws: { signQuery: true } })

    return json({ uploadUrl: signed.url, objectKey })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
