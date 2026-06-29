-- ============================================================
-- IST RLS HARDENING — idempotent, re-runnable in Supabase SQL Editor
-- Goal 1: a non-admin cannot escalate role/roles/status/phase/permissions/assignments on profiles.
-- Goal 2: DM messages readable/insertable only by the two participants; group channels unchanged.
-- ============================================================

-- ---------- 1) profiles: trigger guard against self-escalation ----------
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role (no JWT) and admins may change anything.
  IF auth.uid() IS NULL OR COALESCE(public.get_my_role(), '') = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admin: block changes to sensitive columns (including the primary key).
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

DROP TRIGGER IF EXISTS trg_guard_profile ON public.profiles;
CREATE TRIGGER trg_guard_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- Defense-in-depth: re-validate row ownership/admin on the UPDATE policy itself
-- (the trigger is no longer the single point of failure).
DROP POLICY IF EXISTS "Admin aggiorna tutti i profili" ON public.profiles;
CREATE POLICY "Admin aggiorna tutti i profili" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = id OR public.get_my_role() = 'admin');

-- ---------- 2) messages: DM-aware SELECT / INSERT ----------
-- Drop EVERY existing SELECT and INSERT policy on messages so no legacy
-- permissive policy survives and OR-combines to leak DMs. (UPDATE/DELETE
-- own-message policies are intentionally left untouched.)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'messages'
      AND cmd IN ('SELECT', 'INSERT')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "read messages" ON public.messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      left(channel_id, 3) <> 'dm_'
      OR auth.uid()::text IN (
           split_part(substring(channel_id FROM 4), '_', 1),
           split_part(substring(channel_id FROM 4), '_', 2)
         )
    )
  );

CREATE POLICY "insert own message" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      left(channel_id, 3) <> 'dm_'
      OR auth.uid()::text IN (
           split_part(substring(channel_id FROM 4), '_', 1),
           split_part(substring(channel_id FROM 4), '_', 2)
         )
    )
  );

-- ---------- 3) Verification (optional) ----------
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
--   WHERE tablename IN ('messages','profiles') ORDER BY tablename, cmd;