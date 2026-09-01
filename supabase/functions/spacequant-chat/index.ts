// Chat AI di Quant-Brain. Il vault intero (~29k token, ora esteso col percorso
// generale in Processo/) viene passato come blocco di sistema cacheable ad
// ogni domanda, insieme ai SOLI TITOLI dei videocorsi disponibili — niente
// embedding, niente ricerca: il modello ha tutto davanti e può triangolare.
// Risposta in STREAMING (testo puro mentre arriva) invece di un unico JSON:
// la quota residua viaggia nell'header X-Quota-Restante (nota fin da subito,
// non serve aspettare la fine della generazione); note_citate/video_citati
// arrivano in coda al corpo dopo un separatore, essendo derivabili solo dal
// testo completo. MAI il testo grezzo delle note/descrizioni video nella
// risposta (solo ciò che il modello sceglie di citare/spiegare).
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'
import { CORS, adminClient, requireSpaceQuantAccess, HttpError } from '../_shared/http.ts'
import { getCachedVault, buildSystemText, buildTitleIndex, extractWikilinkTitles } from '../_shared/vault.ts'
import { loadVideoTitles, buildVideoText, buildVideoIndex, extractVideoTitles } from '../_shared/videos.ts'
import { SYSTEM_PROMPT } from '../_shared/systemPrompt.ts'

const MAX_DOMANDA_CHARS = 2000
const MAX_CRONOLOGIA_MSGS = 10

// Separatore fra il testo della risposta (streaming) e i metadati finali
// (JSON) — una stringa che non comparirebbe mai in una risposta vera.
const META_SEP = '\n\n§§QUANTBRAIN_META§§\n'

interface ChatTurn { ruolo: 'utente' | 'assistente'; testo: string }

function jsonError(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = adminClient()
    const user = await requireSpaceQuantAccess(admin, req)
    const token = req.headers.get('Authorization')!.replace('Bearer ', '')

    const body = await req.json().catch(() => ({}))
    const domanda = typeof body.domanda === 'string' ? body.domanda.trim() : ''
    const cronologia: ChatTurn[] = Array.isArray(body.cronologia) ? body.cronologia.slice(-MAX_CRONOLOGIA_MSGS) : []
    if (!domanda) return jsonError({ error: 'Domanda mancante' }, 400)
    if (domanda.length > MAX_DOMANDA_CHARS) return jsonError({ error: 'Domanda troppo lunga' }, 400)

    // Quota mensile + rate-limit al minuto, verificati e consumati atomicamente
    // lato DB (pg_advisory_xact_lock) PRIMA di spendere sulla chiamata al modello.
    const { data: consumeRows, error: consumeErr } = await admin
      .rpc('spacequant_try_consume', { p_user_id: user.id })
    if (consumeErr) throw new Error(`spacequant_try_consume: ${consumeErr.message}`)
    const consume = consumeRows?.[0] as { allowed: boolean; quota_restante: number; motivo: string | null } | undefined
    if (!consume?.allowed) {
      return jsonError({ error: 'Limite raggiunto', quota_restante: consume?.quota_restante ?? 0, motivo: consume?.motivo }, 429)
    }

    const [files, videos] = await Promise.all([
      getCachedVault(admin),
      loadVideoTitles(token), // non bloccante: [] se la query fallisce, la chat funziona comunque
    ])
    const titleIndex = buildTitleIndex(files)
    const videoIndex = buildVideoIndex(videos)
    const vaultText = buildSystemText(files)
    const videoText = buildVideoText(videos)

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const messages: Anthropic.MessageParam[] = [
      ...cronologia.map((m): Anthropic.MessageParam => ({ role: m.ruolo === 'utente' ? 'user' : 'assistant', content: m.testo })),
      { role: 'user', content: domanda },
    ]

    const systemText = videoText
      ? `${SYSTEM_PROMPT}\n\n=== MANUALE ===\n${vaultText}\n\n=== VIDEOCORSI DISPONIBILI ===\n${videoText}`
      : `${SYSTEM_PROMPT}\n\n=== MANUALE ===\n${vaultText}`

    const anthropicStream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages,
    })

    const encoder = new TextEncoder()
    const responseBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        let risposta = ''
        try {
          // Sonnet 5 gira con thinking adattivo anche senza richiederlo
          // esplicitamente: possono comparire blocchi 'thinking', da ignorare
          // e non trasmettere mai al client — solo i 'text_delta' sono testo
          // di risposta vero.
          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              risposta += event.delta.text
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          const note_citate = extractWikilinkTitles(risposta, titleIndex)
          const video_citati = extractVideoTitles(risposta, videoIndex)
          controller.enqueue(encoder.encode(META_SEP + JSON.stringify({ note_citate, video_citati })))
        } catch (err) {
          // Lo stream è già iniziato (status 200 già inviato): l'unico modo
          // di segnalare un errore a questo punto è dentro al corpo stesso.
          controller.enqueue(encoder.encode(META_SEP + JSON.stringify({ error: String(err) })))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(responseBody, {
      headers: {
        ...CORS,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Quota-Restante': String(consume.quota_restante),
      },
    })
  } catch (err) {
    if (err instanceof HttpError) return jsonError({ error: err.message }, err.status)
    return jsonError({ error: 'Errore interno, riprova.', dettaglio: String(err) }, 500)
  }
})
