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

function walk(dir, prefix = '') {
  const paths = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue // .DS_Store e simili
    const full = join(dir, entry)
    const relPath = prefix ? `${prefix}/${entry}` : entry
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
