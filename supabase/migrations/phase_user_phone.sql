-- Numero di telefono utente — RISERVATO: visibile SOLO a se stessi e all'admin.
--
-- Perché una tabella separata e non una colonna in `profiles`:
-- la policy SELECT di `profiles` (phase_profiles_lockdown.sql) concede la riga
-- INTERA anche al coach e al mental coach ASSEGNATI allo studente, e la RLS di
-- Postgres è per-riga, non per-colonna. Mettendo il telefono in `profiles` quei
-- ruoli lo leggerebbero con `select('*')`. Isolandolo qui, con RLS self-OR-admin,
-- coach e mental coach NON possono vederlo — solo l'utente stesso e l'admin.

CREATE TABLE IF NOT EXISTS public.profiles_private (
  id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text
);

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

-- Privilegi di tabella: solo authenticated (mai anon). Le righe le filtra la RLS.
REVOKE ALL ON public.profiles_private FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON public.profiles_private TO authenticated;

-- Lettura: solo se stessi o admin. Coach/mental/altri esclusi.
DROP POLICY IF EXISTS "profiles_private select self or admin" ON public.profiles_private;
CREATE POLICY "profiles_private select self or admin" ON public.profiles_private
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Scrittura: se stessi o admin (il trigger di registrazione gira SECURITY
-- DEFINER e bypassa comunque la RLS; queste servono agli update dal client).
DROP POLICY IF EXISTS "profiles_private insert self or admin" ON public.profiles_private;
CREATE POLICY "profiles_private insert self or admin" ON public.profiles_private
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_private update self or admin" ON public.profiles_private;
CREATE POLICY "profiles_private update self or admin" ON public.profiles_private
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Registrazione: oltre a `profiles`, salva il telefono in `profiles_private`.
-- Ricalca la versione ATTIVA del trigger (phase_free_tier.sql), aggiungendo phone.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_tier text := coalesce(new.raw_user_meta_data->>'tier', 'free');
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status, tier)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    v_role,
    CASE WHEN v_role = 'student' THEN 'active' ELSE NULL END,
    CASE WHEN v_role = 'student' THEN v_tier ELSE 'full' END
  );

  INSERT INTO public.profiles_private (id, phone)
  VALUES (new.id, nullif(new.raw_user_meta_data->>'phone', ''));

  RETURN new;
END;
$$;
