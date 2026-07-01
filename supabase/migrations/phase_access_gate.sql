-- ============================================================
-- IST — Access gate: attivazione manuale + accesso lifetime
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Modello: l'account e l'ACCESSO sono separati.
--  • 'pending'  → registrato ma non ancora attivato (nessun accesso all'app)
--  • 'active'   → attivato dall'admin, accesso a VITA (nessuna scadenza)
--  • 'blocked'  → sospeso manualmente dall'admin
--  • 'expired'  → resta valido (uso manuale), NON impostato in automatico
-- Il percorso 1:1 dura 90 giorni ma NON è legato all'accesso.
-- ============================================================

-- 1) Consenti lo stato 'pending' (ricrea il CHECK su profiles.status).
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IS NULL OR status IN ('active', 'pending', 'expired', 'blocked'));

-- 2) Grandfather: gli studenti già esistenti (status null) restano dentro.
UPDATE public.profiles SET status = 'active'
  WHERE role = 'student' AND status IS NULL;

-- 3) I NUOVI studenti registrati nascono 'pending' (attesa attivazione admin).
--    Lo staff creato dall'admin (role != student) non riceve status.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    v_role,
    CASE WHEN v_role = 'student' THEN 'pending' ELSE NULL END
  );
  RETURN new;
END;
$$;
