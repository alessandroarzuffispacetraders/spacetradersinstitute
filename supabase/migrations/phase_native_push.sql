-- Push NATIVE (APNs) per l'app iOS Capacitor. Le push web usano un endpoint +
-- chiavi VAPID; le push native usano invece un DEVICE TOKEN APNs. Riusiamo la
-- stessa tabella push_subscriptions (così send-push interroga un posto solo)
-- distinguendo per `platform` e memorizzando il token in `native_token`.
--
-- Il vincolo esistente è UNIQUE(endpoint) NOT NULL: per le righe native creiamo
-- un endpoint sintetico e univoco "native:<platform>:<token>" (le chiavi VAPID
-- non servono → keys = '{}').

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform     text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS native_token text;

-- Indice per il lookup/pulizia per token nativo.
CREATE INDEX IF NOT EXISTS push_subscriptions_native_token_idx
  ON public.push_subscriptions (native_token)
  WHERE native_token IS NOT NULL;

-- Registrazione "atomica" del device token nativo per l'utente corrente, gemella
-- di register_push_subscription: un device (token) appartiene a UN solo utente
-- (l'ultimo che ha fatto login su quel dispositivo). SECURITY DEFINER perché la
-- RLS impedirebbe di cancellare la riga di un altro utente, ma usiamo auth.uid()
-- quindi ognuno registra solo sé stesso.
CREATE OR REPLACE FUNCTION public.register_native_push_subscription(p_token text, p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform text := COALESCE(NULLIF(p_platform, ''), 'ios');
  v_endpoint text := 'native:' || v_platform || ':' || p_token;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'missing token';
  END IF;

  -- Questo dispositivo da ora appartiene all'utente corrente: rimuovi eventuali
  -- registrazioni dello stesso token fatte da altri account.
  DELETE FROM public.push_subscriptions
    WHERE native_token = p_token OR endpoint = v_endpoint;

  INSERT INTO public.push_subscriptions (user_id, endpoint, keys, platform, native_token)
  VALUES (auth.uid(), v_endpoint, '{}'::jsonb, v_platform, p_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_native_push_subscription(text, text) TO authenticated;
