-- ============================================================
-- IST — Segnalazioni: l'admin può crearle/inviarle a coach/mental e risolverle
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Prima: solo coach→studente (coach_id autore, student_id soggetto); admin sola lettura.
-- Ora si aggiunge un DESTINATARIO (recipient_id): l'admin crea una segnalazione e
-- la manda a un coach/mental coach (student_id opzionale). Chi la riceve la vede
-- e può segnarla risolta; l'admin può risolvere/eliminare qualsiasi segnalazione.
--
-- Nota: `coach_id` = AUTORE (coach oppure admin). Manteniamo il nome per compat.
-- ============================================================

ALTER TABLE public.student_flags
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS student_flags_recipient_idx ON public.student_flags (recipient_id);

-- Le segnalazioni admin→staff possono non riguardare uno studente specifico.
ALTER TABLE public.student_flags ALTER COLUMN student_id DROP NOT NULL;

-- ---------- Policy unificate (sostituiscono quelle di phase_b) ----------
DROP POLICY IF EXISTS "flags coach select own" ON public.student_flags;
DROP POLICY IF EXISTS "flags coach insert own" ON public.student_flags;
DROP POLICY IF EXISTS "flags coach update own" ON public.student_flags;
DROP POLICY IF EXISTS "flags coach delete own" ON public.student_flags;
DROP POLICY IF EXISTS "flags admin read all"  ON public.student_flags;

-- SELECT: autore, admin, o destinatario.
DROP POLICY IF EXISTS "flags select" ON public.student_flags;
CREATE POLICY "flags select" ON public.student_flags
  FOR SELECT USING (
    auth.uid() = coach_id OR public.is_admin() OR auth.uid() = recipient_id
  );

-- INSERT:
--   • admin: qualsiasi segnalazione (autore = se stesso);
--   • coach: solo su un PROPRIO studente assegnato, senza destinatario.
DROP POLICY IF EXISTS "flags insert" ON public.student_flags;
CREATE POLICY "flags insert" ON public.student_flags
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id
    AND (
      public.is_admin()
      OR (
        recipient_id IS NULL
        AND student_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles s
                    WHERE s.id = student_flags.student_id AND s.assigned_coach_id = auth.uid())
      )
    )
  );

-- UPDATE (risolvere/modificare): autore, admin, o destinatario.
DROP POLICY IF EXISTS "flags update" ON public.student_flags;
CREATE POLICY "flags update" ON public.student_flags
  FOR UPDATE
  USING (auth.uid() = coach_id OR public.is_admin() OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = coach_id OR public.is_admin() OR auth.uid() = recipient_id);

-- DELETE: autore o admin.
DROP POLICY IF EXISTS "flags delete" ON public.student_flags;
CREATE POLICY "flags delete" ON public.student_flags
  FOR DELETE USING (auth.uid() = coach_id OR public.is_admin());
