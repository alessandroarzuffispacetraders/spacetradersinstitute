import { useEffect, useState, useCallback } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase'

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface GraphNode { id: string; cartella: string; grado: number }
export interface GraphEdge { da: string; a: string }
export interface VideoCitato { id: string; title: string }
export interface ChatTurn {
  ruolo: 'utente' | 'assistente'
  testo: string
  videoCitati?: VideoCitato[] // solo per le risposte reali, per i link {{Titolo}} nel testo
}

export interface ChatResult {
  risposta: string
  noteCitate: string[]
  videoCitati: VideoCitato[]
  quotaRestante: number
}

export type ChatErrorMotivo = 'quota_esaurita' | 'rate_limit' | null

export interface ChatError {
  error: string
  motivo?: ChatErrorMotivo
  quotaRestante?: number
}

// ─── Grafo (fetch una volta, la struttura non cambia durante la sessione) ────

// Cache a livello di modulo: la struttura del grafo non cambia praticamente
// mai durante una sessione di navigazione, quindi la prima richiesta la
// popola e ogni rimontaggio successivo (es. si esce e si torna sulla pagina)
// la mostra all'istante, senza rifare la chiamata di rete — è quello che
// rende il caricamento "praticamente subito" dalla seconda visita in poi.
let grafoCache: { nodi: GraphNode[]; archi: GraphEdge[]; demo: boolean } | null = null

export function useSpaceQuantGraph() {
  const [nodi, setNodi] = useState<GraphNode[]>(grafoCache?.nodi ?? [])
  const [archi, setArchi] = useState<GraphEdge[]>(grafoCache?.archi ?? [])
  const [demo, setDemo] = useState(grafoCache?.demo ?? false)
  const [loading, setLoading] = useState(grafoCache === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (grafoCache !== null) return // già in cache per questa sessione, niente da rifare
    let active = true
    supabase.functions.invoke('spacequant-grafo', { body: {} }).then(async ({ data, error: err }) => {
      if (!active) return
      if (err) {
        const body = err instanceof FunctionsHttpError ? await err.context.json().catch(() => null) : null
        setError(body?.error ?? err.message ?? 'Errore di rete')
        setLoading(false)
        return
      }
      grafoCache = { nodi: data.nodi ?? [], archi: data.archi ?? [], demo: !!data.demo }
      setNodi(grafoCache.nodi)
      setArchi(grafoCache.archi)
      setDemo(grafoCache.demo)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return { nodi, archi, demo, loading, error }
}

// ─── Accesso alla beta (solo admin + chi è stato abilitato esplicitamente) ────

export function useSpaceQuantAccess() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    supabase.rpc('spacequant_has_access').then(({ data, error }) => {
      if (active) setHasAccess(!error && data === true)
    })
    return () => { active = false }
  }, [])

  return hasAccess // null = ancora in caricamento
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

// ─── Invio domanda (in streaming) ─────────────────────────────────────────────

// Separatore fra il testo della risposta e i metadati finali — DEVE combaciare
// esattamente con META_SEP in supabase/functions/spacequant-chat/index.ts.
const META_SEP = '\n\n§§QUANTBRAIN_META§§\n'

// A differenza delle altre chiamate qui sopra, questa NON usa
// supabase.functions.invoke(): quella attende sempre la risposta completa
// prima di risolvere, quindi non può mostrare il testo mentre arriva. Un
// fetch() diretto sull'URL della function, letto come stream, sì.
// `onParziale` riceve il testo VISIBILE accumulato finora (non solo il nuovo
// pezzo) ad ogni chunk, così chi chiama può semplicemente sostituire lo stato.
export async function askSpaceQuant(
  domanda: string,
  cronologia: ChatTurn[],
  onParziale: (testoParziale: string) => void,
): Promise<{ ok: true; result: ChatResult } | { ok: false; error: ChatError }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { ok: false, error: { error: 'Sessione scaduta — ricarica la pagina.' } }

  let res: Response
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/spacequant-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
      body: JSON.stringify({ domanda, cronologia }),
    })
  } catch {
    return { ok: false, error: { error: 'Errore di rete, riprova.' } }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return {
      ok: false,
      error: { error: body?.error ?? 'Errore di rete, riprova.', motivo: body?.motivo ?? null, quotaRestante: body?.quota_restante },
    }
  }

  const quotaHeader = res.headers.get('X-Quota-Restante')
  const quotaRestante = quotaHeader !== null ? Number(quotaHeader) : NaN

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    const sepIdx = full.indexOf(META_SEP)
    onParziale(sepIdx === -1 ? full : full.slice(0, sepIdx))
  }

  const sepIdx = full.indexOf(META_SEP)
  const risposta = (sepIdx === -1 ? full : full.slice(0, sepIdx)).trim()
  let noteCitate: string[] = []
  let videoCitati: VideoCitato[] = []
  if (sepIdx !== -1) {
    try {
      const meta = JSON.parse(full.slice(sepIdx + META_SEP.length))
      if (meta.error) return { ok: false, error: { error: 'Errore durante la generazione, riprova.' } }
      noteCitate = meta.note_citate ?? []
      videoCitati = meta.video_citati ?? []
    } catch { /* meta malformata: il testo è comunque valido, si perdono solo le citazioni */ }
  }

  return { ok: true, result: { risposta, noteCitate, videoCitati, quotaRestante } }
}
