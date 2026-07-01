-- ============================================================
-- IST — Programma personalizzabile dall'admin
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- 1) path_step_defs   : gli STEP del percorso (dentro le 4 fasi fisse), editabili
--                       dall'admin. Il completamento per-studente resta in
--                       path_steps (key = step_key), toggle di coach/admin.
-- 2) mental_materials      : materiali utili del Mental Coach (globali, admin CRUD).
-- 3) mental_checklist_defs : item della checklist Mental Coach (globali, admin CRUD).
-- 4) mental_checklist_done : completamento per-studente (LO STUDENTE si spunta).
--
-- Le 4 fasi (onboarding/build/test/deploy) restano strutturali (profiles.phase).
-- ============================================================

-- ---------- helper: caller = mental coach assegnato a questo studente? ----------
CREATE OR REPLACE FUNCTION public.is_assigned_mental_coach(p_student uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_student AND p.assigned_mental_coach_id = auth.uid()
  );
$$;

-- ============================================================
-- 1) STEP DEL PERCORSO (admin CRUD, tutti leggono)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.path_step_defs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase      text NOT NULL CHECK (phase IN ('onboarding','build','test','deploy')),
  step_key   text NOT NULL UNIQUE,   -- stabile: referenziato da path_steps.step_key
  label      text NOT NULL,
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS path_step_defs_phase_idx ON public.path_step_defs (phase, position);

ALTER TABLE public.path_step_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "path_step_defs read" ON public.path_step_defs;
CREATE POLICY "path_step_defs read" ON public.path_step_defs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "path_step_defs admin write" ON public.path_step_defs;
CREATE POLICY "path_step_defs admin write" ON public.path_step_defs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed: riproduce gli step hardcoded attuali (gira SOLO se la tabella è vuota).
INSERT INTO public.path_step_defs (phase, step_key, label, position)
SELECT * FROM (VALUES
  ('onboarding','onboarding.profilo',        'Completa il profilo',              0),
  ('onboarding','onboarding.benvenuto',      'Video di benvenuto',               1),
  ('onboarding','onboarding.prima-sessione', 'Prima sessione con il Coach',      2),
  ('onboarding','onboarding.setup',          'Setup strumenti di trading',       3),
  ('build','build.modulo1', 'Modulo 1: Fondamenta',            0),
  ('build','build.modulo2', 'Modulo 2: Analisi Tecnica',       1),
  ('build','build.modulo3', 'Modulo 3: Risk Management',       2),
  ('build','build.modulo4', 'Modulo 4: Psicologia del Trading',3),
  ('build','build.mental1', 'Sessione Mental Coach #1',        4),
  ('test','test.demo30',      '30 trade in demo documentati', 0),
  ('test','test.review',      'Review con il Coach',          1),
  ('test','test.mental2',     'Sessione Mental Coach #2',     2),
  ('test','test.performance', 'Analisi performance',          3),
  ('deploy','deploy.live1',          'Prima settimana in live',     0),
  ('deploy','deploy.report',         'Report settimanale',          1),
  ('deploy','deploy.finale',         'Sessione finale con Coach',   2),
  ('deploy','deploy.certificazione', 'Certificazione IST',          3)
) AS v(phase, step_key, label, position)
WHERE NOT EXISTS (SELECT 1 FROM public.path_step_defs);

-- ============================================================
-- 2) MATERIALI MENTAL COACH (globali, admin CRUD)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mental_materials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  type       text NOT NULL DEFAULT 'link' CHECK (type IN ('pdf','audio','video','task','link')),
  url        text,
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mental_materials_pos_idx ON public.mental_materials (position);

ALTER TABLE public.mental_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mental_materials read" ON public.mental_materials;
CREATE POLICY "mental_materials read" ON public.mental_materials
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mental_materials admin write" ON public.mental_materials;
CREATE POLICY "mental_materials admin write" ON public.mental_materials
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 3) CHECKLIST MENTAL COACH — definizioni (globali, admin CRUD)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mental_checklist_defs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mental_checklist_defs_pos_idx ON public.mental_checklist_defs (position);

ALTER TABLE public.mental_checklist_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mental_checklist_defs read" ON public.mental_checklist_defs;
CREATE POLICY "mental_checklist_defs read" ON public.mental_checklist_defs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "mental_checklist_defs admin write" ON public.mental_checklist_defs;
CREATE POLICY "mental_checklist_defs admin write" ON public.mental_checklist_defs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 4) CHECKLIST MENTAL COACH — completamento per-studente (SELF-CHECK)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mental_checklist_done (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mental_checklist_defs(id) ON DELETE CASCADE,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.mental_checklist_done ENABLE ROW LEVEL SECURITY;

-- SELECT: lo studente vede il proprio; admin e mental coach assegnato leggono (monitoraggio).
DROP POLICY IF EXISTS "mental_checklist_done read" ON public.mental_checklist_done;
CREATE POLICY "mental_checklist_done read" ON public.mental_checklist_done
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin() OR public.is_assigned_mental_coach(user_id)
  );

-- WRITE: SOLO lo studente stesso spunta/despunta la propria checklist.
DROP POLICY IF EXISTS "mental_checklist_done self write" ON public.mental_checklist_done;
CREATE POLICY "mental_checklist_done self write" ON public.mental_checklist_done
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
