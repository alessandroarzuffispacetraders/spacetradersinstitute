// Carica il vault SpaceQuant (cartella locale di note .md stile Obsidian) nel
// bucket privato 'spacequant-vault' su Supabase Storage, mantenendo la
// struttura di cartelle come path. Idempotente (upsert): rieseguibile ogni
// volta che le note cambiano.
//
// USO (dalla root del progetto):
//   SUPABASE_SERVICE_ROLE_KEY='LA_TUA_SERVICE_ROLE_KEY' node scripts/spacequant-ingest-vault.mjs
//
// Cartella vault opzionale: SPACEQUANT_VAULT_DIR='...' (default ~/Downloads/SpaceQuant-Vault).
// L'URL del progetto viene letto da .env.local (VITE_SUPABASE_URL).

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const VAULT_DIR = process.env.SPACEQUANT_VAULT_DIR || join(homedir(), 'Downloads', 'SpaceQuant-Vault')

function readEnv(key) {
  try {
    const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const m = txt.match(new RegExp('^' + key + '=(.*)$', 'm'))
    return m ? m[1].trim() : undefined
  } catch { return undefined }
}

const SUPABASE_URL = process.env.SUPABASE_URL || readEnv('VITE_SUPABASE_URL')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Manca SUPABASE_URL (.env.local) o SUPABASE_SERVICE_ROLE_KEY (variabile d\'ambiente).')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

// Supabase Storage rifiuta come "Invalid key" qualunque carattere accentato
// nella chiave dell'oggetto (verificato: "Replicabilità dal vivo.md" fallisce
// anche già in forma NFC — non è un problema di normalizzazione Unicode, la
// chiave deve proprio essere ASCII). La spelling corretta con accento non si
// perde: resta nel titolo H1 dentro il file, che _shared/vault.ts usa per
// recuperarla (vedi lì) — qui serve solo una chiave valida per il bucket.
function chiaveAscii(s) {
  // Scompone gli accenti (NFD: "a" + segno diacritico separato) e scarta i
  // segni diacritici per codice numerico (range Unicode "Combining Diacritical
  // Marks", 0x0300-0x036f) invece che con una classe di caratteri letterale
  // nel sorgente — più robusto, niente caratteri combinanti "invisibili" da
  // portarsi dietro nel file.
  return Array.from(s.normalize('NFD'))
    .filter((ch) => { const c = ch.codePointAt(0); return !(c >= 0x0300 && c <= 0x036f) })
    .join('')
}

function walk(dir, prefix = '') {
  const paths = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue // .DS_Store e simili
    const full = join(dir, entry) // percorso reale sul filesystem: NON toccare
    const relPath = chiaveAscii(prefix ? `${prefix}/${entry}` : entry)
    if (statSync(full).isDirectory()) {
      paths.push(...walk(full, relPath))
    } else if (entry.endsWith('.md')) {
      paths.push({ full, relPath })
    }
  }
  return paths
}

let files
try {
  files = walk(VAULT_DIR)
} catch (err) {
  console.error(`❌ Cartella vault non trovata: ${VAULT_DIR}`, '-', err.message)
  process.exit(1)
}

console.log(`Trovate ${files.length} note in ${VAULT_DIR}\n`)

let ok = 0
for (const { full, relPath } of files) {
  const content = readFileSync(full)
  const { error } = await admin.storage.from('spacequant-vault').upload(relPath, content, {
    contentType: 'text/markdown',
    upsert: true,
  })
  if (error) {
    console.error(`❌ ${relPath} — ${error.message}`)
  } else {
    ok++
    console.log(`✓ ${relPath}`)
  }
}

console.log(`\n${ok}/${files.length} note caricate nel bucket 'spacequant-vault'.`)
if (ok < files.length) process.exit(1)
