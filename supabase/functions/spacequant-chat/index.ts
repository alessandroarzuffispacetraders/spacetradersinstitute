// Chat AI sul manuale SpaceQuant. Il vault intero (~29k token) viene passato
// come blocco di sistema cacheable ad ogni domanda — niente embedding, niente
// ricerca: il modello ha tutto il manuale davanti e può triangolare fra le note.
// Contratto: { risposta, note_citate, quota_restante }. MAI il testo grezzo
// delle note nella risposta (solo ciò che il modello sceglie di citare/spiegare).
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'
import { CORS, json, adminClient, requirePayingStudent, HttpError } from '../_shared/http.ts'
import { getCachedVault, buildSystemText, buildTitleIndex, extractWikilinkTitles } from '../_shared/vault.ts'
import { SYSTEM_PROMPT } from '../_shared/systemPrompt.ts'

const MAX_DOMANDA_CHARS = 2000
const MAX_CRONOLOGIA_MSGS = 10

interface ChatTurn { ruolo: 'utente' | 'assistente'; testo: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const admin = adminClient()
    const user = await requirePayingStudent(admin, req)

    const body = await req.json().catch(() => ({}))
    const domanda = typeof body.domanda === 'string' ? body.domanda.trim() : ''
    const cronologia: ChatTurn[] = Array.isArray(body.cronologia) ? body.cronologia.slice(-MAX_CRONOLOGIA_MSGS) : []
    if (!domanda) return json({ error: 'Domanda mancante' }, 400)
    if (domanda.length > MAX_DOMANDA_CHARS) return json({ error: 'Domanda troppo lunga' }, 400)

    // Quota mensile + rate-limit al minuto, verificati e consumati atomicamente
    // lato DB (pg_advisory_xact_lock) PRIMA di spendere sulla chiamata al modello.
    const { data: consumeRows, error: consumeErr } = await admin
      .rpc('spacequant_try_consume', { p_user_id: user.id })
    if (consumeErr) throw new Error(`spacequant_try_consume: ${consumeErr.message}`)
    const consume = consumeRows?.[0] as { allowed: boolean; quota_restante: number; motivo: string | null } | undefined
    if (!consume?.allowed) {
      return json({ error: 'Limite raggiunto', quota_restante: consume?.quota_restante ?? 0, motivo: consume?.motivo }, 429)
    }

    const files = await getCachedVault(admin)
    const titleIndex = buildTitleIndex(files)
    const vaultText = buildSystemText(files)

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const messages: Anthropic.MessageParam[] = [
      ...cronologia.map((m): Anthropic.MessageParam => ({ role: m.ruolo === 'utente' ? 'user' : 'assistant', content: m.testo })),
      { role: 'user', content: domanda },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      system: [
        {
          type: 'text',
          text: `${SYSTEM_PROMPT}\n\n=== MANUALE ===\n${vaultText}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    })

    // Narrowing inline sulla discriminated union (Sonnet 5 gira con thinking
    // adattivo anche senza richiederlo esplicitamente: possono comparire blocchi
    // 'thinking' nella risposta, da ignorare e non concatenare al testo).
    const risposta = response.content
      .map(b => (b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join('\n')

    const note_citate = extractWikilinkTitles(risposta, titleIndex)

    return json({ risposta, note_citate, quota_restante: consume.quota_restante })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    return json({ error: 'Errore interno, riprova.', dettaglio: String(err) }, 500)
  }
})
