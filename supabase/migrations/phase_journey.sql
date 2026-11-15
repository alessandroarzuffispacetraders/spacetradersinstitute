-- ============================================================
-- IST — Percorso interattivo. Idempotente.
-- Il percorso si costruisce da solo (video visti, sessioni col Mental Coach);
-- le attività che non sono video (es. «VPS») e «video di benvenuto visto» le
-- segna lo studente stesso: può scrivere i propri passi in path_steps.
-- (Coach assegnato e admin restano abilitati come prima.)
-- ============================================================
drop policy if exists "path_steps self write" on public.path_steps;
create policy "path_steps self write" on public.path_steps
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
