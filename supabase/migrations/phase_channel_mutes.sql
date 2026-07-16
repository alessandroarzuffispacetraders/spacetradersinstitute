-- Silenzia canali per-utente (stile WhatsApp): ogni utente sceglie di NON ricevere
-- notifiche push da uno o più canali di gruppo (o DM). Il gate push vive in
-- send-push (esclude chi ha silenziato il canale); il client nasconde il pallino
-- "novità" per i canali silenziati. I non-letti restano comunque conteggiati.
--
-- Riservata a se stessi (self-only): nessuno vede o modifica i mute altrui.
-- channel_id è TEXT (come channels.id) e ospita anche i DM ("dm_<uid>_<uid>"),
-- perciò NESSUNA FK verso channels (i DM non sono righe di channels).

CREATE TABLE IF NOT EXISTS public.channel_mutes (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

ALTER TABLE public.channel_mutes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.channel_mutes FROM anon, public;
GRANT SELECT, INSERT, DELETE ON public.channel_mutes TO authenticated;

DROP POLICY IF EXISTS "channel_mutes self select" ON public.channel_mutes;
CREATE POLICY "channel_mutes self select" ON public.channel_mutes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "channel_mutes self insert" ON public.channel_mutes;
CREATE POLICY "channel_mutes self insert" ON public.channel_mutes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "channel_mutes self delete" ON public.channel_mutes;
CREATE POLICY "channel_mutes self delete" ON public.channel_mutes
  FOR DELETE USING (auth.uid() = user_id);
