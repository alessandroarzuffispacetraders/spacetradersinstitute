-- ============================================================================
-- Immagini nei messaggi di chat.
-- - colonna messages.image_url (URL pubblico dell'immagine)
-- - bucket Storage pubblico 'chat-images' (immagini compresse lato client)
--   scrittura solo autenticati nella propria cartella <uid>/, lettura pubblica.
-- ============================================================================

alter table public.messages add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists chat_images_read on storage.objects;
create policy chat_images_read on storage.objects
  for select using (bucket_id = 'chat-images');

drop policy if exists chat_images_insert on storage.objects;
create policy chat_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists chat_images_delete on storage.objects;
create policy chat_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);
