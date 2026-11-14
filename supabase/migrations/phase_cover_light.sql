-- Versione CHIARA delle copertine (stessa grafica, sfondo bianco): l'app la
-- mostra sulle card quando lo studente ha scelto il tema chiaro (le pagine
-- Videocorsi/Live restano scure, cambiano solo le immagini delle copertine).
-- Colonne opzionali: se mancano, l'app usa la versione scura. Idempotente.
begin;

alter table public.lessons     add column if not exists cover_url_light  text;
alter table public.categories  add column if not exists poster_url_light text;
alter table public.live_events add column if not exists cover_url_light  text;

commit;
