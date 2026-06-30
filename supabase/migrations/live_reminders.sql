-- ============================================================
-- IST — Reminder push per le live (dedup)
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Registro degli invii già effettuati, una riga per (live, offset), così
-- l'edge function 'live-reminders' non rispedisce lo stesso reminder.
-- offset (kind): '2d', '1d', '5h', '1h', 'start'.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.live_reminders_sent (
  live_event_id uuid NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (live_event_id, kind)
);

ALTER TABLE public.live_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Nessun accesso client: ci scrive/legge solo la service role (edge function),
-- che bypassa la RLS. In più, l'admin può leggerla (debug/monitoraggio).
DROP POLICY IF EXISTS "reminders admin read" ON public.live_reminders_sent;
CREATE POLICY "reminders admin read" ON public.live_reminders_sent
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- SCHEDULING — due opzioni (sceglierne UNA):
--
-- (A) CONSIGLIATA — Supabase Dashboard → Integrations → Cron:
--     crea uno schedule "ogni 15 minuti" che fa una HTTP POST a
--       https://<project>.supabase.co/functions/v1/live-reminders
--     con header  x-cron-secret: <CRON_SECRET>
--     (nessun segreto nel DB).
--
-- (B) Alternativa SQL con pg_cron + pg_net (decommenta e sostituisci i valori):
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'live-reminders-15min', '*/15 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/live-reminders',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
-- ============================================================
