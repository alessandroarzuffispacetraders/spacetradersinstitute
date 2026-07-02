-- ============================================================================
-- Access logs — registro accessi con geolocalizzazione IP per rilevare
-- la condivisione di account (accessi da città/paesi diversi).
-- Scrive SOLO la edge function `log-access` (service role). Legge solo l'admin.
-- ============================================================================

create table if not exists public.access_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  ip           text,
  city         text,
  region       text,
  country      text,
  country_code text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists access_logs_user_created_idx
  on public.access_logs (user_id, created_at desc);

alter table public.access_logs enable row level security;

-- Solo gli admin possono leggere. Nessuna policy insert/update/delete per i
-- client: la scrittura avviene esclusivamente via edge function (service role,
-- che bypassa la RLS).
drop policy if exists access_logs_admin_read on public.access_logs;
create policy access_logs_admin_read on public.access_logs
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Riepilogo aggregato per utente (una riga per utente con almeno un accesso).
-- SECURITY DEFINER perché deve leggere tutte le righe di tutti gli utenti;
-- protetta da is_admin() sul CHIAMANTE.
-- ---------------------------------------------------------------------------
create or replace function public.admin_access_summary()
returns table (
  user_id            uuid,
  logins             bigint,
  distinct_ips       bigint,
  distinct_cities    bigint,
  distinct_countries bigint,
  last_seen          timestamptz,
  places             text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    a.user_id,
    count(*)::bigint                                                                   as logins,
    count(distinct a.ip)::bigint                                                       as distinct_ips,
    count(distinct a.city) filter (where a.city is not null and a.city <> '')::bigint  as distinct_cities,
    count(distinct a.country) filter (where a.country is not null and a.country <> '')::bigint as distinct_countries,
    max(a.created_at)                                                                  as last_seen,
    (array_agg(distinct
        (a.city || case when coalesce(a.country,'') <> '' then ', ' || a.country else '' end))
        filter (where a.city is not null and a.city <> ''))                            as places
  from public.access_logs a
  group by a.user_id;
end;
$$;

grant execute on function public.admin_access_summary() to authenticated;
