-- ============================================================
-- IST — P2 (parte 2/2): lockdown della SELECT su profiles
-- Idempotente. APPLICARE DOPO aver deployato il frontend ripuntato a
-- public.profiles_public (parte 1), per evitare finestre di rottura.
--
-- Prima: due policy permissive rendevano OGNI colonna di OGNI profilo
-- (email, tier, status, assegnazioni) leggibile da qualunque autenticato.
-- Dopo: la SELECT sulla tabella base è ristretta a
--   • self (auth.uid() = id)
--   • admin
--   • coach/mental assegnato a quello studente (staff-of-record)
-- La rubrica DM/chat (id/name/role/avatar) passa da public.profiles_public.
--
-- I sub-EXISTS su profiles presenti in altre policy (coach→studente su
-- assignments / exercise_submissions / lesson_progress / submissions /
-- submission_feedback / student_flags) restano validi: il coach/mental
-- assegnato può leggere la riga del proprio studente.
-- ============================================================

DROP POLICY IF EXISTS "read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin vede tutti i profili" ON public.profiles;

CREATE POLICY "profiles select self staff admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
    OR public.is_assigned_coach(id)
    OR public.is_assigned_mental_coach(id)
  );
