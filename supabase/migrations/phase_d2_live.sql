-- ============================================================
-- IST — Fase D2: Live (Zoom) + replay opzionale + live-chat reale
-- Idempotent, re-runnable nel SQL Editor di Supabase.
-- Richiede la Fase D1 (tabella `channels`, helper may_post/is_admin).
--
-- Le live sono sessioni Zoom (link esterno); il replay (video Vimeo) è
-- opzionale. Ogni live ha un canale chat reale 'live_<id>' creato via trigger,
-- così il can_post di D1 vale anche per la live-chat.
-- ============================================================

-- ---------- 1) tabella live_events ----------
CREATE TABLE IF NOT EXISTS public.live_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  host             text NOT NULL DEFAULT '',
  host_role        text NOT NULL DEFAULT 'coach'
                     CHECK (host_role IN ('student','coach','mental_coach','admin')),
  status           text NOT NULL DEFAULT 'upcoming'
                     CHECK (status IN ('live','upcoming','replay')),
  starts_at        timestamptz,                 -- quando inizia (null per i replay)
  zoom_url         text,                        -- link Zoom (live/upcoming)
  replay_vimeo_id  text,                        -- id/URL Vimeo del replay (opzionale)
  duration_minutes integer,                     -- durata replay (opzionale)
  accent           text NOT NULL DEFAULT '#7CBBD0',
  accent_end       text NOT NULL DEFAULT '#286680',
  position         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_events_status_idx   ON public.live_events (status);
CREATE INDEX IF NOT EXISTS live_events_position_idx ON public.live_events (position);

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;

-- Tutti gli autenticati vedono le live; solo admin crea/modifica/elimina.
DROP POLICY IF EXISTS "live read authenticated" ON public.live_events;
CREATE POLICY "live read authenticated" ON public.live_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "live admin write" ON public.live_events;
CREATE POLICY "live admin write" ON public.live_events
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 2) FK channels.live_event_id → live_events (cascade) ----------
-- Eliminando una live si elimina il suo canale chat. Idempotente.
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_live_event_fk;
ALTER TABLE public.channels
  ADD CONSTRAINT channels_live_event_fk
  FOREIGN KEY (live_event_id) REFERENCES public.live_events(id) ON DELETE CASCADE;

-- ---------- 3) trigger: crea il canale live-chat all'insert ----------
CREATE OR REPLACE FUNCTION public.create_live_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER          -- bypassa la RLS write di channels (admin-only)
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.channels
    (id, name, description, type, category, category_icon, roles, can_post, position, live_event_id)
  VALUES (
    'live_' || NEW.id::text,
    'Live chat',
    NEW.title,
    'live',
    'Live',
    '🔴',
    '{student,coach,mental_coach,admin}',
    '{student,coach,mental_coach,admin}',
    0,
    NEW.id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_channel ON public.live_events;
CREATE TRIGGER trg_live_channel
  AFTER INSERT ON public.live_events
  FOR EACH ROW EXECUTE FUNCTION public.create_live_channel();

-- ---------- 4) verifica (opzionale) ----------
-- INSERT INTO public.live_events (title, status, zoom_url) VALUES ('Test', 'live', 'https://zoom.us/j/x');
-- SELECT id FROM public.channels WHERE type = 'live';  -- deve esistere 'live_<id>'
