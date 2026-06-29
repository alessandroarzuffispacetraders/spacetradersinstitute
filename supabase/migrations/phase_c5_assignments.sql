-- ============================================================
-- PHASE C5 — COMPITI / ASSIGNMENTS (coach-assigned tasks)
-- Run in Supabase SQL Editor. Safe to re-run.
-- Flow: coach assigns -> student submits (note + images) -> coach reviews
--       (feedback + freehand markup images) -> student sees the result.
-- Supersedes the lesson-tied exercise_submissions from Phase B.
-- ============================================================

-- shared helper (already exists from earlier phases; re-create is safe)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1) ASSIGNMENTS — a task a coach assigns to one of their students
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','submitted','reviewed')),
  due_at      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_coach_idx   ON public.assignments (coach_id);
CREATE INDEX IF NOT EXISTS assignments_student_idx ON public.assignments (student_id);
CREATE INDEX IF NOT EXISTS assignments_status_idx  ON public.assignments (status);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments coach manage" ON public.assignments;
CREATE POLICY "assignments coach manage" ON public.assignments
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (SELECT 1 FROM public.profiles s
                WHERE s.id = assignments.student_id AND s.assigned_coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "assignments student read" ON public.assignments;
CREATE POLICY "assignments student read" ON public.assignments
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "assignments admin read" ON public.assignments;
CREATE POLICY "assignments admin read" ON public.assignments
  FOR SELECT USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON public.assignments;
CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2) SUBMISSIONS — a student's response to an assignment
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note          text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed')),
  coach_feedback text,
  blocked       boolean NOT NULL DEFAULT false,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_assignment_idx ON public.submissions (assignment_id);
CREATE INDEX IF NOT EXISTS submissions_student_idx    ON public.submissions (student_id);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Student: insert own submission for their own assignment; read own. (No update.)
DROP POLICY IF EXISTS "submissions student insert" ON public.submissions;
CREATE POLICY "submissions student insert" ON public.submissions
  FOR INSERT WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (SELECT 1 FROM public.assignments a
                WHERE a.id = submissions.assignment_id AND a.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "submissions student read" ON public.submissions;
CREATE POLICY "submissions student read" ON public.submissions
  FOR SELECT USING (auth.uid() = student_id);

-- Coach: read + update (feedback/status) submissions under their assignments.
DROP POLICY IF EXISTS "submissions coach read" ON public.submissions;
CREATE POLICY "submissions coach read" ON public.submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assignments a
            WHERE a.id = submissions.assignment_id AND a.coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "submissions coach update" ON public.submissions;
CREATE POLICY "submissions coach update" ON public.submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assignments a
            WHERE a.id = submissions.assignment_id AND a.coach_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.assignments a
            WHERE a.id = submissions.assignment_id AND a.coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "submissions admin read" ON public.submissions;
CREATE POLICY "submissions admin read" ON public.submissions
  FOR SELECT USING (public.is_admin());

-- Guard: a coach updating a submission may only touch feedback/status/blocked/
-- reviewed_at — never the student's note or the linkage.
CREATE OR REPLACE FUNCTION public.guard_submission_student_fields()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.student_id THEN
    IF NEW.note          IS DISTINCT FROM OLD.note
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Un coach puo aggiornare solo feedback/stato della consegna';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_submissions_guard ON public.submissions;
CREATE TRIGGER trg_submissions_guard BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_student_fields();

-- ============================================================
-- 3) SUBMISSION FILES — images uploaded by the student, or coach markups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submission_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  uploaded_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('student','coach_markup')),
  object_key     text NOT NULL,
  source_file_id uuid REFERENCES public.submission_files(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_files_submission_idx ON public.submission_files (submission_id);

ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;

-- Student: upload own 'student' images to their own submission; read files of own submissions.
DROP POLICY IF EXISTS "sfiles student insert" ON public.submission_files;
CREATE POLICY "sfiles student insert" ON public.submission_files
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND kind = 'student'
    AND EXISTS (SELECT 1 FROM public.submissions s
                WHERE s.id = submission_files.submission_id AND s.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "sfiles student read" ON public.submission_files;
CREATE POLICY "sfiles student read" ON public.submission_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.submissions s
            WHERE s.id = submission_files.submission_id AND s.student_id = auth.uid())
  );

-- Coach: upload 'coach_markup' images + read files for submissions under their assignments.
DROP POLICY IF EXISTS "sfiles coach insert" ON public.submission_files;
CREATE POLICY "sfiles coach insert" ON public.submission_files
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND kind = 'coach_markup'
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_files.submission_id AND a.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sfiles coach read" ON public.submission_files;
CREATE POLICY "sfiles coach read" ON public.submission_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = submission_files.submission_id AND a.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sfiles delete own" ON public.submission_files;
CREATE POLICY "sfiles delete own" ON public.submission_files
  FOR DELETE USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "sfiles admin read" ON public.submission_files;
CREATE POLICY "sfiles admin read" ON public.submission_files
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- 4) STORAGE — private bucket 'exercise-files'
--    Writes are scoped to the uploader's own folder (path = <uid>/...);
--    reads are open to authenticated users (the object_key is only known via
--    the RLS-gated submission_files rows).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-files', 'exercise-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "exercise-files write own folder" ON storage.objects;
CREATE POLICY "exercise-files write own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exercise-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "exercise-files update own folder" ON storage.objects;
CREATE POLICY "exercise-files update own folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'exercise-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "exercise-files delete own folder" ON storage.objects;
CREATE POLICY "exercise-files delete own folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exercise-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "exercise-files read" ON storage.objects;
CREATE POLICY "exercise-files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exercise-files');

-- ============================================================
-- Verification (optional)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN ('assignments','submissions','submission_files');
-- SELECT id, public FROM storage.buckets WHERE id='exercise-files';
