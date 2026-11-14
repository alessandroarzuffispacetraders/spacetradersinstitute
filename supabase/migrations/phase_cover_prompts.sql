-- Copertine create a mano con ChatGPT: per ogni lezione e serie salviamo il
-- "soggetto" scelto da Claude (funzione generate-cover, mode 'prompt'), da cui
-- l'admin costruisce il prompt completo da incollare in ChatGPT. Il risultato
-- (immagine) viene poi caricato dall'admin nelle colonne già esistenti
-- (lessons.cover_url / categories.poster_url) nel bucket 'video-covers'.
--
-- Forma del JSON: { "visual": "<nome dalla libreria>", "soggetto": "...",
--                   "contorno": "...", "parolaChiave": "LIQUIDITÀ" (solo lezioni) }
--
-- Idempotente e solo additiva. Nessuna policy nuova: le policy "lessons admin
-- write" / "categories admin write" (FOR ALL, public.is_admin()) coprono già
-- l'aggiornamento di queste colonne dal client admin, e il bucket 'video-covers'
-- ha già insert/update/delete per l'admin e lettura pubblica.
-- Da applicare DOPO phase_video_covers.sql e phase_series_posters.sql.
begin;

alter table public.lessons    add column if not exists cover_prompt  jsonb;
alter table public.categories add column if not exists poster_prompt jsonb;

commit;
