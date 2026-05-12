-- ════════════════════════════════════════════════════════════════
-- 0016 — Stock edit access (admin always, employees during window)
-- ════════════════════════════════════════════════════════════════

-- 1. Fenêtre d'édition stock par dépôt (1 ligne par dépôt)
create table if not exists public.stock_edit_window (
  id           uuid primary key default gen_random_uuid(),
  depot_id     uuid not null references public.depots(id) on delete cascade,
  is_open      boolean not null default false,
  opened_by    uuid references public.employes(id),
  opened_at    timestamptz,
  closed_by    uuid references public.employes(id),
  closed_at    timestamptz,
  raison       text,
  updated_at   timestamptz not null default now(),
  unique(depot_id)
);

-- 2. Log d'audit des modifications stock manuelles
create table if not exists public.stock_edit_log (
  id              uuid primary key default gen_random_uuid(),
  depot_id        uuid not null references public.depots(id),
  produit_id      uuid not null references public.produits(id),
  quantite_avant  numeric not null,
  quantite_apres  numeric not null,
  delta           numeric generated always as (quantite_apres - quantite_avant) stored,
  raison          text,
  modifie_par     uuid not null references public.employes(id),
  modifie_le      timestamptz not null default now(),
  during_inventaire boolean not null default false
);
create index if not exists idx_stock_edit_log_depot_date
  on public.stock_edit_log(depot_id, modifie_le desc);
create index if not exists idx_stock_edit_log_produit
  on public.stock_edit_log(produit_id, modifie_le desc);

alter table public.stock_edit_window enable row level security;
alter table public.stock_edit_log enable row level security;

drop policy if exists "anon all stock_edit_window" on public.stock_edit_window;
create policy "anon all stock_edit_window" on public.stock_edit_window
  for all to anon using (true) with check (true);

drop policy if exists "anon all stock_edit_log" on public.stock_edit_log;
create policy "anon all stock_edit_log" on public.stock_edit_log
  for all to anon using (true) with check (true);

-- Pré-remplit 1 ligne stock_edit_window par dépôt (closed par défaut)
insert into public.stock_edit_window (depot_id, is_open)
select id, false from public.depots
on conflict (depot_id) do nothing;

notify pgrst, 'reload schema';
