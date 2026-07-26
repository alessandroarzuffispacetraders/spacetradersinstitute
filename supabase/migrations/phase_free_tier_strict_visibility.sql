-- ============================================================
-- IST — fix: i contenuti gratuiti non devono essere visibili
-- agli studenti paganti (e viceversa).
--
-- Problema: le policy introdotte in phase_free_tier.sql (poi ridefinite
-- identiche in phase_status_enforcement.sql) usano
--   (NOT is_free_user() OR is_free)
-- Per un pagante is_free_user() = false, quindi "NOT false" = true e la
-- condizione è SEMPRE vera a prescindere da is_free: i paganti vedono
-- anche le categorie/corsi/lezioni marcate gratuite.
--
-- Fix: match stretto tier↔contenuto per gli studenti (is_free_user() =
-- is_free), con lo staff (admin/coach/mental_coach) escluso dal match
-- e sempre autorizzato a vedere tutto il pubblicato (comportamento
-- staff invariato).
-- Idempotente, ri-eseguibile.
-- ============================================================

DROP POLICY IF EXISTS "categories read published or admin" ON public.categories;
CREATE POLICY "categories read published or admin" ON public.categories
  FOR SELECT USING (
    public.is_admin()
    OR (
      published = true
      AND (
        public.is_staff()
        OR (public.is_active_student() AND public.is_free_user() = is_free)
      )
    )
  );

DROP POLICY IF EXISTS "courses read published or admin" ON public.courses;
CREATE POLICY "courses read published or admin" ON public.courses
  FOR SELECT USING (
    public.is_admin()
    OR (
      published = true
      AND (
        public.is_staff()
        OR (public.is_active_student() AND public.is_free_user() = public.category_is_free(category_id))
      )
    )
  );

DROP POLICY IF EXISTS "lessons read published or admin" ON public.lessons;
CREATE POLICY "lessons read published or admin" ON public.lessons
  FOR SELECT USING (
    public.is_admin()
    OR (
      published = true
      AND (
        public.is_staff()
        OR (public.is_active_student() AND public.is_free_user() = public.course_category_is_free(course_id))
      )
    )
  );
-- attachments: cascata automatica via lessons RLS (EXISTS su lessons) → nessun
-- cambio necessario.
