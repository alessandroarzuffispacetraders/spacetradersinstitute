// Restituisce SOLO la struttura del grafo di conoscenza SpaceQuant: nodi
// {id, cartella, grado} e archi {da, a}. MAI il testo delle note — vedi il
// vincolo di prodotto in _shared/vault.ts. Risposta attesa ~6KB.
import { CORS, json, adminClient, requireSpaceQuantAccess, HttpError } from '../_shared/http.ts'
import { getCachedVault, buildGraph, buildDemoGraph } from '../_shared/vault.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = adminClient()
    await requireSpaceQuantAccess(admin, req)

    const files = await getCachedVault(admin)
    // Prima dell'ingestion il bucket è vuoto: mostra un grafo dimostrativo
    // invece di uno vuoto, così l'anteprima è credibile fin da subito.
    const { nodi, archi } = files.length > 0 ? buildGraph(files) : buildDemoGraph()

    return json({ nodi, archi, demo: files.length === 0 })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    return json({ error: String(err) }, 500)
  }
})
