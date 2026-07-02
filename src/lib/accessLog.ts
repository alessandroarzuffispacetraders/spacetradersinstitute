import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1'

// Registra l'accesso corrente (IP + geo lato server). Chiamato dopo un login
// esplicito. Fire & forget: non blocca la UI, ignora eventuali errori di rete.
export function recordAccess() {
  supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token
    if (!token) return
    fetch(`${FUNCTIONS_URL}/log-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {/* ignora */})
  })
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AccessSummary {
  userId: string
  logins: number
  distinctIps: number
  distinctCities: number
  distinctCountries: number
  lastSeen: string
  places: string[]
  suspicious: boolean // ≥ 2 città distinte → possibile condivisione account
}

export interface AccessLog {
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  countryCode: string | null
  userAgent: string | null
  createdAt: string
}

interface RawSummary {
  user_id: string
  logins: number | string
  distinct_ips: number | string
  distinct_cities: number | string
  distinct_countries: number | string
  last_seen: string
  places: string[] | null
}

interface RawLog {
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  country_code: string | null
  user_agent: string | null
  created_at: string
}

// Riepilogo accessi per TUTTI gli utenti (una riga per utente con ≥1 accesso).
export function useAccessSummaries() {
  const [summaries, setSummaries] = useState<Record<string, AccessSummary>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('admin_access_summary').then(({ data }) => {
      const map: Record<string, AccessSummary> = {}
      for (const r of (data ?? []) as RawSummary[]) {
        const cities = Number(r.distinct_cities) || 0
        map[r.user_id] = {
          userId: r.user_id,
          logins: Number(r.logins) || 0,
          distinctIps: Number(r.distinct_ips) || 0,
          distinctCities: cities,
          distinctCountries: Number(r.distinct_countries) || 0,
          lastSeen: r.last_seen,
          places: r.places ?? [],
          suspicious: cities >= 2,
        }
      }
      setSummaries(map)
      setLoading(false)
    })
  }, [])

  return { summaries, loading }
}

// Storico accessi di un singolo utente (RLS: solo admin).
export async function fetchUserAccessLogs(userId: string, limit = 50): Promise<AccessLog[]> {
  const { data } = await supabase
    .from('access_logs')
    .select('ip, city, region, country, country_code, user_agent, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as RawLog[]).map(r => ({
    ip: r.ip,
    city: r.city,
    region: r.region,
    country: r.country,
    countryCode: r.country_code,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  }))
}
