-- ============================================================
-- IST — Live: copertina pronta alla creazione, broadcast in chat privata,
-- live e immagini negli annunci. Idempotente.
--
-- (1) cover_pool: scorta di copertine già pronte (grafici quant "fotografati",
--     versione scura + chiara), ognuna con un protagonista mai usato altrove.
--     claim_live_cover() ne assegna una non ancora usata alla live appena
--     creata (tema mente per il Mental Coach / argomenti della mente, trading
--     per il resto; tra quelle del tema sceglie quella con più tag nel titolo).
-- (2) broadcast_live_invite(): l'admin manda in chat privata la scheda della
--     live a tutti gli studenti attivi a cui è rivolta (audience della live).
-- (3) bacheca_posts: fino a 4 immagini per post + live collegata (scheda).
-- ============================================================

-- ---------- (1) scorta copertine ----------
create table if not exists public.cover_pool (
  id         uuid primary key default gen_random_uuid(),
  theme      text not null check (theme in ('trading', 'mind')),
  chart      text not null unique,
  tags       text[] not null default '{}',
  url_dark   text not null,
  url_light  text,
  used_kind  text,
  used_id    uuid,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cover_pool_free_idx on public.cover_pool (theme) where used_id is null;

alter table public.cover_pool enable row level security;
drop policy if exists cover_pool_staff_read on public.cover_pool;
create policy cover_pool_staff_read on public.cover_pool for select using (public.is_staff());
drop policy if exists cover_pool_admin_write on public.cover_pool;
create policy cover_pool_admin_write on public.cover_pool for all using (public.is_admin()) with check (public.is_admin());

-- Assegna una copertina della scorta alla live. p_force = true: ne assegna
-- un'altra anche se la live ne ha già una (pulsante "Cambia copertina"); la
-- precedente resta segnata come usata, così nessuna immagine si ripete.
create or replace function public.claim_live_cover(p_live_id uuid, p_keyword text default null, p_force boolean default false)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_live  public.live_events%rowtype;
  v_text  text;
  v_theme text;
  v_pick  public.cover_pool%rowtype;
  v_other boolean := false;
begin
  if not public.is_staff() then raise exception 'non autorizzato'; end if;
  select * into v_live from public.live_events where id = p_live_id;
  if not found then raise exception 'live non trovata'; end if;
  if not public.is_admin() and v_live.owner_id is distinct from auth.uid() then raise exception 'non autorizzato'; end if;
  if v_live.cover_url is not null and not p_force then
    return json_build_object('status', 'kept', 'cover_url', v_live.cover_url);
  end if;

  v_text := lower(coalesce(v_live.title, '') || ' ' || coalesce(v_live.description, ''));
  v_theme := case
    when v_live.host_role = 'mental_coach'
      or v_text ~ '\m(mental|mente\M|psicolog|emozion|dopamin|abitudin|comfort|stress|disciplin|ansia\M|paura\M|respir)'
    then 'mind' else 'trading' end;

  select * into v_pick from public.cover_pool
  where used_id is null and theme = v_theme
  order by (select count(*) from unnest(tags) t where strpos(v_text, t) > 0) desc, created_at, random()
  limit 1 for update skip locked;

  if not found then  -- scorta del tema finita: meglio una dell'altro tema che nessuna
    select * into v_pick from public.cover_pool where used_id is null
    order by created_at, random() limit 1 for update skip locked;
    v_other := found;
  end if;
  if v_pick.id is null then return json_build_object('status', 'empty'); end if;

  update public.cover_pool set used_kind = 'live', used_id = p_live_id, used_at = now() where id = v_pick.id;
  update public.live_events set
    cover_url = v_pick.url_dark, cover_url_light = v_pick.url_light,
    cover_keyword = coalesce(nullif(trim(p_keyword), ''), cover_keyword),
    cover_status = 'ready', cover_error = null, cover_updated_at = now()
  where id = p_live_id;

  return json_build_object(
    'status', case when v_other then 'other_theme' else 'ok' end,
    'cover_url', v_pick.url_dark, 'chart', v_pick.chart,
    'left', (select count(*) from public.cover_pool where used_id is null and theme = v_theme)
  );
end;
$$;
revoke all on function public.claim_live_cover(uuid, text, boolean) from public;
grant execute on function public.claim_live_cover(uuid, text, boolean) to authenticated;

-- ---------- (2) broadcast della live in chat privata ----------
alter table public.messages add column if not exists live_event_id uuid references public.live_events(id) on delete set null;

-- Un messaggio per ogni studente attivo nell'audience della live, nel DM tra
-- l'admin e lo studente (stesso id canale del client: 'dm_' + id ordinati).
-- Ritorna quanti messaggi sono partiti.
create or replace function public.broadcast_live_invite(p_live_id uuid, p_message text)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_live public.live_events%rowtype;
  v_me   uuid := auth.uid();
  v_name text;
  v_n    integer;
begin
  if not public.is_admin() then raise exception 'solo admin'; end if;
  select * into v_live from public.live_events where id = p_live_id;
  if not found then raise exception 'live non trovata'; end if;
  select name into v_name from public.profiles where id = v_me;

  insert into public.messages (channel_id, user_id, author_name, author_role, content, kind, target_user_id, live_event_id)
  select
    'dm_' || least(v_me::text collate "C", p.id::text collate "C") || '_' || greatest(v_me::text collate "C", p.id::text collate "C"),
    v_me, coalesce(v_name, 'Admin'), 'admin',
    coalesce(nullif(trim(p_message), ''), v_live.title),
    'live_invite', p.id, p_live_id
  from public.profiles p
  where p.id <> v_me
    and p.role = 'student'
    and p.status = 'active'
    and (
      v_live.audience = 'all'
      or (v_live.audience = 'free' and p.tier = 'free')
      or (v_live.audience = 'full' and coalesce(p.tier, 'full') <> 'free')
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.broadcast_live_invite(uuid, text) from public;
grant execute on function public.broadcast_live_invite(uuid, text) to authenticated;

-- ---------- (3) annunci: immagini + live collegata ----------
alter table public.bacheca_posts add column if not exists image_urls text[] not null default '{}';
alter table public.bacheca_posts add column if not exists live_event_id uuid references public.live_events(id) on delete set null;
do $$ begin
  alter table public.bacheca_posts add constraint bacheca_posts_max_images check (coalesce(array_length(image_urls, 1), 0) <= 4);
exception when duplicate_object then null; end $$;
