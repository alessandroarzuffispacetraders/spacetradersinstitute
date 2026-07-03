-- ============================================================================
-- IST — Audio + file nelle chat PRIVATE (DM)
-- Idempotente, ri-eseguibile nel SQL Editor / via `supabase db query --linked`.
--
-- Requisiti (decisi col fondatore):
--   • Audio (vocali stile WhatsApp): TUTTI, ma solo nelle chat private 1:1 (DM).
--   • File (documenti + immagini): SOLO staff (coach/mental_coach/admin),
--     sempre solo nei DM.
--   • Le immagini inline restano invariate (colonna image_url, ovunque).
--
-- Enforcement 100% server-side (coerente con la passata di sicurezza):
--   la policy INSERT su messages verifica il canale (DM) e il ruolo (staff)
--   in aggiunta a may_post() (che già copre status/free-tier/partecipanti DM).
-- ============================================================================

-- ── 1) Colonne allegato sui messaggi ────────────────────────────────────────
alter table public.messages add column if not exists audio_url          text;
alter table public.messages add column if not exists audio_duration_sec integer;
alter table public.messages add column if not exists file_url           text;
alter table public.messages add column if not exists file_name          text;
alter table public.messages add column if not exists file_size          bigint;

-- ── 2) Bucket pubblico 'chat-media' (audio + file) ──────────────────────────
-- Pubblico come 'chat-images': i path sono UUID non enumerabili; scrittura
-- consentita solo nella propria cartella <uid>/, lettura pubblica.
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists chat_media_read on storage.objects;
create policy chat_media_read on storage.objects
  for select using (bucket_id = 'chat-media');

drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 3) INSERT messages: gating di audio/file ────────────────────────────────
-- Base invariata: autore = se stesso AND may_post() (status/free/DM/ruoli).
-- Aggiunte:
--   • audio/file consentiti SOLO nei canali DM (channel_id like 'dm_%').
--   • file consentiti SOLO allo staff (is_staff()); l'audio resta libero.
drop policy if exists "insert own message" on public.messages;
create policy "insert own message" on public.messages
  for insert with check (
    auth.uid() = user_id
    and public.may_post(channel_id)
    -- audio/file solo nei DM
    and (
      (audio_url is null and file_url is null)
      or left(channel_id, 3) = 'dm_'
    )
    -- i file solo allo staff (l'audio è consentito a tutti)
    and (
      file_url is null
      or public.is_staff()
    )
  );

-- ── 4) Verifica (opzionale) ──────────────────────────────────────────────────
-- SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'messages';
-- SELECT id, public FROM storage.buckets WHERE id = 'chat-media';
