-- Copertine reali per le categorie videocorsi (caricate dall'admin).
-- Idempotente. Bucket pubblico + scrittura riservata all'admin (public.is_admin()).
begin;

alter table public.categories add column if not exists cover_url text;

-- Bucket pubblico per le copertine.
insert into storage.buckets (id, name, public)
values ('category-covers', 'category-covers', true)
on conflict (id) do nothing;

-- RLS su storage.objects: lettura pubblica, scrittura solo admin.
drop policy if exists "category_covers_read" on storage.objects;
create policy "category_covers_read" on storage.objects
  for select using (bucket_id = 'category-covers');

drop policy if exists "category_covers_admin_insert" on storage.objects;
create policy "category_covers_admin_insert" on storage.objects
  for insert with check (bucket_id = 'category-covers' and public.is_admin());

drop policy if exists "category_covers_admin_update" on storage.objects;
create policy "category_covers_admin_update" on storage.objects
  for update using (bucket_id = 'category-covers' and public.is_admin());

drop policy if exists "category_covers_admin_delete" on storage.objects;
create policy "category_covers_admin_delete" on storage.objects
  for delete using (bucket_id = 'category-covers' and public.is_admin());

commit;
