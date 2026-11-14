-- Locandine AI delle "serie" (categorie del catalogo), in formato verticale 2:3.
-- Le disegna Claude (SVG senza testo) con la edge function generate-cover
-- (kind 'category'); il titolo della serie lo scrive l'app sopra la grafica.
-- Colonne separate da categories.cover_url, che resta la copertina caricata a
-- mano dall'admin. Idempotente. Da applicare DOPO phase_video_covers.sql
-- (riusa il bucket pubblico 'video-covers', cartella category/{id}/).
begin;

alter table public.categories add column if not exists poster_url        text;
alter table public.categories add column if not exists poster_status     text;   -- null | pending | ready | error
alter table public.categories add column if not exists poster_notes      text;   -- ultima richiesta di modifica dell'admin
alter table public.categories add column if not exists poster_updated_at timestamptz;
alter table public.categories add column if not exists poster_error      text;   -- motivo dell'ultimo errore

do $$
begin
  alter table public.categories
    add constraint categories_poster_status_check
    check (poster_status is null or poster_status in ('pending', 'ready', 'error'));
exception when duplicate_object then null;
end $$;

-- Il bucket esiste già con phase_video_covers.sql; lo assicuriamo comunque.
insert into storage.buckets (id, name, public)
values ('video-covers', 'video-covers', true)
on conflict (id) do nothing;

commit;
