-- ============================================================
-- IST — P2 (parte 1/2): rubrica pubblica sicura per DM/chat
-- Idempotente. DA APPLICARE PRIMA del lockdown di profiles, così il
-- frontend (ripuntato a questa view) continua a funzionare.
--
-- Espone SOLO colonne non sensibili di TUTTI i profili, per:
--   • rubrica DM (id/name/role/avatar)
--   • avatar/nome autori dei messaggi in chat
--   • lookup nome coach/mental nella dashboard studente
--   • ricerca "primo admin" per l'upgrade
-- NON espone: email, status, tier, phase, assigned_*, permissions.
--
-- security_invoker=false (SECURITY DEFINER view): bypassa la RLS di profiles
-- e restituisce le colonne sicure a ogni autenticato. È intenzionale e sicuro
-- perché la SELECT list è limitata alle colonne non sensibili.
-- ============================================================

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
  SELECT id, name, role, roles, avatar_url, avatar_preset, created_at
  FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM anon, public;
GRANT SELECT ON public.profiles_public TO authenticated;
