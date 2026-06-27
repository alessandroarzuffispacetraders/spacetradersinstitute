-- Enable realtime for messages (critical for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- RLS for messages
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

-- Edit/delete columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read reactions" ON public.message_reactions;
CREATE POLICY "read reactions" ON public.message_reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "manage own reactions" ON public.message_reactions;
CREATE POLICY "manage own reactions" ON public.message_reactions
  FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
