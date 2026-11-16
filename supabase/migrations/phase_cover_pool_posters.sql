-- ============================================================
-- IST — Copertine sempre nello stesso stile, versione scura + chiara,
-- anche per le locandine verticali delle sezioni. Idempotente.
--
-- La scorta (cover_pool, phase_live_share.sql) ha già copertine orizzontali
-- pronte per lezioni e live. Ogni voce ora può avere anche la LOCANDINA
-- verticale dello stesso grafico (poster_dark / poster_light), così anche la
-- locandina di una sezione nuova si prende dalla scorta invece di essere
-- disegnata da zero con un altro stile. Ogni grafico si usa una volta sola:
-- o come copertina o come locandina.
--
-- claim_category_poster(): come claim_lesson_cover / claim_live_cover, per le
-- sezioni (categories.poster_url / poster_url_light). Solo admin.
--
-- Tema «mente»: ora si cercano parole intere (\m … \M). Prima «mental» dentro
-- «Fundamentals» o «mente» dentro gli avverbi in -mente («semplicemente»)
-- facevano scegliere un'immagine del Mental Coach. Stessa correzione in
-- claim_lesson_cover (phase_video_share.sql) e claim_live_cover
-- (phase_live_share.sql), riapplicate il 16/11/2026.
-- ============================================================

alter table public.cover_pool add column if not exists poster_dark  text;
alter table public.cover_pool add column if not exists poster_light text;

create or replace function public.claim_category_poster(p_category_id uuid, p_force boolean default false)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_cat   public.categories%rowtype;
  v_text  text;
  v_theme text;
  v_pick  public.cover_pool%rowtype;
  v_other boolean := false;
begin
  if not public.is_admin() then raise exception 'non autorizzato'; end if;
  select * into v_cat from public.categories where id = p_category_id;
  if not found then raise exception 'sezione non trovata'; end if;
  if v_cat.poster_url is not null and not p_force then
    return json_build_object('status', 'kept', 'cover_url', v_cat.poster_url);
  end if;

  v_text := lower(coalesce(v_cat.title, '') || ' ' || coalesce(v_cat.description, ''));
  v_theme := case
    when v_cat.section = 'mental'
      or v_text ~ '\m(mental|mente\M|psicolog|emozion|dopamin|abitudin|comfort|stress|disciplin|ansia\M|paura\M|respir)'
    then 'mind' else 'trading' end;

  select * into v_pick from public.cover_pool
  where used_id is null and theme = v_theme and poster_dark is not null
  order by (select count(*) from unnest(tags) t where strpos(v_text, t) > 0) desc, created_at, random()
  limit 1 for update skip locked;

  if not found then  -- locandine del tema finite: meglio una dell'altro tema che nessuna
    select * into v_pick from public.cover_pool where used_id is null and poster_dark is not null
    order by created_at, random() limit 1 for update skip locked;
    v_other := found;
  end if;
  if v_pick.id is null then return json_build_object('status', 'empty'); end if;

  update public.cover_pool set used_kind = 'category', used_id = p_category_id, used_at = now() where id = v_pick.id;
  update public.categories set
    poster_url = v_pick.poster_dark, poster_url_light = v_pick.poster_light,
    poster_status = 'ready', poster_error = null, poster_updated_at = now()
  where id = p_category_id;

  return json_build_object(
    'status', case when v_other then 'other_theme' else 'ok' end,
    'cover_url', v_pick.poster_dark, 'chart', v_pick.chart,
    'left', (select count(*) from public.cover_pool where used_id is null and theme = v_theme and poster_dark is not null)
  );
end;
$$;
revoke all on function public.claim_category_poster(uuid, boolean) from public;
grant execute on function public.claim_category_poster(uuid, boolean) to authenticated;
