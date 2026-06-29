-- ============================================================
-- PHASE C4 — Vimeo video + Supabase Storage attachments
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1) Lessons: store the Vimeo video id (the numeric id, kept as text).
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS vimeo_id text;

-- 2) Private Storage bucket for lesson attachments (pdf/xlsx/docx/pptx/zip).
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-attachments', 'lesson-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage RLS on storage.objects for that bucket:
--    - admins may upload/replace/delete;
--    - any authenticated user may read (download).
--    Which attachment ROWS a student actually sees is already gated by the
--    public.attachments table RLS (only published lessons), so authenticated
--    read here is safe — a student only ever learns the object_key of a
--    published attachment.
DROP POLICY IF EXISTS "lesson-attachments admin write" ON storage.objects;
CREATE POLICY "lesson-attachments admin write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'lesson-attachments' AND public.is_admin())
  WITH CHECK (bucket_id = 'lesson-attachments' AND public.is_admin());

DROP POLICY IF EXISTS "lesson-attachments read" ON storage.objects;
CREATE POLICY "lesson-attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-attachments');

-- ============================================================
-- Verification (optional)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='lessons' AND column_name='vimeo_id';
-- SELECT id, public FROM storage.buckets WHERE id='lesson-attachments';
-- SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
--   AND policyname LIKE 'lesson-attachments%';
