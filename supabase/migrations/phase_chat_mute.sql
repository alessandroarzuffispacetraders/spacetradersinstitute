-- ============================================================
-- IST — Mute utenti nelle chat di GRUPPO (silenzia per X tempo)
-- Idempotente, re-runnable nel SQL Editor di Supabase.
--
-- Obiettivo:
--   • Admin e Coach possono silenziare un utente: per la durata scelta non può
--     più SCRIVERE in NESSUN canale di gruppo (né in bacheca). I DM restano
--     aperti (così può comunque contattare coach/admin) e la LETTURA resta.
--   • Regole "chi-muta-chi": l'admin può silenziare chiunque tranne sé stesso e
--     altri admin; il coach può silenziare SOLO gli studenti (non lo staff).
--   • Enforcement server-side reale: passa da may_post(), il choke-point già usato
--     dalla policy INSERT di messages e bacheca_posts. La UI è solo cosmetica.
-- ============================================================

-- ---------- 1) tabella dei mute (globale: 1 riga per utente) ----------
create table if not exists public.chat_mutes (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  muted_by    uuid references public.profiles(id) on delete set null,
  reason      text,
  muted_until timestamptz not null,           -- sempre a tempo ("per X tempo")
  created_at  timestamptz not null default now()
);

create index if not exists chat_mutes_until_idx on public.chat_mutes (muted_until);

-- RLS: l'utente vede il PROPRIO mute (per il banner), lo staff li vede tutti.
-- Nessuna policy di scrittura: le mutazioni passano SOLO dalle RPC (SECURITY DEFINER).
alter table public.chat_mutes enable row level security;
drop policy if exists "chat_mutes read" on public.chat_mutes;
create policy "chat_mutes read" on public.chat_mutes
  for select using (auth.uid() = user_id or public.is_staff());

-- Realtime: così il banner "sei silenziato" e lo stato lato staff reagiscono live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_mutes'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_mutes';
  end if;
end $$;

-- ---------- 2) helper ----------
-- Ruoli di un utente qualsiasi (generalizza my_roles() a un id passato): gestisce
-- sia profiles.role (singolo) sia profiles.roles (text[] o jsonb).
create or replace function public.roles_of(p_id uuid)
returns text[]
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    array(
      select distinct r from (
        select p.role as r from public.profiles p where p.id = p_id
        union
        select jsonb_array_elements_text(
          case when jsonb_typeof(to_jsonb(p.roles)) = 'array' then to_jsonb(p.roles) else '[]'::jsonb end
        )
        from public.profiles p where p.id = p_id
      ) s
      where r is not null and r <> ''
    ),
    '{}'::text[]
  );
$$;

-- Il caller è attualmente silenziato? (mute globale non scaduto)
create or replace function public.is_muted()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.chat_mutes m
    where m.user_id = auth.uid() and m.muted_until > now()
  );
$$;

-- ---------- 3) may_post: aggiunge il gate mute ----------
-- Copia ESATTA della versione live (phase_free_channels.sql) con UNA riga in più:
-- `if public.is_muted() then return false; end if;` inserita DOPO il bypass admin
-- e PRIMA del check can_post. Così: i DM escono prima (mute non li tocca), gli
-- admin sono immuni, e il mute blocca studenti/staff-non-admin nei gruppi+bacheca.
create or replace function public.may_post(p_channel_id text) returns boolean
  language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  v_can_post text[];
  v_a text; v_b text; v_other text;
begin
  if auth.uid() is null then return false; end if;
  if not (public.is_staff() or public.is_active_student()) then return false; end if;

  if left(p_channel_id, 3) = 'dm_' then
    v_a := split_part(substring(p_channel_id from 4), '_', 1);
    v_b := split_part(substring(p_channel_id from 4), '_', 2);
    if auth.uid()::text not in (v_a, v_b) then return false; end if;
    if public.is_free_user() then
      v_other := case when auth.uid()::text = v_a then v_b else v_a end;
      return exists (
        select 1 from public.profiles p
        where p.id = v_other::uuid
          and (p.role = 'admin' or p.roles::text ilike '%admin%')
      );
    end if;
    return true;
  end if;

  if public.is_admin() then return true; end if;

  -- 🔇 Mute: un utente silenziato non può scrivere nei canali di gruppo/bacheca.
  if public.is_muted() then return false; end if;

  select can_post into v_can_post from public.channels where id = p_channel_id;
  if v_can_post is null then return false; end if;

  return (public.my_audiences() && v_can_post);
end;
$function$;

-- ---------- 4) RPC: mute / unmute (solo admin o coach) ----------
-- Silenzia p_target per p_minutes minuti. Ritorna il timestamp di scadenza.
create or replace function public.mute_user(p_target uuid, p_minutes int, p_reason text default null)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_target_roles text[];
  v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (public.is_admin() or 'coach' = any(public.my_roles())) then
    raise exception 'forbidden: solo admin o coach possono silenziare';
  end if;
  if p_target = auth.uid() then raise exception 'non puoi silenziare te stesso'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 525600 then
    raise exception 'durata non valida';
  end if;

  v_target_roles := public.roles_of(p_target);
  if v_target_roles = '{}'::text[] then raise exception 'utente inesistente'; end if;
  if 'admin' = any(v_target_roles) then raise exception 'non puoi silenziare un admin'; end if;
  -- un coach (non admin) può silenziare SOLO gli studenti, mai lo staff
  if not public.is_admin() and (v_target_roles && array['admin','coach','mental_coach']::text[]) then
    raise exception 'un coach può silenziare solo gli studenti';
  end if;

  v_until := now() + make_interval(mins => p_minutes);

  insert into public.chat_mutes (user_id, muted_by, reason, muted_until)
  values (p_target, auth.uid(), nullif(btrim(p_reason), ''), v_until)
  on conflict (user_id) do update
    set muted_by = auth.uid(),
        reason = excluded.reason,
        muted_until = excluded.muted_until,
        created_at = now();

  return v_until;
end;
$$;

-- Rimuove il silenzio. Coach solo su studenti (coerente con mute_user).
create or replace function public.unmute_user(p_target uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_target_roles text[];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (public.is_admin() or 'coach' = any(public.my_roles())) then
    raise exception 'forbidden: solo admin o coach';
  end if;
  if not public.is_admin() then
    v_target_roles := public.roles_of(p_target);
    if v_target_roles && array['admin','coach','mental_coach']::text[] then
      raise exception 'un coach può gestire solo gli studenti';
    end if;
  end if;
  delete from public.chat_mutes where user_id = p_target;
end;
$$;

grant execute on function public.mute_user(uuid, int, text) to authenticated;
grant execute on function public.unmute_user(uuid) to authenticated;
