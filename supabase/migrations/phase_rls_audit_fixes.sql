-- ============================================================
-- IST — P4: fix emersi dall'audit RLS avversariale
-- Idempotente.
-- ============================================================

-- (1) push_subscriptions: la SELECT era APERTA a tutti (policy "service role
--     read" con USING true) → ogni autenticato leggeva endpoint+chiavi push di
--     TUTTI. Il service role bypassa comunque la RLS (edge functions) e il
--     frontend non fa SELECT su questa tabella. Rimuovo la policy: resta solo
--     l'owner (policy "own subscriptions", auth.uid() = user_id).
DROP POLICY IF EXISTS "service role read" ON public.push_subscriptions;

-- (2) Anti-spoofing del display in community: author_name/author_role erano
--     impostati dal client e non validati → un utente poteva postare con
--     author_role='admin' (badge falso, social engineering). Un trigger forza
--     nome+ruolo dal profilo del chiamante. Gli insert via service role
--     (auth.uid() null: seed/bot) restano invariati.
CREATE OR REPLACE FUNCTION public.set_author_display()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT p.name, p.role INTO NEW.author_name, NEW.author_role
    FROM public.profiles p WHERE p.id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_set_author ON public.messages;
CREATE TRIGGER trg_messages_set_author
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_author_display();

DROP TRIGGER IF EXISTS trg_bacheca_set_author ON public.bacheca_posts;
CREATE TRIGGER trg_bacheca_set_author
  BEFORE INSERT OR UPDATE ON public.bacheca_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_author_display();

-- (3) messages UPDATE: mancava il WITH CHECK → un utente poteva cambiare la
--     proprietà/il canale del proprio messaggio. Vincola la riga risultante.
DROP POLICY IF EXISTS "update own message" ON public.messages;
CREATE POLICY "update own message" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
