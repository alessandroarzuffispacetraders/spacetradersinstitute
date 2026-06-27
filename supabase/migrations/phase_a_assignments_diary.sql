-- ============================================================
-- FASE A — Assegnazione coach/mental coach + Diario di trading
-- Esegui nel SQL Editor di Supabase. Idempotente.
-- ============================================================

-- 1) ASSEGNAZIONE: colonne su profiles
--    Quale coach / mental coach segue ciascuno studente.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_coach_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_mental_coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_assigned_coach_idx        ON public.profiles (assigned_coach_id);
CREATE INDEX IF NOT EXISTS profiles_assigned_mental_coach_idx ON public.profiles (assigned_mental_coach_id);

-- 2) DIARIO DI TRADING
CREATE TABLE IF NOT EXISTS public.diary_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date   date NOT NULL DEFAULT current_date,
  result       text,
  trades_count int,
  emotion      text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diary_entries_user_idx ON public.diary_entries (user_id, entry_date DESC);

-- RLS: ogni utente vede e gestisce SOLO le proprie voci
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own diary" ON public.diary_entries;
CREATE POLICY "own diary" ON public.diary_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
