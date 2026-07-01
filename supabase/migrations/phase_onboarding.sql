-- ============================================================
-- IST — Onboarding studente (primi passi)
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Traccia i 3 primi passi di ogni studente (self-service):
--   welcome_seen · questionnaire_done · tutorial_done.
-- + lessons.is_welcome per marcare la lezione "video di benvenuto"
--   (mostrata in home finché non vista, poi resta solo nel videocorso).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_onboarding (
  user_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  welcome_seen       boolean NOT NULL DEFAULT false,
  questionnaire_done boolean NOT NULL DEFAULT false,
  tutorial_done      boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_onboarding ENABLE ROW LEVEL SECURITY;

-- SELECT: lo studente vede il proprio; l'admin li vede tutti (eventuali stat).
DROP POLICY IF EXISTS "onboarding read" ON public.student_onboarding;
CREATE POLICY "onboarding read" ON public.student_onboarding
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- INSERT/UPDATE: solo lo studente stesso sul proprio record.
DROP POLICY IF EXISTS "onboarding self insert" ON public.student_onboarding;
CREATE POLICY "onboarding self insert" ON public.student_onboarding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "onboarding self update" ON public.student_onboarding;
CREATE POLICY "onboarding self update" ON public.student_onboarding
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Lezione "video di benvenuto" (una sola; gestita lato admin: set uno → azzera gli altri).
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_welcome boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS lessons_is_welcome_idx ON public.lessons (is_welcome) WHERE is_welcome;
