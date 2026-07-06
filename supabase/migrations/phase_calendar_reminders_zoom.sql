-- ============================================================
-- IST — Calendario: eventi "reminder" (non-live) + Live "Zoom esterna"
-- Idempotente, re-runnable nel SQL Editor di Supabase.
--
-- 1) event_type: distingue una riga 'live' da un semplice 'reminder' di calendario
--    (nessun video/chat/push; solo un promemoria in calendario). Creabile da
--    admin/coach/mental (stesse policy write di live_events).
-- 2) is_external: la live si svolge su Zoom ESTERNO (nessun embed in-app); poco
--    prima dell'inizio il cron posta il link in bacheca "Link Zoom" e notifica.
-- 3) audience: chi può partecipare / riceve la notifica dell'annuncio Zoom
--    ('all' = tutti gli studenti, 'full' = solo paganti, 'free' = solo gratuiti).
-- ============================================================

ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience    text NOT NULL DEFAULT 'all';

-- CHECK idempotenti (aggiunti solo se non esistono).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_events_event_type_chk') THEN
    ALTER TABLE public.live_events ADD CONSTRAINT live_events_event_type_chk
      CHECK (event_type IN ('live','reminder'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_events_audience_chk') THEN
    ALTER TABLE public.live_events ADD CONSTRAINT live_events_audience_chk
      CHECK (audience IN ('all','full','free'));
  END IF;
END $$;

-- ---------- trigger canale live-chat: NON crearlo per i reminder ----------
-- Un reminder è solo un evento di calendario: non deve generare un canale chat.
CREATE OR REPLACE FUNCTION public.create_live_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER          -- bypassa la RLS write di channels (admin-only)
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type = 'reminder' THEN
    RETURN NEW;           -- niente canale per i promemoria
  END IF;
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

-- ---------- bacheca dedicata "Link Zoom" ----------
-- Ci finiscono, in automatico, i link per accedere alle live Zoom esterne.
-- Visibile a tutti (free + paganti + staff); scrivibile solo dall'admin/servizio.
INSERT INTO public.channels
  (id, name, description, type, category, category_icon, roles, can_post, position, pinned)
VALUES (
  'link-zoom',
  'Link Zoom',
  'Link per accedere alle live su Zoom',
  'bacheca',
  'Avvisi',
  '🔗',
  ARRAY['free','student','coach','mental_coach','admin'],
  ARRAY['admin'],
  5,
  true
)
ON CONFLICT (id) DO NOTHING;
