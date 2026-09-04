-- ============================================================
-- Quant-Brain — log domande/risposte, con auto-pulizia dopo 30 giorni.
-- Idempotente, re-runnable nel SQL Editor di Supabase.
-- ============================================================

create table if not exists public.spacequant_chat_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  domanda    text not null,
  risposta   text not null,
  created_at timestamptz not null default now()
);

create index if not exists spacequant_chat_log_created_idx
  on public.spacequant_chat_log (created_at);

alter table public.spacequant_chat_log enable row level security;

-- Nessun accesso client in scrittura: ci scrive solo la service role
-- (edge function spacequant-chat, che bypassa la RLS). L'admin può leggere
-- per controllo qualità delle risposte.
drop policy if exists spacequant_chat_log_admin_read on public.spacequant_chat_log;
create policy spacequant_chat_log_admin_read on public.spacequant_chat_log
  for select using (public.is_admin());

-- Pulizia automatica ogni notte: le righe non devono accumularsi
-- indefinitamente ("per non pesare sul sistema", richiesta esplicita).
-- pg_cron è già attivo su questo progetto (vedi live_reminders.sql).
select cron.schedule(
  'spacequant-chat-log-cleanup',
  '0 3 * * *',
  $$ delete from public.spacequant_chat_log where created_at < now() - interval '30 days' $$
);
