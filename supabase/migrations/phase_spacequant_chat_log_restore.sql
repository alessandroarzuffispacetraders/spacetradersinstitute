-- ============================================================
-- Quant-Brain — la cronologia salvata deve ricomparire quando lo studente
-- riapre la pagina (non solo restare in un log per l'admin).
-- Idempotente, re-runnable nel SQL Editor di Supabase.
-- ============================================================

-- Citazioni (soprattutto i video) servono a ri-renderizzare i badge cliccabili
-- quando la cronologia viene ricaricata — senza, un vecchio {{Titolo video}}
-- ricaricato non avrebbe modo di risolversi in un link.
alter table public.spacequant_chat_log
  add column if not exists note_citate text[] not null default '{}',
  add column if not exists video_citati jsonb not null default '[]'::jsonb;

-- Prima: solo admin poteva leggere (log di controllo). Ora anche lo studente
-- legge le PROPRIE righe, per far ricomparire la sua cronologia.
drop policy if exists spacequant_chat_log_admin_read on public.spacequant_chat_log;
drop policy if exists spacequant_chat_log_self_read on public.spacequant_chat_log;
create policy spacequant_chat_log_self_read on public.spacequant_chat_log
  for select using (auth.uid() = user_id or public.is_admin());
