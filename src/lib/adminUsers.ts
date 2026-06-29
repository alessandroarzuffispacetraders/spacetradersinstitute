import { supabase } from './supabase'

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string).trim() + '/functions/v1'

// Aggiorna email e/o password di un utente via edge function (richiede admin lato server).
export async function updateUserAuth(
  userId: string,
  changes: { email?: string; password?: string },
): Promise<{ error: string | null }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Sessione scaduta. Rifai il login.' }

  try {
    const res = await fetch(`${FUNCTIONS_URL}/admin-update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, ...changes }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body?.error || 'Errore aggiornamento account' }
    return { error: null }
  } catch {
    return { error: 'Errore di rete' }
  }
}

// Elimina definitivamente un utente (account + dati collegati) via edge function.
export async function deleteUserAccount(userId: string): Promise<{ error: string | null }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Sessione scaduta. Rifai il login.' }

  try {
    const res = await fetch(`${FUNCTIONS_URL}/admin-delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body?.error || 'Errore eliminazione utente' }
    return { error: null }
  } catch {
    return { error: 'Errore di rete' }
  }
}
