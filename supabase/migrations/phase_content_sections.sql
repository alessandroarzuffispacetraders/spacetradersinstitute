-- Sezione del catalogo contenuti: 'trading' (default = i videocorsi esistenti)
-- oppure 'mental' (videocorsi dell'Area Mental Coach). Riusa TUTTA la struttura
-- esistente categorie→corsi→lezioni (completamento, allegati, RLS): la sezione è
-- solo un discriminante di visualizzazione. Nessuna modifica alle policy RLS —
-- le categorie 'mental' restano visibili agli studenti attivi come le 'trading',
-- e l'Area Mental Coach è comunque gated a livello di rotta per i free.

alter table public.categories
  add column if not exists section text not null default 'trading';

-- Dominio dei valori ammessi (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_section_check'
  ) then
    alter table public.categories
      add constraint categories_section_check check (section in ('trading', 'mental'));
  end if;
end $$;

-- Indice per il filtro per sezione.
create index if not exists categories_section_idx on public.categories(section);
