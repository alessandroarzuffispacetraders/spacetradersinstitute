-- Tabella per le push subscription di ogni dispositivo/browser
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  keys       jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- Solo l'utente stesso può leggere/scrivere le proprie subscription
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- La service role può leggere tutto (serve all'Edge Function)
CREATE POLICY "service role read" ON public.push_subscriptions
  FOR SELECT USING (true);
