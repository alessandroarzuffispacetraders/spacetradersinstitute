import { useEffect, useState, useCallback } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface GraphNode { id: string; cartella: string; grado: number }
export interface GraphEdge { da: string; a: string }
export interface ChatTurn { ruolo: 'utente' | 'assistente'; testo: string }

export interface ChatResult {
  risposta: string
  noteCitate: string[]
  quotaRestante: number
}

export type ChatErrorMotivo = 'quota_esaurita' | 'rate_limit' | null

export interface ChatError {
  error: string
  motivo?: ChatErrorMotivo
  quotaRestante?: number
}

// ─── Grafo (fetch una volta, la struttura non cambia durante la sessione) ────

export function useSpaceQuantGraph() {
  const [nodi, setNodi] = useState<GraphNode[]>([])
  const [archi, setArchi] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.functions.invoke('spacequant-grafo', { body: {} }).then(async ({ data, error: err }) => {
      if (!active) return
      if (err) {
        const body = err instanceof FunctionsHttpError ? await err.context.json().catch(() => null) : null
        setError(body?.error ?? err.message ?? 'Errore di rete')
        setLoading(false)
        return
      }
      setNodi(data.nodi ?? [])
      setArchi(data.archi ?? [])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { nodi, archi, loading, error }
}

// ─── Quota residua (letta all'apertura pagina, aggiornata dopo ogni risposta) ─

export function useSpaceQuantQuota() {
  const [quotaRestante, setQuotaRestante] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('spacequant_quota_restante')
    if (!error && typeof data === 'number') setQuotaRestante(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { quotaRestante, setQuotaRestante, loading, refresh }
}

// ─── Invio domanda ────────────────────────────────────────────────────────────

export async function askSpaceQuant(
  domanda: string,
  cronologia: ChatTurn[],
): Promise<{ ok: true; result: ChatResult } | { ok: false; error: ChatError }> {
  const { data, error } = await supabase.functions.invoke('spacequant-chat', {
    body: { domanda, cronologia },
  })

  if (error) {
    // Su risposta non-2xx (400/403/429/500) `data` è null e il corpo JSON che
    // abbiamo scritto in spacequant-chat/index.ts va letto da error.context
    // (la Response grezza) — vedi FunctionsHttpError in @supabase/functions-js.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      if (body?.error) {
        return {
          ok: false,
          error: { error: body.error, motivo: body.motivo ?? null, quotaRestante: body.quota_restante },
        }
      }
    }
    return { ok: false, error: { error: error.message || 'Errore di rete, riprova.' } }
  }

  return {
    ok: true,
    result: { risposta: data.risposta, noteCitate: data.note_citate ?? [], quotaRestante: data.quota_restante },
  }
}
