// Vault SpaceQuant — lettura del bucket privato 'spacequant-vault' e derivazione
// del grafo. Il TESTO delle note non deve mai uscire da questo modulo verso il
// client: solo buildGraph() (struttura) attraversa il confine di rete verso
// spacequant-grafo; buildSystemText() resta dentro spacequant-chat, che lo usa
// solo per costruire il prompt verso Anthropic (mai restituito al client).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'spacequant-vault'

export interface VaultFile {
  path: string          // es. "Capire/R-multiple.md"
  folder: string        // primo segmento del path, "Indice" se nota radice
  title: string         // nome file senza estensione
  aliases: string[]
  body: string           // corpo della nota SENZA il blocco frontmatter
}

// Parser minimale del frontmatter YAML: gestisce solo la forma usata nel vault
// (aliases: seguito da righe "  - valore"). Non è un parser YAML generico —
// il vault ha una sola chiave frontmatter rilevante, non serve una libreria.
function parseFrontmatter(raw: string): { aliases: string[]; body: string } {
  if (!raw.startsWith('---')) return { aliases: [], body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { aliases: [], body: raw }
  const head = raw.slice(3, end)
  const body = raw.slice(end + 4).replace(/^\s*\n/, '')
  const aliases: string[] = []
  let inAliases = false
  for (const line of head.split('\n')) {
    if (/^aliases:\s*$/.test(line)) { inAliases = true; continue }
    if (inAliases) {
      const m = line.match(/^\s*-\s*(.+?)\s*$/)
      if (m) { aliases.push(m[1]); continue }
      inAliases = false
    }
  }
  return { aliases, body }
}

// Elenco ricorsivo di tutti i path .md nel bucket (Storage.list() è per-livello,
// come una prefix-list S3: serve scendere manualmente nelle sottocartelle,
// necessario per Metriche/* che ha 7 sottocartelle).
async function listMarkdownPaths(admin: SupabaseClient, prefix = ''): Promise<string[]> {
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) throw new Error(`Vault list fallita (${prefix || '/'}): ${error.message}`)
  const paths: string[] = []
  for (const entry of data ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name
    // Le "cartelle" in Supabase Storage sono entry senza id/metadata propri.
    if (entry.id === null) {
      paths.push(...await listMarkdownPaths(admin, full))
    } else if (full.endsWith('.md')) {
      paths.push(full)
    }
  }
  return paths
}

// Confronto "grezzo" per titolo/nome-file: ignora maiuscole/minuscole e accenti.
// Serve solo a verificare che l'H1 del corpo sia "la stessa cosa" del nome
// file prima di usarlo — mai per decidere se due note SONO la stessa nota.
function grezzo(s: string): string {
  return Array.from(s.normalize('NFD'))
    .filter((ch) => { const c = ch.codePointAt(0)!; return !(c >= 0x0300 && c <= 0x036f) })
    .join('')
    .toLowerCase()
}

export async function loadVaultFiles(admin: SupabaseClient): Promise<VaultFile[]> {
  const paths = (await listMarkdownPaths(admin)).sort() // ordine deterministico → prefisso di cache stabile

  // Download in PARALLELO: erano sequenziali (un file alla volta), che con
  // 50+ note a cache fredda voleva dire sommare 50+ round-trip in fila —
  // qualche secondo prima che grafo/chat avessero qualcosa da mostrare.
  // L'ordine del risultato resta comunque quello di `paths`, indipendente
  // dall'ordine di arrivo delle risposte: è quello che conta per la
  // stabilità del prompt cache lato Anthropic.
  const files = await Promise.all(paths.map(async (path): Promise<VaultFile> => {
    const { data, error } = await admin.storage.from(BUCKET).download(path)
    if (error || !data) throw new Error(`Vault download fallito (${path}): ${error?.message}`)
    const raw = await data.text()
    const { aliases, body } = parseFrontmatter(raw)
    const segments = path.split('/')
    const pathTitle = segments[segments.length - 1].replace(/\.md$/, '')
    const folder = segments.length > 1 ? segments[0] : 'Indice'
    // Il nome del file nel bucket è ASCII-safe (Supabase Storage rifiuta gli
    // accenti nelle chiavi degli oggetti — vedi scripts/spacequant-ingest-vault.mjs).
    // Quando l'H1 del corpo è "la stessa cosa" del nome file salvo accenti,
    // usiamo l'H1 come titolo: recupera la grafia corretta (es. "Replicabilità"
    // invece di "Replicabilita") senza toccare le altre note dove nome file e
    // H1 già combaciano esattamente.
    const h1 = body.match(/^#\s+(.+?)\s*$/m)?.[1]
    const title = h1 && grezzo(h1) === grezzo(pathTitle) ? h1 : pathTitle
    return { path, folder, title, aliases, body }
  }))
  return files
}

// Indice titolo/alias (minuscolo) → titolo canonico, per risolvere i [[wikilink]].
export function buildTitleIndex(files: VaultFile[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const f of files) {
    index.set(f.title.toLowerCase(), f.title)
    for (const alias of f.aliases) index.set(alias.toLowerCase(), f.title)
  }
  return index
}

// Estrae i titoli canonici citati come [[Target]] o [[Target|Testo visibile]].
// I link non risolvibili (typo, nota inesistente) vengono scartati in silenzio,
// non fanno fallire l'estrazione — coerente con "niente archi/citazioni morte".
export function extractWikilinkTitles(text: string, index: Map<string, string>): string[] {
  const titles: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = m[1].split('|')[0].replace(/\\/g, '').trim()
    const canonical = index.get(target.toLowerCase())
    if (canonical && !seen.has(canonical)) { seen.add(canonical); titles.push(canonical) }
  }
  return titles
}

export interface GraphNode { id: string; cartella: string; grado: number }
export interface GraphEdge { da: string; a: string }

export function buildGraph(files: VaultFile[]): { nodi: GraphNode[]; archi: GraphEdge[] } {
  const index = buildTitleIndex(files)
  const grado = new Map<string, number>()
  const archi: GraphEdge[] = []

  for (const f of files) {
    for (const target of extractWikilinkTitles(f.body, index)) {
      archi.push({ da: f.title, a: target })
      grado.set(f.title, (grado.get(f.title) ?? 0) + 1)
      grado.set(target, (grado.get(target) ?? 0) + 1)
    }
  }

  const nodi: GraphNode[] = files.map(f => ({
    id: f.title,
    cartella: f.folder,
    grado: grado.get(f.title) ?? 0,
  }))

  return { nodi, archi }
}

// Grafo dimostrativo, usato SOLO finché il bucket del vault è vuoto (prima
// dell'ingestion) — sparisce da solo non appena le note vere vengono caricate.
// Generato proceduralmente (tanti nodi, come richiesto) con un collegamento a
// "attaccamento preferenziale": ogni nuovo nodo si aggancia a nodi già molto
// connessi con più probabilità — è lo stesso meccanismo che produce la
// struttura a hub tipica dei grafi Obsidian reali (pochi nodi molto centrali,
// tanti periferici), non un reticolo uniforme che sembrerebbe finto.

// PRNG deterministico (mulberry32): stesso identico grafo ad ogni richiesta
// finché il codice non cambia, non rigenerato/rimescolato ad ogni reload.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEMO_CONCEPTS = [
  'R-multiple', 'Specifiche di mercato', 'La valuta del conto', 'Il motore di backtest',
  'Capire un backtest', 'Lotto e rischio', 'Il Vault, 5 verifiche', 'Export MQL5',
  'Creare una Strategia', 'Validare i parametri', 'La Strategia non entra mai',
  'I numeri in valuta non tornano', 'MAE e MFE', 'Dashboard Strategie', 'Report Backtest',
  'Confronto Strategie', 'Inizia da qui', 'Profit Factor', 'Sharpe Ratio', 'Sortino Ratio',
  'Drawdown massimo', 'Volatilità', 'Slippage', 'Spread', 'Correlazione', 'Overfitting',
  'Edge statistico', 'Money management', 'Position sizing', 'Timeframe', 'Walk-forward',
  'Monte Carlo', 'Curva di equity', 'Expectancy', 'Win Rate', 'Payoff Ratio',
  'Kelly Criterion', 'Value at Risk', 'Beta di mercato', 'Regime di mercato',
  'Autocorrelazione', 'Stazionarietà', 'Rumore di mercato', 'Bias di sopravvivenza',
  'Data snooping', 'Robustezza', 'Sensitivity Analysis', 'Rolling Window',
  'Cross-validation', 'Out-of-sample', 'In-sample', 'Grid Search',
  'Ottimizzazione parametri', 'Curve fitting', 'Trend following', 'Mean reversion',
  'Breakout', 'Momentum', 'Volume Profile', 'Order Flow', 'Liquidità', 'Market Impact',
  'Commissioni', 'Costi di transazione', 'Latenza di esecuzione', 'Tick data',
  'Bar aggregation', 'Renko', 'Heikin Ashi', 'Expert Advisor', 'MQL5',
  'Tester Strategie', 'Ottimizzatore genetico',
]
const DEMO_MODIFIERS = [': errori comuni', ' — esempio pratico', ', checklist', ': quando fidarsi', ' e falsi segnali', ': un caso reale']
const DEMO_FOLDER_NAMES = ['Capire', 'Come fare', 'Concetti', 'Glossario', 'Metriche', 'Pagine', 'Problemi', 'Indice']
const DEMO_NODE_COUNT = 160

export function buildDemoGraph(): { nodi: GraphNode[]; archi: GraphEdge[] } {
  const rand = mulberry32(42)

  const titles: string[] = []
  const seen = new Set<string>()
  let guard = 0
  while (titles.length < DEMO_NODE_COUNT && guard < DEMO_NODE_COUNT * 6) {
    guard++
    const base = DEMO_CONCEPTS[Math.floor(rand() * DEMO_CONCEPTS.length)]
    const title = titles.length < DEMO_CONCEPTS.length
      ? DEMO_CONCEPTS[titles.length] // prima passata: tutti i concetti base, senza ripetizioni
      : base + DEMO_MODIFIERS[Math.floor(rand() * DEMO_MODIFIERS.length)]
    if (seen.has(title)) continue
    seen.add(title); titles.push(title)
  }

  const archi: GraphEdge[] = []
  const grado = new Map<string, number>()
  const bump = (t: string) => grado.set(t, (grado.get(t) ?? 0) + 1)

  for (let i = 1; i < titles.length; i++) {
    const target = titles[i]
    const linkCount = 2 + Math.floor(rand() * 4) // 2-5 collegamenti a nodi già esistenti (era 1-3, sembrava scarno)
    const pool = titles.slice(0, i)
    const weights = pool.map(t => (grado.get(t) ?? 0) + 1) // +1: anche i nodi isolati hanno una chance
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const chosen = new Set<number>()
    for (let k = 0; k < linkCount && chosen.size < pool.length; k++) {
      let r = rand() * totalWeight
      let idx = 0
      for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break }
      if (chosen.has(idx)) continue
      chosen.add(idx)
      archi.push({ da: target, a: pool[idx] })
      bump(target); bump(pool[idx])
    }
  }

  // Passata bonus di collegamenti "trasversali" fra nodi qualunque (non solo
  // in ordine di crescita): senza questa, il grafo resta quasi un albero —
  // aggiunge gli incroci di sfondo tipici di un vero grafo Obsidian.
  const collegamentiBonus = Math.floor(titles.length * 0.7)
  for (let k = 0; k < collegamentiBonus; k++) {
    const i = Math.floor(rand() * titles.length)
    const j = Math.floor(rand() * titles.length)
    if (i === j) continue
    archi.push({ da: titles[i], a: titles[j] })
    bump(titles[i]); bump(titles[j])
  }

  const nodi: GraphNode[] = titles.map((id, i) => ({
    id, cartella: DEMO_FOLDER_NAMES[i % DEMO_FOLDER_NAMES.length], grado: grado.get(id) ?? 0,
  }))
  return { nodi, archi }
}

// Nodi puramente decorativi da aggiungere al grafo REALE: nessuna nota dietro,
// nessun testo mostrato (il client non ha etichette hover né azione al tocco
// sui nodi — vedi KnowledgeGraph.tsx). Richiesta esplicita: il grafo mostrato
// non deve rispecchiare 1:1 il sommario del manuale, solo dare l'impressione
// di una nuvola più fitta.
//
// L'attaccamento preferenziale pesca SEMPRE anche dai nodi reali fin dal
// primo nodo decorativo (non solo con un bonus finale sparso): prima
// versione creava i decorativi come loro proprio cluster preferenziale,
// collegato al grafo reale solo con pochi archi sparsi alla fine — con la
// fisica a repulsione, due gruppi densi con pochi ponti si separano in due
// "lobi" (l'effetto "8 storto" segnalato). Mescolando fin da subito i due
// insiemi nel pool di attaccamento, i decorativi si intrecciano nella stessa
// nuvola invece di formarne una a parte.
export function buildDecorativeExtras(realTitles: string[], count: number): { nodi: GraphNode[]; archi: GraphEdge[] } {
  const rand = mulberry32(7)
  const ids = Array.from({ length: count }, (_, i) => `deco-${i}`)
  const archi: GraphEdge[] = []
  const grado = new Map<string, number>()
  const bump = (t: string) => grado.set(t, (grado.get(t) ?? 0) + 1)
  for (const t of realTitles) grado.set(t, 1) // peso di partenza, altrimenti mai scelti dal pool

  for (let i = 0; i < ids.length; i++) {
    const target = ids[i]
    const linkCount = 2 + Math.floor(rand() * 3) // 2-4, più del prima: serve più intreccio
    const pool = [...realTitles, ...ids.slice(0, i)]
    if (pool.length === 0) continue
    const weights = pool.map(t => grado.get(t) ?? 1)
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const chosen = new Set<number>()
    for (let k = 0; k < linkCount && chosen.size < pool.length; k++) {
      let r = rand() * totalWeight
      let idx = 0
      for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break }
      if (chosen.has(idx)) continue
      chosen.add(idx)
      archi.push({ da: target, a: pool[idx] })
      bump(target); bump(pool[idx])
    }
  }

  const nodi: GraphNode[] = ids.map(id => ({ id, cartella: 'Indice', grado: grado.get(id) ?? 0 }))
  return { nodi, archi }
}

// Concatenazione deterministica dell'intero vault per il blocco system cacheable.
// MAI restituita al client — solo usata per costruire la richiesta ad Anthropic.
export function buildSystemText(files: VaultFile[]): string {
  return files.map(f => {
    const aliasLine = f.aliases.length ? `\nAlias: ${f.aliases.join(', ')}` : ''
    return `### ${f.title} (${f.folder})${aliasLine}\n\n${f.body}`
  }).join('\n\n---\n\n')
}

// Cache in-memory a livello di modulo (dura quanto l'istanza Deno rimane calda
// tra un'invocazione e l'altra) — riduce le chiamate a Storage, non sostituisce
// il prompt caching di Anthropic (quello vive lato API, indipendente da questa).
const CACHE_TTL_MS = 15 * 60 * 1000
let cached: { files: VaultFile[]; at: number } | null = null

export async function getCachedVault(admin: SupabaseClient): Promise<VaultFile[]> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.files
  const files = await loadVaultFiles(admin)
  cached = { files, at: Date.now() }
  return files
}
