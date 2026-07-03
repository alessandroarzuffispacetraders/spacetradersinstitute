-- ============================================================
-- IST — P1: enforcement dello STATUS lato server (RLS)
-- Idempotente, ri-eseguibile.
--
-- Problema: l'AccessGate è solo CLIENT-side. Uno studente
-- pending/expired/blocked poteva ancora leggere contenuti e community
-- via API perché nessuna policy controllava `status`.
--
-- Modello (vedi phase_access_gate / phase_free_tier):
--   • studente status='active'  → accesso (free o full, poi gating per tier)
--   • studente pending/expired/blocked → NESSUN accesso
--   • staff (admin/coach/mental_coach) → status NULL, sempre accesso
--
-- Helper:
--   is_staff()          = il caller è admin/coach/mental_coach
--   is_active_student() = il caller ha status='active'
-- Gate contenuti/community = (is_staff() OR is_active_student()).
-- ============================================================

-- ── Helper ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.my_roles() && ARRAY['admin','coach','mental_coach']::text[];
$$;

-- Studente "in regola": status='active'. I gratuiti sono 'active' → passano
-- (il gating free/full resta ortogonale via is_free_user()). pending/expired/
-- blocked → false. NULL (solo staff, ma difensivo) → false.
CREATE OR REPLACE FUNCTION public.is_active_student()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active'
  );
$$;

-- ── CONTENUTI: categories / courses / lessons ─────────────────────────────────
-- Aggiunge il gate di status al ramo non-admin (published + tier restano).
DROP POLICY IF EXISTS "categories read published or admin" ON public.categories;
CREATE POLICY "categories read published or admin" ON public.categories
  FOR SELECT USING (
    public.is_admin()
    OR (
      published = true
      AND (public.is_staff() OR public.is_active_student())
      AND (NOT public.is_free_user() OR is_free)
    )
  );

DROP POLICY IF EXISTS "courses read published or admin" ON public.courses;
CREATE POLICY "courses read published or admin" ON public.courses
  FOR SELECT USING (
    public.is_admin()
    OR (
      published = true
      AND (public.is_staff() OR public.is_active_student())
      AND (NOT public.is_free_user() OR public.category_is_free(category_id))
    )
  );

DROP POLICY IF EXISTS "lessons read published or admin" ON public.lessons;
CREATE POLICY "lessons read published or admin" ON public.lessons
  FOR SELECT USING (
    public.is_admin()
    OR (
      published = true
      AND (public.is_staff() OR public.is_active_student())
      AND (NOT public.is_free_user() OR public.course_category_is_free(course_id))
    )
  );
-- attachments: cascata automatica via lessons RLS (EXISTS su lessons) → nessun
-- cambio necessario, ma essendo dipendente dalla policy lessons sopra, è gated.

-- ── COMMUNITY: channels / messages / bacheca / reactions / live ───────────────
DROP POLICY IF EXISTS "channels read by role" ON public.channels;
CREATE POLICY "channels read by role" ON public.channels
  FOR SELECT USING (
    public.is_admin()
    OR (
      (public.is_staff() OR public.is_active_student())
      AND public.my_roles() && roles
      AND (NOT public.is_free_user() OR free = true)
    )
  );

DROP POLICY IF EXISTS "read messages" ON public.messages;
CREATE POLICY "read messages" ON public.messages
  FOR SELECT USING (
    (public.is_staff() OR public.is_active_student())
    AND (
      left(channel_id, 3) <> 'dm_'
      OR auth.uid()::text = split_part(substring(channel_id FROM 4), '_', 1)
      OR auth.uid()::text = split_part(substring(channel_id FROM 4), '_', 2)
    )
  );

DROP POLICY IF EXISTS "read reactions" ON public.message_reactions;
CREATE POLICY "read reactions" ON public.message_reactions
  FOR SELECT USING (public.is_staff() OR public.is_active_student());

DROP POLICY IF EXISTS "bacheca_read" ON public.bacheca_posts;
CREATE POLICY "bacheca_read" ON public.bacheca_posts
  FOR SELECT USING (
    (public.is_staff() OR public.is_active_student())
    AND EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = bacheca_posts.channel_id AND c.roles && public.my_roles()
    )
  );

DROP POLICY IF EXISTS "live read authenticated" ON public.live_events;
CREATE POLICY "live read authenticated" ON public.live_events
  FOR SELECT USING (public.is_staff() OR public.is_active_student());

-- ── Materiali/def condivisi (contenuto letto da tutti gli autenticati) ────────
DROP POLICY IF EXISTS "mental_materials read" ON public.mental_materials;
CREATE POLICY "mental_materials read" ON public.mental_materials
  FOR SELECT USING (public.is_staff() OR public.is_active_student());

DROP POLICY IF EXISTS "mental_checklist_defs read" ON public.mental_checklist_defs;
CREATE POLICY "mental_checklist_defs read" ON public.mental_checklist_defs
  FOR SELECT USING (public.is_staff() OR public.is_active_student());

DROP POLICY IF EXISTS "path_step_defs read" ON public.path_step_defs;
CREATE POLICY "path_step_defs read" ON public.path_step_defs
  FOR SELECT USING (public.is_staff() OR public.is_active_student());

-- ── POST/scrittura community: blocca i non-attivi in may_post() ───────────────
-- (copre messages INSERT e bacheca_posts INSERT, che usano may_post()).
CREATE OR REPLACE FUNCTION public.may_post(p_channel_id text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_can_post text[];
  v_free     boolean;
  v_a text; v_b text; v_other text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Solo staff o studente attivo possono scrivere (blocca pending/expired/blocked).
  IF NOT (public.is_staff() OR public.is_active_student()) THEN
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

  RETURN (public.my_roles() && v_can_post) AND (NOT public.is_free_user() OR COALESCE(v_free, false));
END;
$$;
