// Crea un utente di test per ogni ruolo (admin, coach, mental_coach, student)
// usando l'API admin di Supabase. Idempotente: se un utente esiste già,
// ne aggiorna password e profilo invece di duplicarlo.
//
// USO (dalla root del progetto):
//   SUPABASE_SERVICE_ROLE_KEY='LA_TUA_SERVICE_ROLE_KEY' node scripts/create-test-users.mjs
//
// La service role key si trova in Supabase → Settings → API → "service_role" (secret).
// L'URL del progetto viene letto da .env.local (VITE_SUPABASE_URL).
// Password opzionale: TEST_PASSWORD='...' (default 'Test1234!').

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const PASSWORD = process.env.TEST_PASSWORD || 'Test1234!'

const USERS = [
  { email: 'admin@ist.test',    name: 'Admin IST',      role: 'admin' },
  { email: 'coach@ist.test',    name: 'Laura Coach',    role: 'coach' },
  { email: 'mental@ist.test',   name: 'Sofia Mental',   role: 'mental_coach' },
  { email: 'studente@ist.test', name: 'Marco Studente', role: 'student', status: 'active', phase: 'build' },
]

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

async function findUserByEmail(email) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(x => x.email === email)
    if (u) return u
    if (data.users.length < 200) return null
    page++
  }
}

const ids = {}

for (const u of USERS) {
  let userId
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: u.name, role: u.role },
  })

  if (error) {
    if (/already|exists|registered|duplicate/i.test(error.message)) {
      const existing = await findUserByEmail(u.email)
      if (!existing) { console.error('⚠️  Errore e utente non trovato:', u.email, '-', error.message); continue }
      userId = existing.id
      await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true })
      console.log('• Esiste già, password aggiornata:', u.email)
    } else {
      console.error('❌ Errore creando', u.email, '-', error.message); continue
    }
  } else {
    userId = data.user.id
    console.log('✓ Creato:', u.email)
  }

  ids[u.role] = userId

  const { error: pErr } = await admin.from('profiles').upsert({
    id: userId,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.role === 'student' ? (u.status ?? 'active') : null,
    phase:  u.role === 'student' ? (u.phase ?? 'onboarding') : null,
  }, { onConflict: 'id' })
  if (pErr) console.error('  ⚠️  profilo non salvato per', u.email, '-', pErr.message)
}

// Assegna lo studente di test al coach e al mental coach di test
if (ids.student) {
  const { error } = await admin.from('profiles').update({
    assigned_coach_id: ids.coach ?? null,
    assigned_mental_coach_id: ids.mental_coach ?? null,
  }).eq('id', ids.student)
  if (!error) console.log('✓ Studente di test assegnato a coach + mental coach')
  else console.error('⚠️  Assegnazione fallita:', error.message)
}

console.log('\n✅ Fatto. Credenziali (password uguale per tutti):')
for (const u of USERS) console.log(`   ${u.role.padEnd(13)} ${u.email}  /  ${PASSWORD}`)
