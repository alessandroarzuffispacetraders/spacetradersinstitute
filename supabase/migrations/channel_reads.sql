CREATE TABLE IF NOT EXISTS public.channel_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id   text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

ALTER TABLE public.channel_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reads" ON public.channel_reads
  FOR ALL USING (auth.uid() = user_id);
