-- ============================================================
-- IST — Grafici admin: andamento iscrizioni/completamenti (ultimi 12 mesi)
-- + split tier (paganti/gratuiti). RPC SECURITY DEFINER guardata da is_admin()
-- (profiles/lesson_progress sono RLS per-utente: l'admin legge solo aggregati).
-- Idempotente, re-runnable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_charts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_signups jsonb;
  v_completions jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Iscrizioni studenti per mese (ultimi 12, mesi vuoti inclusi).
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS ym, d AS m
    FROM generate_series(date_trunc('month', now()) - interval '11 months',
                         date_trunc('month', now()), interval '1 month') d
  ),
  su AS (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS ym, count(*) AS c
    FROM public.profiles
    WHERE role = 'student' AND created_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('month', months.ym, 'count', coalesce(su.c, 0)) ORDER BY months.m), '[]'::jsonb)
  INTO v_signups
  FROM months LEFT JOIN su ON su.ym = months.ym;

  -- Lezioni completate per mese (ultimi 12).
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS ym, d AS m
    FROM generate_series(date_trunc('month', now()) - interval '11 months',
                         date_trunc('month', now()), interval '1 month') d
  ),
  cp AS (
    SELECT to_char(date_trunc('month', completed_at), 'YYYY-MM') AS ym, count(*) AS c
    FROM public.lesson_progress
    WHERE completed = true AND completed_at IS NOT NULL
      AND completed_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('month', months.ym, 'count', coalesce(cp.c, 0)) ORDER BY months.m), '[]'::jsonb)
  INTO v_completions
  FROM months LEFT JOIN cp ON cp.ym = months.ym;

  RETURN jsonb_build_object(
    'signups', v_signups,
    'completions', v_completions,
    'tier', jsonb_build_object(
      'full', (SELECT count(*) FROM public.profiles WHERE role = 'student' AND (tier IS NULL OR tier = 'full')),
      'free', (SELECT count(*) FROM public.profiles WHERE role = 'student' AND tier = 'free')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_charts() TO authenticated;
