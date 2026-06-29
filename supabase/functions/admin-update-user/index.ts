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

    // 1) Verifica che il chiamante sia un admin (controllo lato server, non fidarsi del client)
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !caller) return json({ error: 'Token non valido' }, 401)

    const { data: prof } = await admin
      .from('profiles')
      .select('role, roles')
      .eq('id', caller.id)
      .single()

    const isAdmin = prof?.role === 'admin' || (Array.isArray(prof?.roles) && prof!.roles.includes('admin'))
    if (!isAdmin) return json({ error: 'Permesso negato: solo admin' }, 403)

    // 2) Applica le modifiche all'utente target
    const { userId, email, password } = await req.json() as { userId?: string; email?: string; password?: string }
    if (!userId) return json({ error: 'userId mancante' }, 400)

    const updates: { email?: string; password?: string; email_confirm?: boolean } = {
      // Un admin che modifica un account lo rende sempre utilizzabile:
      // conferma l'email (un self-signup resta altrimenti non confermato e non logga).
      email_confirm: true,
    }
    if (email && email.trim()) updates.email = email.trim()
    if (password && password.length > 0) updates.password = password
    if (!updates.email && !updates.password) return json({ error: 'Nessuna modifica richiesta' }, 400)

    const { error: upErr } = await admin.auth.admin.updateUserById(userId, updates)
    if (upErr) return json({ error: upErr.message }, 400)

    // 3) Tieni allineata profiles.email
    if (updates.email) await admin.from('profiles').update({ email: updates.email }).eq('id', userId)

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
