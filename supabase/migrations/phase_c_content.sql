-- ============================================================
-- PHASE C — CONTENT / VIDEOCORSI — Consolidated, idempotent migration
-- Run in Supabase SQL Editor. Safe to re-run.
-- Tables: categories -> courses -> lessons -> attachments  (+ lesson_progress)
-- Convention: student/user FKs -> public.profiles(id); cascades from auth.users.
-- Video/attachment bytes live on Cloudflare R2 (private bucket); rows store only
-- the R2 object_key. Presigned URLs are minted by edge functions in Phase C4.
-- ============================================================

-- ---------- shared helpers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- is_admin(): true for primary-role admins AND multi-role admins. SECURITY
-- DEFINER so policies can read profiles regardless of the caller's RLS.
-- The roles check uses ::text so it works whether `roles` is text[] ('{admin}')
-- or jsonb ('["admin"]') — safe given the fixed role vocabulary
-- (student/coach/mental_coach/admin), none of which contains 'admin' as a
-- substring except 'admin' itself.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.roles::text ILIKE '%admin%')
  );
$$;

-- ============================================================
-- 1) CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  accent      text NOT NULL DEFAULT '#7CBBD0',
  phase       text NOT NULL DEFAULT 'build' CHECK (phase IN ('onboarding','build','test','deploy')),
  position    integer NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_position_idx  ON public.categories (position);
CREATE INDEX IF NOT EXISTS categories_published_idx ON public.categories (published);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories read published or admin" ON public.categories;
CREATE POLICY "categories read published or admin" ON public.categories
  FOR SELECT USING (published = true OR public.is_admin());

DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2) COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  phase       text NOT NULL DEFAULT 'build' CHECK (phase IN ('onboarding','build','test','deploy')),
  position    integer NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courses_category_idx  ON public.courses (category_id);
CREATE INDEX IF NOT EXISTS courses_position_idx  ON public.courses (category_id, position);
CREATE INDEX IF NOT EXISTS courses_published_idx ON public.courses (published);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses read published or admin" ON public.courses;
CREATE POLICY "courses read published or admin" ON public.courses
  FOR SELECT USING (published = true OR public.is_admin());

DROP POLICY IF EXISTS "courses admin write" ON public.courses;
CREATE POLICY "courses admin write" ON public.courses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3) LESSONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lessons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0,
  video_key        text,            -- R2 object key; NULL until a video is uploaded
  position         integer NOT NULL DEFAULT 0,
  published        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lessons_course_idx    ON public.lessons (course_id);
CREATE INDEX IF NOT EXISTS lessons_position_idx  ON public.lessons (course_id, position);
CREATE INDEX IF NOT EXISTS lessons_published_idx ON public.lessons (published);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lessons read published or admin" ON public.lessons;
CREATE POLICY "lessons read published or admin" ON public.lessons
  FOR SELECT USING (published = true OR public.is_admin());

DROP POLICY IF EXISTS "lessons admin write" ON public.lessons;
CREATE POLICY "lessons admin write" ON public.lessons
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_lessons_updated_at ON public.lessons;
CREATE TRIGGER trg_lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4) ATTACHMENTS (lesson materials: pdf/xlsx/docx/pptx/zip)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'pdf' CHECK (type IN ('pdf','xlsx','docx','pptx','zip')),
  size_bytes  bigint NOT NULL DEFAULT 0,
  object_key  text,            -- R2 object key; NULL until the file is uploaded
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_lesson_idx   ON public.attachments (lesson_id);
CREATE INDEX IF NOT EXISTS attachments_position_idx ON public.attachments (lesson_id, position);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Attachments have no own published flag: visible if the parent lesson is
-- published (or to an admin).
DROP POLICY IF EXISTS "attachments read via lesson" ON public.attachments;
CREATE POLICY "attachments read via lesson" ON public.attachments
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.lessons l
               WHERE l.id = attachments.lesson_id AND l.published = true)
  );

DROP POLICY IF EXISTS "attachments admin write" ON public.attachments;
CREATE POLICY "attachments admin write" ON public.attachments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 5) LESSON PROGRESS (per student, per lesson) — replaces mock `done`
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id             uuid NOT NULL REFERENCES public.lessons(id)  ON DELETE CASCADE,
  completed             boolean NOT NULL DEFAULT false,
  completed_at          timestamptz,
  last_position_seconds integer NOT NULL DEFAULT 0,   -- resume point ("Riprendi da")
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_user_idx   ON public.lesson_progress (user_id);
CREATE INDEX IF NOT EXISTS lesson_progress_lesson_idx ON public.lesson_progress (lesson_id);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Student: full control over own rows.
DROP POLICY IF EXISTS "progress student select own" ON public.lesson_progress;
CREATE POLICY "progress student select own" ON public.lesson_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress student insert own" ON public.lesson_progress;
CREATE POLICY "progress student insert own" ON public.lesson_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress student update own" ON public.lesson_progress;
CREATE POLICY "progress student update own" ON public.lesson_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Coach / mental coach: read progress of their assigned students (mirrors
-- the exercise_submissions pattern).
DROP POLICY IF EXISTS "progress staff read assigned" ON public.lesson_progress;
CREATE POLICY "progress staff read assigned" ON public.lesson_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles s
            WHERE s.id = lesson_progress.user_id
              AND (s.assigned_coach_id = auth.uid()
                   OR s.assigned_mental_coach_id = auth.uid()))
  );

-- Admin: read all.
DROP POLICY IF EXISTS "progress admin read all" ON public.lesson_progress;
CREATE POLICY "progress admin read all" ON public.lesson_progress
  FOR SELECT USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER trg_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6) SEED — reproduce the current mock catalog so the app is not empty.
-- Runs ONLY when categories is empty. Attachments get NULL object_key
-- (no real files yet; download is wired up in Phase C4).
-- ============================================================
DO $$
DECLARE
  seed jsonb := $seed$
  [
    {
      "title": "Fondamenta del Trading",
      "description": "Dai mercati finanziari alla lettura dei grafici: le basi per iniziare con il piede giusto.",
      "accent": "#7CBBD0", "phase": "build", "published": true,
      "courses": [
        {
          "title": "Modulo 1 — Introduzione ai mercati",
          "description": "I fondamentali del mercato Forex, struttura e partecipanti.",
          "phase": "build", "published": true,
          "lessons": [
            { "title": "Introduzione ai mercati finanziari", "description": "Una panoramica completa sui principali mercati: Forex, equity, futures e CFD. Capirai chi sono i partecipanti, come si muovono i prezzi e perché il mercato è il miglior maestro.", "minutes": 18,
              "attachments": [ { "name": "Slide introduzione mercati.pdf", "type": "pdf", "size_bytes": 2400000 } ] },
            { "title": "Struttura del mercato Forex", "description": "Come funziona il mercato Forex: sessioni, liquidità, spread e slippage. Imparerai a riconoscere le ore di maggiore volatilità e come sfruttarle.", "minutes": 24,
              "attachments": [ { "name": "Struttura Forex — Riepilogo.pdf", "type": "pdf", "size_bytes": 1800000 }, { "name": "Sessioni di trading.xlsx", "type": "xlsx", "size_bytes": 420000 } ] },
            { "title": "Come leggere un grafico", "description": "Candlestick, barre, linee: capire il linguaggio universale dei grafici. Dal timeframe M1 al Monthly, ogni scala ha il suo scopo.", "minutes": 31,
              "attachments": [ { "name": "Guida ai grafici.pdf", "type": "pdf", "size_bytes": 3100000 } ] },
            { "title": "Sessione domande e risposte", "description": "Risposta alle domande più frequenti dei nuovi trader. Un momento di consolidamento prima di passare al modulo successivo.", "minutes": 45, "attachments": [] }
          ]
        },
        {
          "title": "Modulo 2 — Analisi Tecnica",
          "description": "Pattern candlestick, indicatori e setup multi-timeframe per operare con precisione.",
          "phase": "build", "published": true,
          "lessons": [
            { "title": "Pattern candlestick fondamentali", "description": "I 12 pattern candlestick più importanti e come riconoscerli in real-time sul grafico.", "minutes": 27,
              "attachments": [ { "name": "Catalogo pattern completo.pdf", "type": "pdf", "size_bytes": 5200000 } ] },
            { "title": "Supporti e resistenze", "description": "Come identificare e usare i livelli chiave del grafico per entry e exit precisi.", "minutes": 22, "attachments": [] },
            { "title": "Indicatori tecnici — RSI & MACD", "description": "Configurazione, lettura e utilizzo pratico di RSI e MACD nel trading operativo.", "minutes": 35,
              "attachments": [ { "name": "RSI MACD cheatsheet.pdf", "type": "pdf", "size_bytes": 890000 } ] },
            { "title": "Setup multi-timeframe", "description": "Come allineare i timeframe per confluenza e precision entry. Il segreto dei trader professionisti.", "minutes": 41, "attachments": [] }
          ]
        }
      ]
    },
    {
      "title": "Risk & Psychology",
      "description": "Gestione del rischio e psicologia del trader per performance consistente nel tempo.",
      "accent": "#46D39A", "phase": "build", "published": true,
      "courses": [
        {
          "title": "Modulo 3 — Risk Management",
          "description": "Position sizing, stop loss, drawdown e protezione del capitale.",
          "phase": "build", "published": true,
          "lessons": [
            { "title": "I principi del risk management", "description": "Perché il risk management è la skill più importante per un trader. Il denaro che non perdi è il denaro che guadagni.", "minutes": 19,
              "attachments": [ { "name": "Risk Management Handbook.pdf", "type": "pdf", "size_bytes": 4100000 } ] },
            { "title": "Position sizing e leva", "description": "Come calcolare la dimensione corretta della posizione in base al rischio e alla size del conto.", "minutes": 28,
              "attachments": [ { "name": "Position Size Calculator.xlsx", "type": "xlsx", "size_bytes": 180000 } ] },
            { "title": "Stop loss e take profit", "description": "Dove posizionare SL e TP per massimizzare il risk/reward in ogni condizione di mercato.", "minutes": 23, "attachments": [] }
          ]
        },
        {
          "title": "Modulo 4 — Psicologia del Trading",
          "description": "Bias cognitivi, routine e journaling per costruire un mindset da trader professionista.",
          "phase": "build", "published": true,
          "lessons": [
            { "title": "Bias cognitivi nel trading", "description": "I 10 bias più pericolosi per i trader e le tecniche concrete per neutralizzarli.", "minutes": 33,
              "attachments": [ { "name": "Mappa bias cognitivi.pdf", "type": "pdf", "size_bytes": 2700000 } ] },
            { "title": "Routine del trader professionista", "description": "Pre-market, intraday e post-market: come costruire e mantenere una routine vincente.", "minutes": 21, "attachments": [] },
            { "title": "Journaling e auto-analisi", "description": "Come tenere un trading journal efficace per migliorare sistematicamente nel tempo.", "minutes": 26,
              "attachments": [ { "name": "Trading Journal Template.xlsx", "type": "xlsx", "size_bytes": 240000 } ] }
          ]
        }
      ]
    },
    {
      "title": "Advanced Strategies",
      "description": "Setup avanzati, order flow e strategie istituzionali per trader in fase Test e Deploy.",
      "accent": "#F6C85F", "phase": "test", "published": true,
      "courses": [
        {
          "title": "Modulo 5 — Setup Avanzati",
          "description": "Order flow, volumi e strategia istituzionale: il trading come fanno le grandi mani.",
          "phase": "test", "published": true,
          "lessons": [
            { "title": "Order Flow Analysis", "description": "Come leggere il book di negoziazione, il volume delta e il footprint chart per anticipare i movimenti.", "minutes": 48, "attachments": [] },
            { "title": "Smart Money Concepts", "description": "La logica istituzionale: BOS, CHoCH, liquidity hunt e order blocks. Come seguire le grandi mani.", "minutes": 55,
              "attachments": [ { "name": "SMC Reference Guide.pdf", "type": "pdf", "size_bytes": 8300000 } ] },
            { "title": "Backtest e forward test", "description": "Come validare una strategia in modo statisticamente rigoroso prima di metterla live.", "minutes": 39,
              "attachments": [ { "name": "Backtest Spreadsheet.xlsx", "type": "xlsx", "size_bytes": 520000 }, { "name": "Forward Test Log.xlsx", "type": "xlsx", "size_bytes": 320000 } ] }
          ]
        },
        {
          "title": "Modulo 6 — Automazione",
          "description": "Introduzione alle strategie algoritmiche con Pine Script su TradingView.",
          "phase": "deploy", "published": false,
          "lessons": [
            { "title": "Introduzione a Pine Script", "description": "Come scrivere indicatori custom su TradingView partendo da zero.", "minutes": 44, "attachments": [] },
            { "title": "Automatizzare il journaling", "description": "Export automatico dei trade e integrazione con Google Sheets per un journal sempre aggiornato.", "minutes": 31, "attachments": [] }
          ]
        }
      ]
    }
  ]
  $seed$::jsonb;
  cat jsonb; crs jsonb; les jsonb; att jsonb;
  cat_id uuid; crs_id uuid; les_id uuid;
  cat_pos int := 0; crs_pos int; les_pos int; att_pos int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.categories) THEN
    RAISE NOTICE 'categories not empty — skipping seed';
    RETURN;
  END IF;

  FOR cat IN SELECT * FROM jsonb_array_elements(seed) LOOP
    cat_id := gen_random_uuid();
    INSERT INTO public.categories (id, title, description, accent, phase, position, published)
      VALUES (cat_id, cat->>'title', cat->>'description', cat->>'accent', cat->>'phase', cat_pos, (cat->>'published')::boolean);
    cat_pos := cat_pos + 1;

    crs_pos := 0;
    FOR crs IN SELECT * FROM jsonb_array_elements(cat->'courses') LOOP
      crs_id := gen_random_uuid();
      INSERT INTO public.courses (id, category_id, title, description, phase, position, published)
        VALUES (crs_id, cat_id, crs->>'title', crs->>'description', crs->>'phase', crs_pos, (crs->>'published')::boolean);
      crs_pos := crs_pos + 1;

      les_pos := 0;
      FOR les IN SELECT * FROM jsonb_array_elements(crs->'lessons') LOOP
        les_id := gen_random_uuid();
        INSERT INTO public.lessons (id, course_id, title, description, duration_seconds, position, published)
          VALUES (les_id, crs_id, les->>'title', les->>'description', (les->>'minutes')::int * 60, les_pos, true);
        les_pos := les_pos + 1;

        att_pos := 0;
        FOR att IN SELECT * FROM jsonb_array_elements(COALESCE(les->'attachments', '[]'::jsonb)) LOOP
          INSERT INTO public.attachments (id, lesson_id, name, type, size_bytes, object_key, position)
            VALUES (gen_random_uuid(), les_id, att->>'name', att->>'type', (att->>'size_bytes')::bigint, NULL, att_pos);
          att_pos := att_pos + 1;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Phase C seed inserted';
END $$;

-- ============================================================
-- 7) Verification (optional)
-- ============================================================
-- SELECT
--   (SELECT count(*) FROM public.categories)  AS categories,
--   (SELECT count(*) FROM public.courses)      AS courses,
--   (SELECT count(*) FROM public.lessons)      AS lessons,
--   (SELECT count(*) FROM public.attachments)  AS attachments;
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename IN ('categories','courses','lessons','attachments','lesson_progress')
--   ORDER BY tablename, cmd;
