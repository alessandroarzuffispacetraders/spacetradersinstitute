-- ============================================================================
-- Post delle bacheche (canali type='bacheca', es. #avvisi).
-- Chi può pubblicare è deciso da channels.can_post (gestito da Admin → Chat)
-- ed è applicato lato server con may_post(channel_id).
-- ============================================================================

create table if not exists public.bacheca_posts (
  id          uuid primary key default gen_random_uuid(),
  channel_id  text not null references public.channels(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_role text not null,
  title       text,
  content     text not null,
  tag         text,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists bacheca_posts_channel_idx
  on public.bacheca_posts (channel_id, pinned desc, created_at desc);

alter table public.bacheca_posts enable row level security;

-- Lettura: chi ha un ruolo tra quelli abilitati a vedere il canale.
drop policy if exists bacheca_read on public.bacheca_posts;
create policy bacheca_read on public.bacheca_posts for select
  using (exists (
    select 1 from public.channels c
    where c.id = bacheca_posts.channel_id and c.roles && public.my_roles()
  ));

-- Inserimento: solo chi può postare nel canale (may_post) e a proprio nome.
drop policy if exists bacheca_insert on public.bacheca_posts;
create policy bacheca_insert on public.bacheca_posts for insert
  with check (author_id = auth.uid() and public.may_post(channel_id));

-- Modifica (es. pin): autore o admin.
drop policy if exists bacheca_update on public.bacheca_posts;
create policy bacheca_update on public.bacheca_posts for update
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

-- Eliminazione: autore o admin.
drop policy if exists bacheca_delete on public.bacheca_posts;
create policy bacheca_delete on public.bacheca_posts for delete
  using (author_id = auth.uid() or public.is_admin());

-- Realtime (idempotente).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bacheca_posts'
  ) then
    alter publication supabase_realtime add table public.bacheca_posts;
  end if;
end $$;

-- Le bacheche esistenti: consenti a staff (admin/coach/mental) di pubblicare.
update public.channels
  set can_post = array['admin','coach','mental_coach']::text[]
  where type = 'bacheca';
