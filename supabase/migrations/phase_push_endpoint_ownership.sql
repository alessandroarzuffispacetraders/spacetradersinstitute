-- Un endpoint push identifica un BROWSER/dispositivo, non un utente: è generato
-- dal service worker ed è unico per installazione del browser. Se sullo stesso
-- browser fanno login più account (tipico in test), ognuno registrava una riga
-- con lo STESSO endpoint ma user_id diverso. Risultato: quando invio un messaggio,
-- l'Edge Function esclude il MIO user_id ma trova la riga di un ALTRO account che
-- punta allo stesso endpoint → la push arriva comunque sul mio browser (mi
-- auto-notifico) e, peggio, potrei ricevere notifiche destinate ad altri account.
--
-- Fix: un endpoint appartiene a UN SOLO utente (l'ultimo che ha fatto login su
-- quel browser). Un utente può avere più dispositivi = più endpoint diversi.

-- 1) Pulizia dei duplicati esistenti: per ogni endpoint tieni solo la riga più
--    recente, elimina le altre (che appartengono ad account non più attivi lì).
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.endpoint = b.endpoint
  AND (a.created_at < b.created_at
       OR (a.created_at = b.created_at AND a.id < b.id));

-- 2) L'unicità ora è sull'endpoint, non più sulla coppia (user_id, endpoint).
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

-- 3) Registrazione "atomica" che rivendica l'endpoint per l'utente corrente.
--    SECURITY DEFINER perché la RLS impedisce al client di cancellare la riga di
--    un altro utente: la funzione gira coi privilegi del definer ma usa auth.uid(),
--    quindi ognuno può registrare solo sé stesso.
CREATE OR REPLACE FUNCTION public.register_push_subscription(p_endpoint text, p_keys jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Questo browser da ora appartiene all'utente corrente: rimuovi eventuali
  -- registrazioni dello stesso endpoint fatte da altri account.
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;

  INSERT INTO public.push_subscriptions (user_id, endpoint, keys)
  VALUES (auth.uid(), p_endpoint, p_keys);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, jsonb) TO authenticated;
