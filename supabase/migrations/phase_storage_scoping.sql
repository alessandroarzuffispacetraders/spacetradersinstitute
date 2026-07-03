-- ============================================================
-- IST — P5: scoping della SELECT sui bucket privati
-- Idempotente. I due bucket privati avevano la SELECT aperta a QUALSIASI
-- autenticato (nessun path scoping):
--   • lesson-attachments → un utente free/blocked poteva scaricare gli
--     allegati dei corsi a pagamento (pirateria), bypassando la RLS dei
--     contenuti.
--   • exercise-files → uno studente poteva leggere i file di esercizio
--     PRIVATI di un ALTRO studente.
--
-- Fix: la SELECT dell'oggetto storage segue la visibilità del suo record
-- di metadati (public.attachments / public.submission_files), che è già
-- sotto RLS corretta (contenuto gated per status+tier+published; file di
-- esercizio scoped a studente proprietario + coach assegnato + admin).
-- I criteri INSERT/UPDATE/DELETE (già scoped alla cartella <uid>/) restano.
-- ============================================================

-- ── lesson-attachments: leggibile solo se l'allegato (e quindi la lezione)
--    è visibile al caller. attachments.object_key == storage.objects.name.
DROP POLICY IF EXISTS "lesson-attachments read" ON storage.objects;
CREATE POLICY "lesson-attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lesson-attachments'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.attachments a
        WHERE a.object_key = storage.objects.name
      )
    )
  );

-- ── exercise-files: il proprietario legge i propri file; per gli altri
--    l'accesso segue la RLS di submission_files (studente della submission
--    o coach assegnato). Chiude il leak cross-studente.
DROP POLICY IF EXISTS "exercise-files read" ON storage.objects;
CREATE POLICY "exercise-files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exercise-files'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.submission_files sf
        WHERE sf.object_key = storage.objects.name
      )
    )
  );
