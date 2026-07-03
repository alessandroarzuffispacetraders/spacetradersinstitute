-- FIX SICUREZZA: il trigger anti-escalation su profiles non proteggeva la
-- colonna `tier` (aggiunta col free tier). Senza questo, un utente gratuito
-- poteva `update profiles set tier='full' where id = auth.uid()` e sbloccarsi
-- corso completo + community. Aggiunge `tier` ai campi bloccati (studente e coach).
-- Idempotente.
begin;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Service role (no JWT) e admin possono cambiare tutto.
  IF auth.uid() IS NULL OR COALESCE(public.get_my_role(), '') = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Coach assegnato a questo studente: può cambiare SOLO `phase`.
  IF OLD.assigned_coach_id = auth.uid() THEN
    IF NEW.id                       IS DISTINCT FROM OLD.id
       OR NEW.role                  IS DISTINCT FROM OLD.role
       OR NEW.roles                 IS DISTINCT FROM OLD.roles
       OR NEW.status                IS DISTINCT FROM OLD.status
       OR NEW.tier                  IS DISTINCT FROM OLD.tier
       OR NEW.permissions           IS DISTINCT FROM OLD.permissions
       OR NEW.assigned_coach_id     IS DISTINCT FROM OLD.assigned_coach_id
       OR NEW.assigned_mental_coach_id IS DISTINCT FROM OLD.assigned_mental_coach_id THEN
      RAISE EXCEPTION 'Il coach puo modificare solo la fase del proprio studente';
    END IF;
    RETURN NEW;  -- solo phase è cambiata: ok
  END IF;

  -- Chiunque altro (lo studente stesso, ecc.): blocca tutti i campi sensibili.
  IF NEW.id                       IS DISTINCT FROM OLD.id
     OR NEW.role                  IS DISTINCT FROM OLD.role
     OR NEW.roles                 IS DISTINCT FROM OLD.roles
     OR NEW.status                IS DISTINCT FROM OLD.status
     OR NEW.phase                 IS DISTINCT FROM OLD.phase
     OR NEW.tier                  IS DISTINCT FROM OLD.tier
     OR NEW.permissions           IS DISTINCT FROM OLD.permissions
     OR NEW.assigned_coach_id     IS DISTINCT FROM OLD.assigned_coach_id
     OR NEW.assigned_mental_coach_id IS DISTINCT FROM OLD.assigned_mental_coach_id THEN
    RAISE EXCEPTION 'Solo un admin puo cambiare id/ruolo/stato/fase/tier/permessi/assegnazioni';
  END IF;

  RETURN NEW;
END;
$function$;

commit;
