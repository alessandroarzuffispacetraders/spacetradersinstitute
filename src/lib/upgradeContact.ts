import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

// Messaggio precompilato per la richiesta di accesso completo.
export const PRESET_UPGRADE_MESSAGE =
  "Ciao, vorrei maggiori informazioni per entrare all'interno della community"

// Apre una chat privata con l'admin, precompilata, per "passare al completo".
// Nessun pagamento in-app: la conversione avviene contattando l'admin.
export function useContactAdmin() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles_public')
      .select('id, name, created_at')
      .or('role.eq.admin,roles.cs.{admin}')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setAdmin({ id: (data as { id: string }).id, name: (data as { name: string }).name })
      })
    return () => { cancelled = true }
  }, [])

  const contactAdmin = useCallback(() => {
    if (!admin) return
    navigate('/student/chat', {
      state: {
        openDm: admin.id,
        prefill: PRESET_UPGRADE_MESSAGE,
        knownUser: { id: admin.id, name: admin.name, role: 'admin' },
      },
    })
  }, [admin, navigate])

  return { contactAdmin, ready: !!admin }
}
