-- ============================================================
-- IST — Fase E2: statistiche admin via funzioni RPC
-- Idempotent, re-runnable nel SQL Editor di Supabase.
--
-- Perché RPC: diary_entries e lesson_progress sono RLS per-utente; l'admin NON
-- può leggerli tutti. Queste funzioni SECURITY DEFINER (guardate da is_admin())
-- calcolano gli aggregati lato DB e restituiscono SOLO numeri — niente righe
-- private esposte.
--
-- Scelta "essenziale": niente top-performer / engagement settimanale / retention.
-- Conteggio ruoli: to_jsonb(roles) ? 'coach' (preciso: 'coach' NON matcha
-- 'mental_coach', a differenza di ILIKE).
-- ============================================================

-- ---------- admin_dashboard(): contatori + distribuzione fase + attività recente ----------
CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.at DESC), '[]'::jsonb) INTO v_recent
  FROM (
    (SELECT 'student'::text AS type, name AS label, created_at AS at
       FROM public.profiles WHERE role = 'student' ORDER BY created_at DESC LIMIT 5)
    UNION ALL
    (SELECT 'course'::text AS type, title AS label, created_at AS at
       FROM public.courses WHERE published = true ORDER BY created_at DESC LIMIT 5)
  ) t;

  RETURN jsonb_build_object(
    'students_total',  (SELECT count(*) FROM public.profiles WHERE role = 'student'),
    'students_active', (SELECT count(*) FROM public.profiles WHERE role = 'student' AND status = 'active'),
    'coaches',         (SELECT count(*) FROM public.profiles WHERE role = 'coach' OR to_jsonb(roles) ? 'coach'),
    'mental_coaches',  (SELECT count(*) FROM public.profiles WHERE role = 'mental_coach' OR to_jsonb(roles) ? 'mental_coach'),
    'by_phase', jsonb_build_object(
      'onboarding', (SELECT count(*) FROM public.profiles WHERE role = 'student' AND phase = 'onboarding'),
      'build',      (SELECT count(*) FROM public.profiles WHERE role = 'student' AND phase = 'build'),
      'test',       (SELECT count(*) FROM public.profiles WHERE role = 'student' AND phase = 'test'),
      'deploy',     (SELECT count(*) FROM public.profiles WHERE role = 'student' AND phase = 'deploy')
    ),
    'recent', v_recent
  );
END;
$$;

-- ---------- admin_statistics(): stato, lezioni completate, completamento medio ----------
CREATE OR REPLACE FUNCTION public.admin_statistics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_lessons integer;
  v_avg numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_total_lessons FROM public.lessons WHERE published = true;

  IF v_total_lessons = 0 THEN
    v_avg := 0;
  ELSE
    -- media, sugli studenti, di (lezioni completate / lezioni pubblicate) * 100
    SELECT coalesce(round(avg(least(per.cnt, v_total_lessons)::numeric / v_total_lessons * 100)), 0)
    INTO v_avg
    FROM (
      SELECT pr.id, count(lp.lesson_id) FILTER (WHERE lp.completed) AS cnt
      FROM public.profiles pr
      LEFT JOIN public.lesson_progress lp ON lp.user_id = pr.id
      WHERE pr.role = 'student'
      GROUP BY pr.id
    ) per;
  END IF;

  RETURN jsonb_build_object(
    'by_status', jsonb_build_object(
      'active',  (SELECT count(*) FROM public.profiles WHERE role = 'student' AND status = 'active'),
      'expired', (SELECT count(*) FROM public.profiles WHERE role = 'student' AND status = 'expired'),
      'blocked', (SELECT count(*) FROM public.profiles WHERE role = 'student' AND status = 'blocked')
    ),
    'lessons_completed_total', (SELECT count(*) FROM public.lesson_progress WHERE completed = true),
    'avg_completion', v_avg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_statistics() TO authenticated;

-- ---------- verifica (opzionale) ----------
-- SELECT public.admin_dashboard();    -- come admin: jsonb; come non-admin: errore 'forbidden'
-- SELECT public.admin_statistics();
