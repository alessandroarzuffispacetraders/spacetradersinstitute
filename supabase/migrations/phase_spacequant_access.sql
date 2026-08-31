-- ============================================================
-- IST — SpaceQuant: accesso ristretto (beta manuale, non più legato al tier)
-- Idempotente, ri-eseguibile.
--
-- La sezione parte visibile SOLO all'admin + a chi l'admin abilita
-- esplicitamente (richiesta utente 31 ago): non è più "tutti i paganti".
-- ============================================================

create table if not exists public.spacequant_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id)
);

alter table public.spacequant_access enable row level security;

drop policy if exists spacequant_access_admin_all on public.spacequant_access;
create policy spacequant_access_admin_all on public.spacequant_access
  for all using (public.is_admin()) with check (public.is_admin());
-- Nessuna policy per utenti non-admin: l'accesso si verifica via la RPC
-- sotto (security definer), non con una lettura diretta della tabella.

create or replace function public.spacequant_has_access()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_admin() or exists (
    select 1 from public.spacequant_access where user_id = auth.uid()
  );
$$;

grant execute on function public.spacequant_has_access() to authenticated;
