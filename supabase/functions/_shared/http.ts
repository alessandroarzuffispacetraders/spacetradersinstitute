// Boilerplate condiviso tra spacequant-grafo e spacequant-chat: CORS, risposta
// JSON, e verifica "è uno studente pagante" (stesso controllo lato server usato
// altrove nel progetto per il gating free/full, qui applicato prima di ogni
// lettura del vault o chiamata al modello).
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

// Verifica crittografica dell'identità (getUser) + controllo tier pagante.
// Lancia HttpError(401|403) invece di restituire una Response, così il
// chiamante può gestirla in un unico try/catch.
export async function requirePayingStudent(admin: SupabaseClient, req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new HttpError(401, 'Non autenticato')

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) throw new HttpError(401, 'Token non valido')

  const { data: profile } = await admin.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier === 'free') {
    throw new HttpError(403, 'Funzione riservata agli studenti con accesso completo')
  }

  return user
}
