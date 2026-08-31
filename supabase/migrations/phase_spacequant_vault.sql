-- ============================================================
-- IST — SpaceQuant: grafo di conoscenza + chat AI sul manuale
-- Idempotente, ri-eseguibile.
--
-- Vincolo di prodotto: il testo delle note del vault non deve MAI
-- raggiungere il client. Solo le edge function (service role) leggono
-- il bucket qui sotto; nessuna CREATE POLICY di SELECT viene aggiunta
-- per esso — con RLS abilitata su storage.objects (default Supabase),
-- questo significa deny-by-default per chiunque tranne service_role
-- (verificato: service_role ha BYPASSRLS=true, authenticated/anon no).
-- ============================================================

-- ── Bucket privato del vault — ZERO policy di lettura per i client ────────────
insert into storage.buckets (id, name, public)
values ('spacequant-vault', 'spacequant-vault', false)
on conflict (id) do nothing;

-- ── Tabella eventi di utilizzo (append-only, stesso pattern di access_logs) ───
-- Serve sia la finestra "mese corrente" (quota) sia "ultimo minuto" (rate-limit)
-- con lo stesso indice, senza bisogno di un reset schedulato a fine mese.
create table if not exists public.spacequant_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists spacequant_usage_user_created_idx
  on public.spacequant_usage (user_id, created_at desc);

alter table public.spacequant_usage enable row level security;

drop policy if exists spacequant_usage_admin_read on public.spacequant_usage;
create policy spacequant_usage_admin_read on public.spacequant_usage
  for select using (public.is_admin());
-- Nessuna insert/update/delete policy per client: scrivono SOLO le RPC sotto.

-- ── RPC di sola lettura: quota residua (chiamabile dal client) ────────────────
-- Riusa public.app_settings (key/value testo) così il tetto è modificabile da
-- admin senza nuova migrazione. Default 30 se la chiave non è impostata.
create or replace function public.spacequant_quota_restante()
returns int
language sql stable security definer set search_path = public, pg_temp
as $$
  select greatest(0,
    coalesce((select value::int from public.app_settings where key = 'spacequant_monthly_quota'), 30)
    - (select count(*)::int from public.spacequant_usage
         where user_id = auth.uid() and created_at >= date_trunc('month', now()))
  );
$$;

grant execute on function public.spacequant_quota_restante() to authenticated;

-- ── RPC atomica di consumo (SOLO service role) ────────────────────────────────
-- Prende p_user_id come parametro (non auth.uid()): per questo l'EXECUTE va
-- revocato esplicitamente da PUBLIC, altrimenti un client autenticato potrebbe
-- consumare la quota di un altro utente passandone l'id.
create or replace function public.spacequant_try_consume(p_user_id uuid)
returns table (allowed boolean, quota_restante int, motivo text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_limit int := coalesce((select value::int from public.app_settings where key = 'spacequant_monthly_quota'), 30);
  v_month_count int;
  v_minute_count int;
begin
  -- Serializza le richieste concorrenti dello STESSO utente (niente doppio
  -- consumo se il client spara due richieste quasi in parallelo).
  perform pg_advisory_xact_lock(hashtext('spacequant:' || p_user_id::text));

  v_minute_count := (select count(*) from public.spacequant_usage
                      where user_id = p_user_id and created_at >= now() - interval '1 minute');
  if v_minute_count >= 5 then
    return query select false,
      greatest(0, v_limit - (select count(*)::int from public.spacequant_usage
                              where user_id = p_user_id and created_at >= date_trunc('month', now()))),
      'rate_limit'::text;
    return;
  end if;

  v_month_count := (select count(*) from public.spacequant_usage
                     where user_id = p_user_id and created_at >= date_trunc('month', now()));
  if v_month_count >= v_limit then
    return query select false, 0, 'quota_esaurita'::text;
    return;
  end if;

  insert into public.spacequant_usage (user_id) values (p_user_id);
  return query select true, (v_limit - v_month_count - 1), null::text;
end;
$$;

-- ATTENZIONE: in questo progetto Supabase le default privileges dello schema
-- public concedono EXECUTE direttamente ai ruoli anon/authenticated (non solo
-- a PUBLIC) per ogni nuova funzione — un semplice "REVOKE ... FROM PUBLIC" non
-- basta e lascia la funzione chiamabile da qualsiasi client. Vanno revocati
-- esplicitamente anche i ruoli nominati.
revoke execute on function public.spacequant_try_consume(uuid) from public, anon, authenticated;
grant execute on function public.spacequant_try_consume(uuid) to service_role;
