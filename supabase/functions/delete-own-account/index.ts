import { createClient } from 'npm:@supabase/supabase-js@2'

// Cancellazione account SELF-SERVICE (obbligo App Store 5.1.1(v)): l'utente
// autenticato elimina il PROPRIO account. Nessun controllo di ruolo — chiunque
// può cancellarsi. L'identità è verificata crittograficamente via getUser().
// I dati collegati (profiles, messaggi, submissions, …) cascadano via le FK.

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

    // Verifica crittografica dell'identità del chiamante (il token NON è falsificabile).
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !caller) return json({ error: 'Token non valido' }, 401)

    // Elimina l'account auth del chiamante; i dati collegati cascadano via FK.
    const { error: delErr } = await admin.auth.admin.deleteUser(caller.id)
    if (delErr) return json({ error: delErr.message }, 400)

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
