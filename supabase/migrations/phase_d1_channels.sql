-- ============================================================
-- IST — Fase D1: canali reali + canPost server-side
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Obiettivo:
--   1) Spostare i canali (oggi mock in chatData.ts) in una tabella `channels`.
--   2) Enforce server-side di `can_post`: l'INSERT su `messages` ora verifica
--      che il ruolo di chi scrive sia tra quelli abilitati al canale
--      (i DM restano consentiti solo ai due partecipanti).
-- ============================================================

-- ---------- 0) helper: ruoli del caller come text[] ----------
-- Gestisce sia `profiles.role` (singolo) sia `profiles.roles` (multi, text[] o jsonb).
-- NB: niente trucco ILIKE qui perché 'coach' è sottostringa di 'mental_coach';
-- serve un confronto d'insieme esatto.
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT r FROM (
        SELECT p.role AS r
        FROM public.profiles p
        WHERE p.id = auth.uid()
        UNION
        SELECT jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(to_jsonb(p.roles)) = 'array' THEN to_jsonb(p.roles)
            ELSE '[]'::jsonb
          END
        )
        FROM public.profiles p
        WHERE p.id = auth.uid()
      ) s
      WHERE r IS NOT NULL AND r <> ''
    ),
    '{}'::text[]
  );
$$;

-- ---------- 1) tabella channels ----------
CREATE TABLE IF NOT EXISTS public.channels (
  id            text PRIMARY KEY,                 -- = messages.channel_id (es. 'generale')
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  type          text NOT NULL DEFAULT 'chat' CHECK (type IN ('chat','bacheca','live')),
  category      text NOT NULL DEFAULT '',
  category_icon text NOT NULL DEFAULT '',
  roles         text[] NOT NULL DEFAULT '{student,coach,mental_coach,admin}',  -- chi vede
  can_post      text[] NOT NULL DEFAULT '{student,coach,mental_coach,admin}',  -- chi scrive
  position      integer NOT NULL DEFAULT 0,
  pinned        boolean NOT NULL DEFAULT false,
  live_event_id uuid,                              -- valorizzato in D2 per le live-chat
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channels_position_idx ON public.channels (position);
CREATE INDEX IF NOT EXISTS channels_type_idx     ON public.channels (type);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- SELECT: l'admin vede tutto; gli altri vedono i canali dove uno dei loro ruoli è in `roles`.
DROP POLICY IF EXISTS "channels read by role" ON public.channels;
CREATE POLICY "channels read by role" ON public.channels
  FOR SELECT USING (public.is_admin() OR public.my_roles() && roles);

-- Solo admin crea/modifica/elimina canali.
DROP POLICY IF EXISTS "channels admin write" ON public.channels;
CREATE POLICY "channels admin write" ON public.channels
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 2) seed dei canali group attuali (idempotente) ----------
-- ON CONFLICT DO NOTHING: ri-eseguibile, non sovrascrive eventuali modifiche admin.
INSERT INTO public.channels (id, name, description, type, category, category_icon, roles, can_post, position, pinned) VALUES
  ('avvisi',              'avvisi',              'Comunicazioni ufficiali IST',        'bacheca', 'Annunci',   '📢', '{student,coach,mental_coach,admin}', '{admin}',                            0, true),
  ('aggiornamenti-corso', 'aggiornamenti-corso', 'Novità e aggiornamenti del programma','bacheca','Annunci',   '📢', '{student,coach,mental_coach,admin}', '{admin,coach}',                      1, false),
  ('generale',            'generale',            'La chat della community IST',         'chat',    'Community', '💬', '{student,coach,mental_coach,admin}', '{student,coach,mental_coach,admin}', 2, false),
  ('trading-ideas',       'trading-ideas',       'Analisi, setup e idee operative',     'chat',    'Community', '💬', '{student,coach,mental_coach,admin}', '{student,coach,mental_coach,admin}', 3, false),
  ('gruppo-coach',        'gruppo-coach',        'Gruppo privato con il tuo coach',     'chat',    'Coaching',  '🎯', '{student,coach,admin}',             '{student,coach,admin}',              4, false)
ON CONFLICT (id) DO NOTHING;

-- ---------- 3) may_post: chi può scrivere in un canale ----------
CREATE OR REPLACE FUNCTION public.may_post(p_channel_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_can_post text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- DM: consentito solo ai due partecipanti (anche l'admin NON entra nei DM altrui).
  IF left(p_channel_id, 3) = 'dm_' THEN
    RETURN auth.uid()::text IN (
      split_part(substring(p_channel_id FROM 4), '_', 1),
      split_part(substring(p_channel_id FROM 4), '_', 2)
    );
  END IF;

  -- L'admin può scrivere in qualsiasi canale non-DM.
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT can_post INTO v_can_post FROM public.channels WHERE id = p_channel_id;
  IF v_can_post IS NULL THEN
    RETURN false;  -- canale sconosciuto
  END IF;

  -- true se uno qualsiasi dei ruoli del caller è abilitato a postare.
  RETURN public.my_roles() && v_can_post;
END;
$$;

-- ---------- 4) messages: INSERT con enforcement di can_post ----------
DROP POLICY IF EXISTS "insert own message" ON public.messages;
CREATE POLICY "insert own message" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND public.may_post(channel_id)
  );

-- ---------- 5) verifica (opzionale) ----------
-- SELECT public.may_post('generale');     -- true per studenti
-- SELECT public.may_post('avvisi');       -- false per studenti, true per admin
-- SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'messages';
