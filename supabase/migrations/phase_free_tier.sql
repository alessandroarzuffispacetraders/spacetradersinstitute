-- ============================================================
-- IST — Utente gratuito (free tier)
-- Idempotente, ri-eseguibile nel SQL Editor di Supabase.
--
-- Modello: `tier` su profiles, ORTOGONALE a `status`.
--   • tier = 'full'  → studente pagante (accesso completo)
--   • tier = 'free'  → utente gratuito (solo contenuti in vetrina)
-- Un utente gratuito è uno studente (role='student') con tier='free' e
-- status='active' (entra subito, senza attesa admin). L'admin lo promuove a
-- 'full' quando paga. Il gating è per-funzione: contenuti/canali marcati
-- gratuiti sono visibili, il resto è nascosto lato server (RLS) e mostra
-- l'upsell lato UI.
-- ============================================================

-- ========== 1) profiles.tier + helper is_free_user() ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'full';

-- Vincolo (ricreato in modo idempotente).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_check CHECK (tier IN ('full','free'));

-- Gli studenti già esistenti restano paganti.
UPDATE public.profiles SET tier = 'full' WHERE tier IS NULL;

-- Il caller è un utente gratuito? SECURITY DEFINER: legge profiles a
-- prescindere dalla RLS del chiamante (stesso pattern di is_admin()).
CREATE OR REPLACE FUNCTION public.is_free_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT tier = 'free' FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- ========== 2) Registrazione pubblica = gratis + accesso immediato ==========
-- Chi si registra da solo nasce studente 'active' + tier 'free' (nessuna attesa
-- di attivazione). Lo 'status' pending resta disponibile per usi manuali. Lo
-- staff (role != student) non riceve status e resta tier 'full'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
  RETURN new;
END;
$$;

-- ========== 3) Contenuti gratuiti (corsi/lezioni) ==========
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

-- Helper SECURITY DEFINER per i controlli INCROCIATI corso↔lezione. Indispensabili
-- per NON avere ricorsione infinita nelle policy: se la policy di `courses`
-- interrogasse `lessons` (e viceversa) direttamente, ciascuna riattiverebbe la RLS
-- dell'altra all'infinito. Girando come definer, queste leggono le tabelle
-- bypassando la RLS → il ciclo si spezza.
CREATE OR REPLACE FUNCTION public.course_is_free(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT c.is_free FROM public.courses c WHERE c.id = p_course_id), false);
$$;

CREATE OR REPLACE FUNCTION public.course_has_free_lesson(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.course_id = p_course_id AND l.published AND l.is_free
  );
$$;

-- Un utente gratuito vede un CORSO solo se è marcato gratis oppure contiene
-- almeno una lezione gratuita (così il corso "contenitore" non sparisce quando
-- si sbloccano singole lezioni). Gli altri utenti vedono tutto il pubblicato.
DROP POLICY IF EXISTS "courses read published or admin" ON public.courses;
CREATE POLICY "courses read published or admin" ON public.courses
  FOR SELECT USING (
    public.is_admin()
    OR (published = true AND (
      NOT public.is_free_user()
      OR is_free
      OR public.course_has_free_lesson(id)
    ))
  );

-- Un utente gratuito vede una LEZIONE solo se è gratis o dentro un corso gratis.
DROP POLICY IF EXISTS "lessons read published or admin" ON public.lessons;
CREATE POLICY "lessons read published or admin" ON public.lessons
  FOR SELECT USING (
    public.is_admin()
    OR (published = true AND (
      NOT public.is_free_user()
      OR is_free
      OR public.course_is_free(course_id)
    ))
  );

-- Gli allegati seguono la visibilità della lezione: EXISTS su `lessons` è già
-- filtrato dalla RLS di lessons (che usa i definer sopra → niente ricorsione).
DROP POLICY IF EXISTS "attachments read via lesson" ON public.attachments;
CREATE POLICY "attachments read via lesson" ON public.attachments
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = attachments.lesson_id)
  );

-- ========== 4) Chat gratuita (canali) ==========
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS free boolean NOT NULL DEFAULT false;

-- SELECT: l'admin vede tutto; gli altri vedono i canali dei propri ruoli, ma un
-- utente gratuito SOLO quelli marcati free.
DROP POLICY IF EXISTS "channels read by role" ON public.channels;
CREATE POLICY "channels read by role" ON public.channels
  FOR SELECT USING (
    public.is_admin()
    OR (public.my_roles() && roles AND (NOT public.is_free_user() OR free = true))
  );

-- may_post: l'utente gratuito scrive solo nei canali free; nei DM può scrivere
-- SOLO a un admin (contatto per l'upgrade), non ad altri utenti.
CREATE OR REPLACE FUNCTION public.may_post(p_channel_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_can_post text[];
  v_free     boolean;
  v_a text; v_b text; v_other text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- DM: consentito solo ai due partecipanti.
  IF left(p_channel_id, 3) = 'dm_' THEN
    v_a := split_part(substring(p_channel_id FROM 4), '_', 1);
    v_b := split_part(substring(p_channel_id FROM 4), '_', 2);
    IF auth.uid()::text NOT IN (v_a, v_b) THEN
      RETURN false;
    END IF;
    -- Un utente gratuito può scrivere in DM SOLO a un admin.
    IF public.is_free_user() THEN
      v_other := CASE WHEN auth.uid()::text = v_a THEN v_b ELSE v_a END;
      RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_other::uuid
          AND (p.role = 'admin' OR p.roles::text ILIKE '%admin%')
      );
    END IF;
    RETURN true;
  END IF;

  -- L'admin può scrivere in qualsiasi canale non-DM.
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT can_post, free INTO v_can_post, v_free FROM public.channels WHERE id = p_channel_id;
  IF v_can_post IS NULL THEN
    RETURN false;  -- canale sconosciuto
  END IF;

  -- Uno dei ruoli del caller è abilitato a postare E, se è un utente gratuito,
  -- il canale dev'essere free.
  RETURN (public.my_roles() && v_can_post) AND (NOT public.is_free_user() OR COALESCE(v_free, false));
END;
$$;

-- Seed del canale community gratuito (idempotente).
INSERT INTO public.channels (id, name, description, type, category, category_icon, roles, can_post, position, pinned, free) VALUES
  ('free-community', 'community-free', 'Community di prova — assaggia la piattaforma IST', 'chat', 'Community', '💬',
   '{student,coach,mental_coach,admin}', '{student,coach,mental_coach,admin}', 10, false, true)
ON CONFLICT (id) DO NOTHING;

-- ========== 5) Verifica (opzionale) ==========
-- SELECT public.is_free_user();
-- SELECT id, free FROM public.channels ORDER BY position;
-- SELECT id, is_free FROM public.courses;  -- dopo aver marcato qualche corso
