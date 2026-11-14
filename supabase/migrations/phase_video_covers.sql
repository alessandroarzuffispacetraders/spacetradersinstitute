-- Copertine dei video generate dall'AI (Claude disegna un'illustrazione SVG
-- senza testo + sceglie una parola chiave dal titolo; la parola la scrive l'app
-- sopra la grafica). Valgono per le LEZIONI e per i REPLAY delle live.
-- Idempotente. Bucket pubblico in lettura; scrive la edge function
-- generate-cover con la service-role key (bypassa RLS), le policy admin sotto
-- servono solo per eventuali operazioni manuali da client admin.
begin;

-- ── Lezioni ──────────────────────────────────────────────────────────────────
alter table public.lessons add column if not exists cover_url        text;
alter table public.lessons add column if not exists cover_keyword    text;
alter table public.lessons add column if not exists cover_status     text;   -- null | pending | ready | error
alter table public.lessons add column if not exists cover_notes      text;   -- ultima richiesta di modifica dell'admin
alter table public.lessons add column if not exists cover_updated_at timestamptz;
alter table public.lessons add column if not exists cover_error      text;   -- motivo dell'ultimo errore

-- ── Live / replay ────────────────────────────────────────────────────────────
alter table public.live_events add column if not exists cover_url        text;
alter table public.live_events add column if not exists cover_keyword    text;
alter table public.live_events add column if not exists cover_status     text;
alter table public.live_events add column if not exists cover_notes      text;
alter table public.live_events add column if not exists cover_updated_at timestamptz;
alter table public.live_events add column if not exists cover_error      text;

-- Valori ammessi per lo stato (vincolo aggiunto una sola volta).
do $$
begin
  alter table public.lessons
    add constraint lessons_cover_status_check
    check (cover_status is null or cover_status in ('pending', 'ready', 'error'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.live_events
    add constraint live_events_cover_status_check
    check (cover_status is null or cover_status in ('pending', 'ready', 'error'));
exception when duplicate_object then null;
end $$;

-- ── Storage: bucket pubblico per le copertine ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('video-covers', 'video-covers', true)
on conflict (id) do nothing;

drop policy if exists "video_covers_read" on storage.objects;
create policy "video_covers_read" on storage.objects
  for select using (bucket_id = 'video-covers');

drop policy if exists "video_covers_admin_insert" on storage.objects;
create policy "video_covers_admin_insert" on storage.objects
  for insert with check (bucket_id = 'video-covers' and public.is_admin());

drop policy if exists "video_covers_admin_update" on storage.objects;
create policy "video_covers_admin_update" on storage.objects
  for update using (bucket_id = 'video-covers' and public.is_admin());

drop policy if exists "video_covers_admin_delete" on storage.objects;
create policy "video_covers_admin_delete" on storage.objects
  for delete using (bucket_id = 'video-covers' and public.is_admin());

commit;
