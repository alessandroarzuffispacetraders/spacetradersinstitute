-- ============================================================
-- IST CHAT FIX — esegui tutto nel SQL Editor di Supabase
-- Idempotente: puoi rieseguirlo senza problemi.
-- ============================================================

-- ---------- 1) CREA colonne edit/delete su messages ----------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------- 2) CREA tabella reactions (se manca) ----------
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- ---------- 3) FIX REALTIME (publication, idempotente) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND tablename='message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

-- REPLICA IDENTITY FULL: necessaria perché UPDATE/DELETE realtime
-- portino la riga completa (modifica/elimina messaggi e reazioni live).
ALTER TABLE public.messages          REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- ---------- 4) FIX RLS messages ----------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read messages" ON public.messages;
CREATE POLICY "read messages" ON public.messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "insert own message" ON public.messages;
CREATE POLICY "insert own message" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own message" ON public.messages;
CREATE POLICY "update own message" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete own message" ON public.messages;
CREATE POLICY "delete own message" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- 5) FIX RLS reactions ----------
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read reactions" ON public.message_reactions;
CREATE POLICY "read reactions" ON public.message_reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "manage own reactions" ON public.message_reactions;
CREATE POLICY "manage own reactions" ON public.message_reactions
  FOR ALL USING (auth.uid() = user_id);

-- ---------- 6) VERIFICA FINALE ----------
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename IN ('messages','message_reactions');
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'messages';
