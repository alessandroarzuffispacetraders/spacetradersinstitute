// Restituisce SOLO la struttura del grafo di conoscenza SpaceQuant: nodi
// {id, cartella, grado} e archi {da, a}. MAI il testo delle note — vedi il
// vincolo di prodotto in _shared/vault.ts. Risposta attesa ~6KB.
import { CORS, json, adminClient, requirePayingStudent, HttpError } from '../_shared/http.ts'
import { getCachedVault, buildGraph } from '../_shared/vault.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = adminClient()
    await requirePayingStudent(admin, req)

    const files = await getCachedVault(admin)
    const { nodi, archi } = buildGraph(files)

    return json({ nodi, archi })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    return json({ error: String(err) }, 500)
  }
})
