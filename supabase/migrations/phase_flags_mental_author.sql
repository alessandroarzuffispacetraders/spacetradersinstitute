-- ============================================================
-- IST — Segnalazioni: anche il MENTAL COACH può crearle (sui propri studenti)
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Estende la policy INSERT: oltre al coach assegnato, anche il mental coach
-- assegnato allo studente può creare una segnalazione (senza destinatario →
-- va all'admin). L'admin resta libero di creare qualsiasi segnalazione.
-- ============================================================

DROP POLICY IF EXISTS "flags insert" ON public.student_flags;
CREATE POLICY "flags insert" ON public.student_flags
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id
    AND (
      public.is_admin()
      OR (
        recipient_id IS NULL
        AND student_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles s
          WHERE s.id = student_flags.student_id
            AND (s.assigned_coach_id = auth.uid() OR s.assigned_mental_coach_id = auth.uid())
        )
      )
    )
  );
