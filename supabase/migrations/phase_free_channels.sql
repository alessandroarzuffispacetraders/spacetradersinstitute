-- Pubblico "free" come AUDIENCE distinta nei canali chat.
-- Prima: `roles` conteneva i ruoli + un flag booleano `free` ("anche i gratuiti
-- lo vedono sì/no"). Non permetteva canali riservati SOLO ai free (i paganti li
-- vedevano comunque). Ora: lo studente gratuito conta come audience 'free', il
-- pagante come 'student'; così roles=['free'] = visibile solo ai free.

-- my_audiences(): free → ['free']; pagante → ['student']; staff → i propri ruoli.
create or replace function public.my_audiences() returns text[]
  language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select case
    when public.is_free_user() then array['free']::text[]
    else public.my_roles()
  end;
$$;

-- Migrazione dati: preserva ESATTAMENTE la visibilità attuale. I canali visibili
-- ai free (free=true) ricevono 'free' tra i roles; se i free potevano anche
-- scrivere ('student' in can_post) ricevono 'free' pure in can_post.
update public.channels
  set roles = array_append(roles, 'free')
  where free = true and not ('free' = any(roles));

update public.channels
  set can_post = array_append(can_post, 'free')
  where free = true and ('student' = any(can_post)) and not ('free' = any(can_post));

-- Visibilità canali per audience (via la stessa logica di overlap, niente più
-- clausola separata sul flag booleano `free`).
drop policy if exists "channels read by role" on public.channels;
create policy "channels read by role" on public.channels
  for select using (
    public.is_admin()
    or ((public.is_staff() or public.is_active_student()) and (public.my_audiences() && roles))
  );

-- Bacheca: stessa logica per audience (prima usava my_roles(), che non conosce
-- il pubblico 'free' → un free non avrebbe letto la bacheca del proprio canale).
drop policy if exists "bacheca_read" on public.bacheca_posts;
create policy "bacheca_read" on public.bacheca_posts
  for select using (
    (public.is_staff() or public.is_active_student())
    and exists (
      select 1 from public.channels c
      where c.id = bacheca_posts.channel_id and (c.roles && public.my_audiences())
    )
  );

-- may_post: permesso di scrittura per audience (DM invariato: il free scrive in
-- DM solo agli admin).
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

  select can_post into v_can_post from public.channels where id = p_channel_id;
  if v_can_post is null then return false; end if;

  return (public.my_audiences() && v_can_post);
end;
$function$;
