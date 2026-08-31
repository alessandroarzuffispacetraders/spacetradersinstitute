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

export async function loadVaultFiles(admin: SupabaseClient): Promise<VaultFile[]> {
  const paths = (await listMarkdownPaths(admin)).sort() // ordine deterministico → prefisso di cache stabile

  const files: VaultFile[] = []
  for (const path of paths) {
    const { data, error } = await admin.storage.from(BUCKET).download(path)
    if (error || !data) throw new Error(`Vault download fallito (${path}): ${error?.message}`)
    const raw = await data.text()
    const { aliases, body } = parseFrontmatter(raw)
    const segments = path.split('/')
    const title = segments[segments.length - 1].replace(/\.md$/, '')
    const folder = segments.length > 1 ? segments[0] : 'Indice'
    files.push({ path, folder, title, aliases, body })
  }
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
// dell'ingestion). Titoli/collegamenti coerenti con lo schema reale delle
// note (stesse 8 cartelle, stesso stile di collegamento denso) così l'anteprima
// sembra autentica; sparisce da solo non appena le note vere vengono caricate.
const DEMO_EDGES: GraphEdge[] = [
  { da: 'R-multiple', a: 'Il motore di backtest' },
  { da: 'R-multiple', a: 'Lotto e rischio' },
  { da: 'R-multiple', a: 'Capire un backtest' },
  { da: 'R-multiple', a: 'La valuta del conto' },
  { da: 'R-multiple', a: 'Specifiche di mercato' },
  { da: 'La valuta del conto', a: 'Specifiche di mercato' },
  { da: 'La valuta del conto', a: 'Lotto e rischio' },
  { da: 'Il motore di backtest', a: 'Capire un backtest' },
  { da: 'Specifiche di mercato', a: 'I numeri in valuta non tornano' },
  { da: 'La valuta del conto', a: 'I numeri in valuta non tornano' },
  { da: 'Il Vault, 5 verifiche', a: 'Creare una Strategia' },
  { da: 'Creare una Strategia', a: 'Validare i parametri' },
  { da: 'Validare i parametri', a: 'Overfitting' },
  { da: 'Validare i parametri', a: 'Overfitting sui parametri' },
  { da: 'Export MQL5', a: 'Creare una Strategia' },
  { da: 'Il Vault, 5 verifiche', a: 'Il motore di backtest' },
  { da: 'Overfitting', a: 'Overfitting sui parametri' },
  { da: 'Overfitting', a: 'Edge statistico' },
  { da: 'Edge statistico', a: 'R-multiple' },
  { da: 'MAE e MFE', a: 'Il motore di backtest' },
  { da: 'MAE e MFE', a: 'Drawdown massimo' },
  { da: 'Drawdown massimo', a: 'Profit Factor' },
  { da: 'Profit Factor', a: 'Win Rate' },
  { da: 'Profit Factor', a: 'R-multiple medio' },
  { da: 'Sharpe Ratio', a: 'Profit Factor' },
  { da: 'R-multiple medio', a: 'R-multiple' },
  { da: 'Win Rate', a: 'La Strategia non entra mai' },
  { da: 'Dashboard Strategie', a: 'Report Backtest' },
  { da: 'Report Backtest', a: 'Confronto Strategie' },
  { da: 'Report Backtest', a: 'Profit Factor' },
  { da: 'Dashboard Strategie', a: 'Il Vault, 5 verifiche' },
  { da: 'La Strategia non entra mai', a: 'Creare una Strategia' },
  { da: 'Inizia da qui', a: 'R-multiple' },
  { da: 'Inizia da qui', a: 'Il Vault, 5 verifiche' },
  { da: 'Inizia da qui', a: 'Dashboard Strategie' },
]

const DEMO_FOLDERS: Record<string, string> = {
  'R-multiple': 'Capire', 'Specifiche di mercato': 'Capire', 'La valuta del conto': 'Capire',
  'Il motore di backtest': 'Capire', 'Capire un backtest': 'Capire', 'Lotto e rischio': 'Capire',
  'Il Vault, 5 verifiche': 'Come fare', 'Export MQL5': 'Come fare',
  'Creare una Strategia': 'Come fare', 'Validare i parametri': 'Come fare',
  'Overfitting': 'Concetti', 'Edge statistico': 'Concetti',
  'MAE e MFE': 'Glossario', 'Drawdown massimo': 'Glossario',
  'Profit Factor': 'Metriche', 'Sharpe Ratio': 'Metriche', 'Win Rate': 'Metriche', 'R-multiple medio': 'Metriche',
  'Dashboard Strategie': 'Pagine', 'Report Backtest': 'Pagine', 'Confronto Strategie': 'Pagine',
  'La Strategia non entra mai': 'Problemi', 'I numeri in valuta non tornano': 'Problemi', 'Overfitting sui parametri': 'Problemi',
  'Inizia da qui': 'Indice',
}

export function buildDemoGraph(): { nodi: GraphNode[]; archi: GraphEdge[] } {
  const grado = new Map<string, number>()
  for (const e of DEMO_EDGES) {
    grado.set(e.da, (grado.get(e.da) ?? 0) + 1)
    grado.set(e.a, (grado.get(e.a) ?? 0) + 1)
  }
  const nodi: GraphNode[] = Object.entries(DEMO_FOLDERS).map(([id, cartella]) => ({
    id, cartella, grado: grado.get(id) ?? 0,
  }))
  return { nodi, archi: DEMO_EDGES }
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
