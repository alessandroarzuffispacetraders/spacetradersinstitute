-- Realtime per i badge "novità" nella nav:
-- - live_events → pallino "Live in corso" (status='live') aggiornato in tempo reale
-- - submissions → pallino Compiti (nuove consegne per il coach / nuovo feedback per lo studente)
-- Idempotente: aggiunge le tabelle alla publication solo se non già presenti.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_events'
  ) then
    alter publication supabase_realtime add table public.live_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;
