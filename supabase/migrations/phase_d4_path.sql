-- ============================================================
-- IST — Fase D4: Percorso (fase impostata da coach/admin) + passi
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- - Riusa profiles.phase come fase attuale dello studente.
-- - Estende il guard trigger: il COACH ASSEGNATO può cambiare SOLO `phase`
--   (gli altri campi sensibili restano admin-only).
-- - Nuova tabella path_steps per i passi completati (toggle del coach/admin).
-- ============================================================

-- ---------- 1) guard trigger: il coach assegnato può cambiare solo phase ----------
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role (no JWT) e admin possono cambiare tutto.
  IF auth.uid() IS NULL OR COALESCE(public.get_my_role(), '') = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Coach assegnato a questo studente: può cambiare SOLO `phase`.
  IF OLD.assigned_coach_id = auth.uid() THEN
    IF NEW.id                       IS DISTINCT FROM OLD.id
       OR NEW.role                  IS DISTINCT FROM OLD.role
       OR NEW.roles                 IS DISTINCT FROM OLD.roles
       OR NEW.status                IS DISTINCT FROM OLD.status
       OR NEW.permissions           IS DISTINCT FROM OLD.permissions
       OR NEW.assigned_coach_id     IS DISTINCT FROM OLD.assigned_coach_id
       OR NEW.assigned_mental_coach_id IS DISTINCT FROM OLD.assigned_mental_coach_id THEN
      RAISE EXCEPTION 'Il coach puo modificare solo la fase del proprio studente';
    END IF;
    RETURN NEW;  -- solo phase è cambiata: ok
  END IF;

  -- Chiunque altro (lo studente stesso, ecc.): blocca tutti i campi sensibili (phase inclusa).
  IF NEW.id                       IS DISTINCT FROM OLD.id
     OR NEW.role                  IS DISTINCT FROM OLD.role
     OR NEW.roles                 IS DISTINCT FROM OLD.roles
     OR NEW.status                IS DISTINCT FROM OLD.status
     OR NEW.phase                 IS DISTINCT FROM OLD.phase
     OR NEW.permissions           IS DISTINCT FROM OLD.permissions
     OR NEW.assigned_coach_id     IS DISTINCT FROM OLD.assigned_coach_id
     OR NEW.assigned_mental_coach_id IS DISTINCT FROM OLD.assigned_mental_coach_id THEN
    RAISE EXCEPTION 'Solo un admin puo cambiare id/ruolo/stato/fase/permessi/assegnazioni';
  END IF;

  RETURN NEW;
END;
$$;

-- (il trigger trg_guard_profile esiste già da security_rls_hardening.sql)

-- ---------- 2) profiles UPDATE: consenti al coach assegnato ----------
DROP POLICY IF EXISTS "Admin aggiorna tutti i profili" ON public.profiles;
CREATE POLICY "Admin aggiorna tutti i profili" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.get_my_role() = 'admin' OR assigned_coach_id = auth.uid())
  WITH CHECK (auth.uid() = id OR public.get_my_role() = 'admin' OR assigned_coach_id = auth.uid());

-- ---------- 3) tabella path_steps ----------
CREATE TABLE IF NOT EXISTS public.path_steps (
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  done_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step_key)
);

ALTER TABLE public.path_steps ENABLE ROW LEVEL SECURITY;

-- helper: il caller è il coach assegnato a questo studente?
CREATE OR REPLACE FUNCTION public.is_assigned_coach(p_student uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_student AND p.assigned_coach_id = auth.uid()
  );
$$;

-- SELECT: studente legge i propri; coach assegnato e admin leggono.
DROP POLICY IF EXISTS "path_steps read" ON public.path_steps;
CREATE POLICY "path_steps read" ON public.path_steps
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin() OR public.is_assigned_coach(user_id)
  );

-- WRITE (insert/update/delete): solo coach assegnato e admin.
DROP POLICY IF EXISTS "path_steps write" ON public.path_steps;
CREATE POLICY "path_steps write" ON public.path_steps
  FOR ALL
  USING (public.is_admin() OR public.is_assigned_coach(user_id))
  WITH CHECK (public.is_admin() OR public.is_assigned_coach(user_id));

-- ---------- 4) verifica (opzionale) ----------
-- UPDATE public.profiles SET phase='test' WHERE id='<student>';  -- come coach assegnato: ok
-- UPDATE public.profiles SET role='admin' WHERE id='<student>';  -- come coach: deve FALLIRE
