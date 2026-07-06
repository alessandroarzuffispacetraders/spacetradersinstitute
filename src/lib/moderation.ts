import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ─── Mute utenti nelle chat di gruppo ────────────────────────────────────────
// L'enforcement REALE è server-side (RPC mute_user/unmute_user + gate in
// may_post): qui ci sono solo i wrapper client e gli hook per la UI.

// Durate proposte nel picker (minuti).
export const MUTE_DURATIONS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '1 ora', minutes: 60 },
  { label: '8 ore', minutes: 60 * 8 },
  { label: '24 ore', minutes: 60 * 24 },
  { label: '7 giorni', minutes: 60 * 24 * 7 },
]

// Traduce i messaggi RAISE della RPC in testo pulito (già in italiano).
function cleanErr(msg?: string): string {
  if (!msg) return 'Operazione non riuscita'
  return msg.replace(/^forbidden:\s*/i, '').replace(/^[a-z0-9_]+:\s*/i, s => s)
}

// Silenzia targetId per `minutes` minuti. Ritorna la scadenza (ISO) o l'errore.
export async function muteUser(
  targetId: string, minutes: number, reason?: string,
): Promise<{ until: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('mute_user', {
    p_target: targetId, p_minutes: minutes, p_reason: reason ?? null,
  })
  if (error) return { until: null, error: cleanErr(error.message) }
  return { until: (data as string | null) ?? null, error: null }
}

// Rimuove il silenzio da targetId.
export async function unmuteUser(targetId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('unmute_user', { p_target: targetId })
  return { error: error ? cleanErr(error.message) : null }
}

// Stato mute ATTIVO di un utente (per lo staff, apertura scheda). null = non muto.
export async function fetchActiveMute(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('chat_mutes').select('muted_until').eq('user_id', userId).maybeSingle()
  const until = (data as { muted_until?: string } | null)?.muted_until ?? null
  return until && new Date(until) > new Date() ? until : null
}

// Hook: il MIO stato mute (per bloccare la compose + mostrare il banner). Reagisce
// in realtime a un mute/unmute e si auto-azzera allo scadere del tempo.
export function useMyMute(userId: string | undefined): string | null {
  const [mutedUntil, setMutedUntil] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) { setMutedUntil(null); return }
    let active = true
    const load = async () => {
      const until = await fetchActiveMute(userId)
      if (active) setMutedUntil(until)
    }
    load()
    const ch = supabase
      .channel(`mute:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_mutes', filter: `user_id=eq.${userId}` },
        () => load())
      .subscribe()
    return () => { active = false; supabase.removeChannel(ch) }
  }, [userId])

  // Toglie il banner nell'istante in cui il mute scade (nessun evento realtime lì).
  useEffect(() => {
    if (!mutedUntil) return
    const ms = new Date(mutedUntil).getTime() - Date.now()
    if (ms <= 0) { setMutedUntil(null); return }
    const t = setTimeout(() => setMutedUntil(null), ms + 500)
    return () => clearTimeout(t)
  }, [mutedUntil])

  return mutedUntil
}

// "fino alle 14:30" se oggi, altrimenti "fino al 9/7 alle 14:30".
export function formatMutedUntil(iso: string): string {
  const d = new Date(iso)
  const hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  const sameDay = new Date().toDateString() === d.toDateString()
  return sameDay ? `fino alle ${hh}` : `fino al ${d.getDate()}/${d.getMonth() + 1} alle ${hh}`
}
