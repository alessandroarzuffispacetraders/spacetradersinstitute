// Mints a short-lived presigned GET URL for a private R2 object, but only after
// verifying the caller may see it: admins always; everyone else only if the
// object belongs to a PUBLISHED lesson (prevents leaking drafts / arbitrary keys).
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Non autenticato' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !caller) return json({ error: 'Token non valido' }, 401)

    const { objectKey } = await req.json() as { objectKey?: string }
    if (!objectKey || typeof objectKey !== 'string') return json({ error: 'objectKey mancante' }, 400)

    // Authorization: admins always; otherwise the object must belong to a
    // published lesson (as a video_key or an attachment object_key).
    const { data: prof } = await admin.from('profiles').select('role, roles').eq('id', caller.id).single()
    let allowed = prof?.role === 'admin' || (Array.isArray(prof?.roles) && prof!.roles.includes('admin'))

    if (!allowed) {
      const { data: les } = await admin.from('lessons').select('published').eq('video_key', objectKey).maybeSingle()
      if (les) {
        allowed = !!les.published
      } else {
        const { data: att } = await admin.from('attachments').select('lesson_id').eq('object_key', objectKey).maybeSingle()
        if (att) {
          const { data: parent } = await admin.from('lessons').select('published').eq('id', att.lesson_id).maybeSingle()
          allowed = !!parent?.published
        }
      }
    }
    if (!allowed) return json({ error: 'Accesso negato' }, 403)

    // Presigned GET, valid for 2 hours.
    const u = new URL(`${ENDPOINT}/${R2_BUCKET}/${objectKey}`)
    u.searchParams.set('X-Amz-Expires', '7200')
    const signed = await r2.sign(u.toString(), { method: 'GET', aws: { signQuery: true } })

    return json({ url: signed.url, expiresIn: 7200 })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
