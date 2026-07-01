-- ============================================================
-- IST — Onboarding: flag "tour già proposto"
-- Idempotent. Serve per far partire il tour AUTOMATICAMENTE al primo accesso
-- una sola volta; se non viene completato resta il reminder nei "Primi passi".
-- ============================================================
ALTER TABLE public.student_onboarding
  ADD COLUMN IF NOT EXISTS tutorial_prompted boolean NOT NULL DEFAULT false;
