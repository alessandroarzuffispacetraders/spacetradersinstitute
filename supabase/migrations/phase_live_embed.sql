-- ============================================================
-- IST — Live: embed opzionale in-app (YouTube/Vimeo live)
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Aggiunge live_events.live_embed_url: se valorizzato, lo studente guarda la
-- diretta DENTRO l'app (iframe YouTube Live / Vimeo) accanto alla chat, invece
-- di aprire Zoom. È opt-in per singola live: se NULL resta il flusso Zoom.
-- Nessuna policy nuova: usa le stesse RLS di live_events.
-- ============================================================

ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS live_embed_url text;
