-- Foto profilo: bucket pubblico `avatars`. Ogni utente scrive solo nella propria
-- cartella `<uid>/...`; lettura pubblica (le foto profilo non sono sensibili e
-- servono ovunque come <img src>). Sostituisce il vecchio approccio "base64 nel DB".

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Lettura pubblica dei file del bucket avatars.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Scrittura (insert/update/delete) solo nella propria cartella `<uid>/`.
drop policy if exists "avatars own insert" on storage.objects;
create policy "avatars own insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update"
  on storage.objects for update to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );
