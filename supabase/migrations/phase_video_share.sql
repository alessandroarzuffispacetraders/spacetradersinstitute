-- ============================================================
-- IST — Video in chat + copertina automatica dei nuovi video. Idempotente.
--
-- (1) messages.lesson_id: admin e coach allegano in chat un video del
--     percorso; il messaggio ('video_share') mostra la scheda del video e
--     porta lo studente alla pagina della lezione. Solo lo staff può
--     allegare un video (policy restrittiva sull'inserimento).
-- (2) claim_lesson_cover(): come per le live, un video appena pubblicato
--     prende dalla scorta (cover_pool) una copertina mai usata, del tema
--     giusto (mente per la sezione Mental Coach o argomenti della mente,
--     trading per il resto; tra quelle del tema la più adatta al titolo).
-- ============================================================

-- ---------- (1) video allegato a un messaggio ----------
alter table public.messages add column if not exists lesson_id uuid references public.lessons(id) on delete set null;

drop policy if exists "video share staff only" on public.messages;
create policy "video share staff only" on public.messages
  as restrictive for insert
  with check (lesson_id is null or public.is_staff());

-- ---------- (2) copertina dalla scorta per un video ----------
create or replace function public.claim_lesson_cover(p_lesson_id uuid, p_keyword text default null, p_force boolean default false)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_lesson  public.lessons%rowtype;
  v_section text;
  v_text    text;
  v_theme   text;
  v_pick    public.cover_pool%rowtype;
  v_other   boolean := false;
begin
  if not public.is_admin() then raise exception 'non autorizzato'; end if;
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then raise exception 'video non trovato'; end if;
  if v_lesson.cover_url is not null and not p_force then
    return json_build_object('status', 'kept', 'cover_url', v_lesson.cover_url);
  end if;

  select cat.section into v_section
  from public.courses c join public.categories cat on cat.id = c.category_id
  where c.id = v_lesson.course_id;

  v_text := lower(coalesce(v_lesson.title, '') || ' ' || coalesce(v_lesson.description, ''));
  v_theme := case
    when v_section = 'mental'
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

  update public.cover_pool set used_kind = 'lesson', used_id = p_lesson_id, used_at = now() where id = v_pick.id;
  update public.lessons set
    cover_url = v_pick.url_dark, cover_url_light = v_pick.url_light,
    cover_keyword = coalesce(nullif(trim(p_keyword), ''), cover_keyword),
    cover_status = 'ready', cover_error = null, cover_updated_at = now()
  where id = p_lesson_id;

  return json_build_object(
    'status', case when v_other then 'other_theme' else 'ok' end,
    'cover_url', v_pick.url_dark, 'chart', v_pick.chart,
    'left', (select count(*) from public.cover_pool where used_id is null and theme = v_theme)
  );
end;
$$;
revoke all on function public.claim_lesson_cover(uuid, text, boolean) from public;
grant execute on function public.claim_lesson_cover(uuid, text, boolean) to authenticated;
