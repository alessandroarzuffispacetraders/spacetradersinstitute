import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Non autenticato' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Verifica che il chiamante sia admin (lato server)
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !caller) return json({ error: 'Token non valido' }, 401)

    const { data: prof } = await admin.from('profiles').select('role, roles').eq('id', caller.id).single()
    const isAdmin = prof?.role === 'admin' || (Array.isArray(prof?.roles) && prof!.roles.includes('admin'))
    if (!isAdmin) return json({ error: 'Permesso negato: solo admin' }, 403)

    const { userId } = await req.json() as { userId?: string }
    if (!userId) return json({ error: 'userId mancante' }, 400)
    if (userId === caller.id) return json({ error: 'Non puoi eliminare il tuo stesso account.' }, 400)

    // Elimina l'account auth; i dati collegati cascadano via le foreign key
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) return json({ error: delErr.message }, 400)

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
