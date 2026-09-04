// Restituisce SOLO la struttura del grafo di conoscenza SpaceQuant: nodi
// {id, cartella, grado} e archi {da, a}. MAI il testo delle note — vedi il
// vincolo di prodotto in _shared/vault.ts. Risposta attesa ~6KB.
import { CORS, json, adminClient, requireSpaceQuantAccess, HttpError } from '../_shared/http.ts'
import { getCachedVault, buildGraph, buildDemoGraph, buildDecorativeExtras } from '../_shared/vault.ts'

// Quanti nodi puramente decorativi aggiungere al grafo reale — vedi
// buildDecorativeExtras in _shared/vault.ts per il perché.
const DECO_NODE_COUNT = 70

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = adminClient()
    await requireSpaceQuantAccess(admin, req)

    const files = await getCachedVault(admin)
    // Prima dell'ingestion il bucket è vuoto: mostra un grafo dimostrativo
    // invece di uno vuoto, così l'anteprima è credibile fin da subito.
    let nodi, archi
    if (files.length > 0) {
      const reale = buildGraph(files)
      const decorativi = buildDecorativeExtras(reale.nodi.map(n => n.id), DECO_NODE_COUNT)
      nodi = [...reale.nodi, ...decorativi.nodi]
      archi = [...reale.archi, ...decorativi.archi]
    } else {
      ;({ nodi, archi } = buildDemoGraph())
    }

    return json({ nodi, archi, demo: files.length === 0 })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    return json({ error: String(err) }, 500)
  }
})
