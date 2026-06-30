-- ============================================================
-- IST — Live: ownership + gestione da parte di coach/mental coach
-- Idempotent, re-runnable nel SQL Editor di Supabase. Richiede D1 (my_roles).
--
-- Prima: solo l'admin poteva creare/modificare le live.
-- Ora: anche coach e mental coach possono gestire le PROPRIE live
-- (crearle, andare in onda, terminarle, salvare il replay). L'admin gestisce
-- tutte. Si aggiunge live_events.owner_id per legare una live a chi la crea.
-- ============================================================

ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS live_events_owner_idx ON public.live_events (owner_id);

-- Rimuove la vecchia policy "tutto solo admin" e la sostituisce con policy granulari.
DROP POLICY IF EXISTS "live admin write" ON public.live_events;

-- INSERT: admin qualsiasi; coach/mental solo se la live è loro (owner_id = se stessi).
DROP POLICY IF EXISTS "live insert" ON public.live_events;
CREATE POLICY "live insert" ON public.live_events
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (owner_id = auth.uid() AND public.my_roles() && '{coach,mental_coach}'::text[])
  );

-- UPDATE: admin tutte; gli altri solo le proprie.
DROP POLICY IF EXISTS "live update" ON public.live_events;
CREATE POLICY "live update" ON public.live_events
  FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR owner_id = auth.uid());

-- DELETE: admin tutte; gli altri solo le proprie.
DROP POLICY IF EXISTS "live delete" ON public.live_events;
CREATE POLICY "live delete" ON public.live_events
  FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());

-- SELECT invariata: "live read authenticated" (tutti gli autenticati vedono le live).

-- ---------- verifica (opzionale) ----------
-- come coach: INSERT con owner_id = proprio uid → ok; con owner_id altrui → rifiutato.
-- come coach: UPDATE/DELETE di una live altrui → rifiutato; della propria → ok.
