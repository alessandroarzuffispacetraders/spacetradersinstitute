-- ============================================================
-- IST — Impostazioni globali dell'app (key/value, gestite dall'admin)
-- Idempotent. Es. 'welcome_video_url' = link del video di benvenuto.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Lettura per tutti gli autenticati; scrittura solo admin.
DROP POLICY IF EXISTS "app_settings read" ON public.app_settings;
CREATE POLICY "app_settings read" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "app_settings admin write" ON public.app_settings;
CREATE POLICY "app_settings admin write" ON public.app_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
