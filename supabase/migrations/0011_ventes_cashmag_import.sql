-- ════════════════════════════════════════════════════════════════
-- 0011 — Table ventes_cashmag_import (ventes magasin importées)
-- À appliquer sur Supabase prod via SQL Editor pour activer la page
-- /v2/admin/import-cashmag.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.ventes_cashmag_import (
  id              uuid primary key default gen_random_uuid(),
  date_vente      date not null,
  heure_vente     time,
  numero_ticket   text not null,
  code_barre      text,
  designation     text not null,
  quantite        numeric not null default 1,
  prix_ht         numeric,
  prix_ttc        numeric not null,
  tva_taux        numeric,
  mode_paiement   text,
  raw_line        text,
  imported_at     timestamptz not null default now(),
  imported_by     text,
  unique (numero_ticket, code_barre, designation, quantite)
);

create index if not exists idx_cashmag_date on public.ventes_cashmag_import(date_vente);
create index if not exists idx_cashmag_ticket on public.ventes_cashmag_import(numero_ticket);

alter table public.ventes_cashmag_import enable row level security;

drop policy if exists "anon_select" on public.ventes_cashmag_import;
create policy "anon_select" on public.ventes_cashmag_import for select using (true);
drop policy if exists "anon_insert" on public.ventes_cashmag_import;
create policy "anon_insert" on public.ventes_cashmag_import for insert with check (true);
drop policy if exists "anon_update" on public.ventes_cashmag_import;
create policy "anon_update" on public.ventes_cashmag_import for update using (true) with check (true);
drop policy if exists "anon_delete" on public.ventes_cashmag_import;
create policy "anon_delete" on public.ventes_cashmag_import for delete using (true);

notify pgrst, 'reload schema';
