-- ============================================================
-- PHASE B — Consolidated, idempotent migration (all tables)
-- Run in Supabase SQL Editor. Safe to re-run.
-- Convention: all coach/student FKs -> public.profiles(id)
--   (profiles.id = auth.users.id and already cascades from auth.users)
-- ============================================================

-- ---------- shared helpers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1) MENTAL COACH PRIVATE NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mental_coach_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mental_coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mental_coach_notes_coach_idx          ON public.mental_coach_notes (mental_coach_id);
CREATE INDEX IF NOT EXISTS mental_coach_notes_student_idx        ON public.mental_coach_notes (student_id);
CREATE INDEX IF NOT EXISTS mental_coach_notes_coach_student_idx  ON public.mental_coach_notes (mental_coach_id, student_id);

ALTER TABLE public.mental_coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mc notes select own"  ON public.mental_coach_notes;
CREATE POLICY "mc notes select own" ON public.mental_coach_notes
  FOR SELECT USING (auth.uid() = mental_coach_id);

DROP POLICY IF EXISTS "mc notes insert own"  ON public.mental_coach_notes;
CREATE POLICY "mc notes insert own" ON public.mental_coach_notes
  FOR INSERT WITH CHECK (auth.uid() = mental_coach_id);

DROP POLICY IF EXISTS "mc notes update own"  ON public.mental_coach_notes;
CREATE POLICY "mc notes update own" ON public.mental_coach_notes
  FOR UPDATE USING (auth.uid() = mental_coach_id) WITH CHECK (auth.uid() = mental_coach_id);

DROP POLICY IF EXISTS "mc notes delete own"  ON public.mental_coach_notes;
CREATE POLICY "mc notes delete own" ON public.mental_coach_notes
  FOR DELETE USING (auth.uid() = mental_coach_id);
-- NOTE: intentionally NO admin policy — private clinical notes stay coach-only.

DROP TRIGGER IF EXISTS trg_mc_notes_updated_at ON public.mental_coach_notes;
CREATE TRIGGER trg_mc_notes_updated_at BEFORE UPDATE ON public.mental_coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2) MENTAL COACH SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mental_coach_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mental_coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_number  integer NOT NULL CHECK (session_number IN (1, 2)),
  type            text NOT NULL DEFAULT 'standard' CHECK (type IN ('standard','follow-up','custom')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('scheduled','completed','pending','cancelled')),
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_session UNIQUE (student_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_mcs_student_id   ON public.mental_coach_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_mcs_coach_id     ON public.mental_coach_sessions (mental_coach_id);
CREATE INDEX IF NOT EXISTS idx_mcs_status       ON public.mental_coach_sessions (status);
CREATE INDEX IF NOT EXISTS idx_mcs_scheduled_at ON public.mental_coach_sessions (scheduled_at DESC) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcs_coach_student ON public.mental_coach_sessions (mental_coach_id, student_id);

ALTER TABLE public.mental_coach_sessions REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mental_coach_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mental_coach_sessions;
  END IF;
END $$;

ALTER TABLE public.mental_coach_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcs coach manage own" ON public.mental_coach_sessions;
CREATE POLICY "mcs coach manage own" ON public.mental_coach_sessions
  FOR ALL USING (auth.uid() = mental_coach_id) WITH CHECK (auth.uid() = mental_coach_id);

DROP POLICY IF EXISTS "mcs student read own" ON public.mental_coach_sessions;
CREATE POLICY "mcs student read own" ON public.mental_coach_sessions
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "mcs admin read all" ON public.mental_coach_sessions;
CREATE POLICY "mcs admin read all" ON public.mental_coach_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP TRIGGER IF EXISTS trg_mcs_updated_at ON public.mental_coach_sessions;
CREATE TRIGGER trg_mcs_updated_at BEFORE UPDATE ON public.mental_coach_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3) STUDENT FLAGS (coach segnalazioni)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue        text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('high','medium')),
  resolved     boolean NOT NULL DEFAULT false,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_flags_coach_idx         ON public.student_flags (coach_id);
CREATE INDEX IF NOT EXISTS student_flags_student_idx       ON public.student_flags (student_id);
CREATE INDEX IF NOT EXISTS student_flags_resolved_idx      ON public.student_flags (resolved);
CREATE INDEX IF NOT EXISTS student_flags_coach_student_idx ON public.student_flags (coach_id, student_id);
CREATE INDEX IF NOT EXISTS student_flags_created_at_idx    ON public.student_flags (created_at DESC);

ALTER TABLE public.student_flags REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='student_flags') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_flags;
  END IF;
END $$;

ALTER TABLE public.student_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flags coach select own" ON public.student_flags;
CREATE POLICY "flags coach select own" ON public.student_flags
  FOR SELECT USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "flags coach insert own" ON public.student_flags;
CREATE POLICY "flags coach insert own" ON public.student_flags
  FOR INSERT WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (SELECT 1 FROM public.profiles s
                WHERE s.id = student_flags.student_id AND s.assigned_coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "flags coach update own" ON public.student_flags;
CREATE POLICY "flags coach update own" ON public.student_flags
  FOR UPDATE USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "flags coach delete own" ON public.student_flags;
CREATE POLICY "flags coach delete own" ON public.student_flags
  FOR DELETE USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "flags admin read all" ON public.student_flags;
CREATE POLICY "flags admin read all" ON public.student_flags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP TRIGGER IF EXISTS trg_student_flags_updated_at ON public.student_flags;
CREATE TRIGGER trg_student_flags_updated_at BEFORE UPDATE ON public.student_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4) EXERCISE SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercise_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id     text NOT NULL,
  title         text NOT NULL,
  content       text,
  content_url   text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed')),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_submissions_student_idx      ON public.exercise_submissions (student_id);
CREATE INDEX IF NOT EXISTS exercise_submissions_lesson_idx       ON public.exercise_submissions (lesson_id);
CREATE INDEX IF NOT EXISTS exercise_submissions_status_idx       ON public.exercise_submissions (status);
CREATE INDEX IF NOT EXISTS exercise_submissions_submitted_at_idx ON public.exercise_submissions (submitted_at DESC);

ALTER TABLE public.exercise_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subs student select own" ON public.exercise_submissions;
CREATE POLICY "subs student select own" ON public.exercise_submissions
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "subs student insert own" ON public.exercise_submissions;
CREATE POLICY "subs student insert own" ON public.exercise_submissions
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "subs coach select assigned" ON public.exercise_submissions;
CREATE POLICY "subs coach select assigned" ON public.exercise_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles s
            WHERE s.id = exercise_submissions.student_id AND s.assigned_coach_id = auth.uid())
  );

DROP POLICY IF EXISTS "subs coach update assigned" ON public.exercise_submissions;
CREATE POLICY "subs coach update assigned" ON public.exercise_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles s
            WHERE s.id = exercise_submissions.student_id AND s.assigned_coach_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles s
            WHERE s.id = exercise_submissions.student_id AND s.assigned_coach_id = auth.uid())
  );

-- Guard: coach UPDATE may only touch status/reviewed_at; immutable content stays put.
CREATE OR REPLACE FUNCTION public.guard_submission_immutable()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() <> OLD.student_id THEN
    IF NEW.student_id   IS DISTINCT FROM OLD.student_id
       OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.title     IS DISTINCT FROM OLD.title
       OR NEW.content   IS DISTINCT FROM OLD.content
       OR NEW.content_url IS DISTINCT FROM OLD.content_url
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Only status/reviewed_at may be updated by a coach';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subs_guard ON public.exercise_submissions;
CREATE TRIGGER trg_subs_guard BEFORE UPDATE ON public.exercise_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_immutable();

-- ============================================================
-- 5) SUBMISSION FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submission_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.exercise_submissions(id) ON DELETE CASCADE,
  coach_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback_text   text NOT NULL,
  flagged_blocked boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_feedback_submission_idx ON public.submission_feedback (submission_id);
CREATE INDEX IF NOT EXISTS submission_feedback_coach_idx      ON public.submission_feedback (coach_id);

ALTER TABLE public.submission_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb student select own" ON public.submission_feedback;
CREATE POLICY "fb student select own" ON public.submission_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.exercise_submissions es
            WHERE es.id = submission_feedback.submission_id AND es.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "fb coach insert assigned" ON public.submission_feedback;
CREATE POLICY "fb coach insert assigned" ON public.submission_feedback
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.exercise_submissions es
      JOIN public.profiles s ON s.id = es.student_id
      WHERE es.id = submission_feedback.submission_id AND s.assigned_coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fb coach select" ON public.submission_feedback;
CREATE POLICY "fb coach select" ON public.submission_feedback
  FOR SELECT USING (
    coach_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.exercise_submissions es
      JOIN public.profiles s ON s.id = es.student_id
      WHERE es.id = submission_feedback.submission_id AND s.assigned_coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fb coach update own" ON public.submission_feedback;
CREATE POLICY "fb coach update own" ON public.submission_feedback
  FOR UPDATE USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "fb coach delete own" ON public.submission_feedback;
CREATE POLICY "fb coach delete own" ON public.submission_feedback
  FOR DELETE USING (coach_id = auth.uid());

DROP TRIGGER IF EXISTS trg_fb_updated_at ON public.submission_feedback;
CREATE TRIGGER trg_fb_updated_at BEFORE UPDATE ON public.submission_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();