-- ============================================================
-- IST — Promemoria: notifica singola all'orario (opzionale)
-- Idempotente, re-runnable nel SQL Editor di Supabase.
--
-- `notify` (default true): se attivo, il promemoria manda UNA notifica push a
-- tutti gli studenti all'orario dell'evento (non la scaletta 2g/1g/5h/1h delle
-- live). Disattivabile per avere un promemoria muto (solo in calendario).
-- Le live vere non usano questo flag: mantengono sempre la scaletta completa.
-- ============================================================

ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT true;
