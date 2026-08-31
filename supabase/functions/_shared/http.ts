// Boilerplate condiviso tra spacequant-grafo e spacequant-chat: CORS, risposta
// JSON, e verifica accesso alla sezione SpaceQuant (beta manuale: solo admin +
// chi è stato abilitato esplicitamente in spacequant_access — non più legato
// al tier free/full, vedi phase_spacequant_access.sql).
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

export function adminClient(): SupabaseClient {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// Verifica crittografica dell'identità (getUser) + accesso alla beta.
// Query dirette con la service-role key (bypassa RLS) invece della RPC
// spacequant_has_access(), perché quella si basa su auth.uid() — non
// valorizzato quando si interroga con la chiave di servizio.
// Lancia HttpError(401|403) invece di restituire una Response, così il
// chiamante può gestirla in un unico try/catch.
export async function requireSpaceQuantAccess(admin: SupabaseClient, req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new HttpError(401, 'Non autenticato')

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw new HttpError(401, 'Token non valido')

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin') return user

  const { data: grant } = await admin.from('spacequant_access').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!grant) throw new HttpError(403, 'Sezione non disponibile per il tuo account')

  return user
}
