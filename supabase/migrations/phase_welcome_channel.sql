-- ============================================================
-- IST — Canale "Benvenuto" + messaggio automatico ai nuovi utenti
-- Idempotente.
--
-- Alla creazione di un nuovo profilo studente (self-signup o creato
-- dall'admin), un trigger posta nel canale 'benvenuto' un messaggio a nome
-- dell'admin ("Benvenuto/a <nome>..."). Il frontend mostra, sotto quel
-- messaggio e SOLO all'utente destinatario, un tastino di risposta preimpostata.
-- Il messaggio è inserito server-side (SECURITY DEFINER) → non falsificabile e
-- immune al trigger anti-spoofing (auth.uid() null al signup).
-- ============================================================

-- (1) Colonne per i messaggi "di sistema" con destinatario.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS target_user_id uuid;

-- (2) Canale benvenuto: visibile e postabile da tutti (free inclusi), in alto.
INSERT INTO public.channels (id, name, description, type, category, category_icon, roles, can_post, position, pinned, free)
VALUES (
  'benvenuto', 'benvenuto',
  'Diamo il benvenuto ai nuovi membri della community 👋',
  'chat', 'Community', '👋',
  '{student,coach,mental_coach,admin}', '{student,coach,mental_coach,admin}',
  1, true, true
) ON CONFLICT (id) DO NOTHING;

-- (3) Trigger: posta il benvenuto quando nasce un nuovo STUDENTE.
CREATE OR REPLACE FUNCTION public.post_welcome_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id   uuid;
  v_admin_name text;
BEGIN
  -- Solo per gli studenti (free + full); non per lo staff.
  IF COALESCE(NEW.role, '') <> 'student' THEN
    RETURN NEW;
  END IF;

  -- Mittente = primo admin (per created_at). Se non c'è admin, salta.
  SELECT p.id, p.name INTO v_admin_id, v_admin_name
  FROM public.profiles p
  WHERE p.role = 'admin' OR p.roles::text ILIKE '%admin%'
  ORDER BY p.created_at ASC
  LIMIT 1;
  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Il canale deve esistere; niente doppioni per lo stesso utente.
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = 'benvenuto') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.messages
    WHERE channel_id = 'benvenuto' AND kind = 'welcome' AND target_user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.messages (channel_id, user_id, author_name, author_role, content, kind, target_user_id)
  VALUES (
    'benvenuto', v_admin_id, v_admin_name, 'admin',
    'Benvenuto/a ' || COALESCE(NULLIF(trim(NEW.name), ''), 'nella community') ||
      ' nella community IST! 🎉 Siamo felici di averti con noi — presentati pure qui sotto 👇',
    'welcome', NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_welcome ON public.profiles;
CREATE TRIGGER trg_post_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.post_welcome_message();
