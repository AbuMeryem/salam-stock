-- ════════════════════════════════════════════════════════════════
-- Salam Stock V2 — initial schema
-- Multi-dépôt, réception verrouillée, sortie tracée, transferts,
-- inventaire tournant, drive multi-zones.
-- ════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── DEPOTS ────────────────────────────────────────────────────
create table if not exists public.depots (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  type        text not null check (type in ('point_vente', 'entrepot')),
  adresse     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── PRODUITS ──────────────────────────────────────────────────
create table if not exists public.produits (
  id                       uuid primary key default gen_random_uuid(),
  ean                      text unique,
  nom                      text not null,
  marque                   text,
  categorie                text,
  sous_categorie           text,
  image_url                text,
  description              text,
  requires_barcode_print   boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ─── STOCK PAR DÉPÔT ──────────────────────────────────────────
create table if not exists public.stock_par_depot (
  id          uuid primary key default gen_random_uuid(),
  produit_id  uuid not null references public.produits(id) on delete cascade,
  depot_id    uuid not null references public.depots(id) on delete cascade,
  quantite    numeric not null default 0,
  prix_vente  numeric,
  is_visible  boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique(produit_id, depot_id)
);

create index if not exists idx_stock_depot on public.stock_par_depot(depot_id);
create index if not exists idx_stock_produit on public.stock_par_depot(produit_id);

-- ─── CODES BARRES CARTONS ─────────────────────────────────────
create table if not exists public.codes_barres_cartons (
  id                    uuid primary key default gen_random_uuid(),
  ean_carton            text unique not null,
  produit_id            uuid not null references public.produits(id) on delete cascade,
  quantite_par_carton   integer not null check (quantite_par_carton > 0),
  fournisseur           text,
  created_at            timestamptz not null default now(),
  learned_by            uuid
);

create index if not exists idx_carton_produit on public.codes_barres_cartons(produit_id);

-- ─── EMPLOYÉS ──────────────────────────────────────────────────
create table if not exists public.employes (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text not null,
  prenom              text,
  role                text not null check (role in ('reception','caisse','preparation','manager','admin')),
  depot_principal_id  uuid references public.depots(id),
  is_active           boolean not null default true,
  pin_code            text not null check (length(pin_code) = 4)
);

-- ─── RÉCEPTIONS ────────────────────────────────────────────────
create table if not exists public.receptions (
  id           uuid primary key default gen_random_uuid(),
  depot_id     uuid not null references public.depots(id),
  employe_id   uuid not null references public.employes(id),
  fournisseur  text,
  numero_bl    text,
  photo_url    text not null,
  statut       text not null check (statut in ('en_cours', 'validee')) default 'en_cours',
  created_at   timestamptz not null default now()
);

create index if not exists idx_receptions_depot_date on public.receptions(depot_id, created_at desc);

create table if not exists public.receptions_lignes (
  id                  uuid primary key default gen_random_uuid(),
  reception_id        uuid not null references public.receptions(id) on delete cascade,
  produit_id          uuid not null references public.produits(id),
  code_scanne         text,
  quantite_scannee    integer not null default 1,
  quantite_calculee   numeric not null default 1
);

create index if not exists idx_reception_lignes on public.receptions_lignes(reception_id);

-- ─── SORTIES ───────────────────────────────────────────────────
create table if not exists public.sorties_stock (
  id                    uuid primary key default gen_random_uuid(),
  depot_id              uuid not null references public.depots(id),
  employe_id            uuid not null references public.employes(id),
  produit_id            uuid not null references public.produits(id),
  type                  text not null check (type in (
    'casse_manipulation','casse_client','perime_dlc','perime_ddm',
    'defaut_fournisseur','vol_identifie','autre'
  )),
  motif_libre           text,
  quantite              numeric not null check (quantite > 0),
  photo_url             text not null,
  ia_coherence_score    numeric check (ia_coherence_score is null or (ia_coherence_score between 0 and 1)),
  ia_coherence_notes    text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_sorties_depot_date on public.sorties_stock(depot_id, created_at desc);
create index if not exists idx_sorties_low_score on public.sorties_stock(depot_id) where ia_coherence_score < 0.6;

-- ─── TRANSFERTS INTER-DÉPÔTS ──────────────────────────────────
create table if not exists public.transferts_inter_depots (
  id                       uuid primary key default gen_random_uuid(),
  depot_source_id          uuid not null references public.depots(id),
  depot_destination_id     uuid not null references public.depots(id),
  produit_id               uuid not null references public.produits(id),
  quantite                 numeric not null check (quantite > 0),
  employe_id               uuid not null references public.employes(id),
  photo_url                text,
  created_at               timestamptz not null default now(),
  check (depot_source_id <> depot_destination_id)
);

create index if not exists idx_transferts_date on public.transferts_inter_depots(created_at desc);

-- ─── INVENTAIRES TOURNANTS ────────────────────────────────────
create table if not exists public.inventaires_tournants (
  id                    uuid primary key default gen_random_uuid(),
  depot_id              uuid not null references public.depots(id),
  produit_id            uuid not null references public.produits(id),
  employe_assigne_id    uuid not null references public.employes(id),
  date_assignation      date not null default current_date,
  quantite_attendue     numeric,
  quantite_comptee      numeric,
  ecart                 numeric generated always as (coalesce(quantite_comptee, 0) - coalesce(quantite_attendue, 0)) stored,
  statut                text not null check (statut in ('assigne','compte','valide')) default 'assigne',
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists idx_inv_depot_date on public.inventaires_tournants(depot_id, date_assignation desc);
create index if not exists idx_inv_assigne on public.inventaires_tournants(employe_assigne_id, statut);

-- ─── COMMANDES DRIVE ──────────────────────────────────────────
create table if not exists public.commandes_drive (
  id                uuid primary key default gen_random_uuid(),
  numero_commande   text unique not null,
  client_nom        text not null,
  client_telephone  text,
  client_email      text,
  creneau_retrait   timestamptz not null,
  statut            text not null check (statut in ('en_preparation','pret','retire','annule')) default 'en_preparation',
  total_ttc         numeric not null default 0,
  mode_paiement     text not null check (mode_paiement in ('stripe','en_magasin')) default 'en_magasin',
  created_at        timestamptz not null default now()
);

create index if not exists idx_drive_statut on public.commandes_drive(statut, creneau_retrait);

create table if not exists public.commandes_drive_lignes (
  id                       uuid primary key default gen_random_uuid(),
  commande_id              uuid not null references public.commandes_drive(id) on delete cascade,
  produit_id               uuid not null references public.produits(id),
  depot_id                 uuid not null references public.depots(id),
  quantite                 numeric not null check (quantite > 0),
  prix_unitaire            numeric not null default 0,
  statut_preparation       text not null check (statut_preparation in ('en_attente','prepare','manquant')) default 'en_attente',
  prepare_par_employe_id   uuid references public.employes(id),
  prepare_at               timestamptz
);

create index if not exists idx_drive_lignes_cmd on public.commandes_drive_lignes(commande_id);

-- ─── ROW-LEVEL SECURITY ───────────────────────────────────────
-- For demo: anon role read-only, service_role full. Auth-based rules
-- will be added with proper auth in V2.1.
alter table public.depots enable row level security;
alter table public.produits enable row level security;
alter table public.stock_par_depot enable row level security;
alter table public.codes_barres_cartons enable row level security;
alter table public.employes enable row level security;
alter table public.receptions enable row level security;
alter table public.receptions_lignes enable row level security;
alter table public.sorties_stock enable row level security;
alter table public.transferts_inter_depots enable row level security;
alter table public.inventaires_tournants enable row level security;
alter table public.commandes_drive enable row level security;
alter table public.commandes_drive_lignes enable row level security;

-- Read-all policies (POC, app uses service role for writes)
do $$
declare t text;
begin
  for t in select unnest(array[
    'depots','produits','stock_par_depot','codes_barres_cartons','employes',
    'receptions','receptions_lignes','sorties_stock','transferts_inter_depots',
    'inventaires_tournants','commandes_drive','commandes_drive_lignes'
  ])
  loop
    execute format('drop policy if exists "read_all" on public.%I', t);
    execute format('create policy "read_all" on public.%I for select using (true)', t);
  end loop;
end$$;

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_produits on public.produits;
create trigger trg_touch_produits before update on public.produits
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_stock on public.stock_par_depot;
create trigger trg_touch_stock before update on public.stock_par_depot
  for each row execute function public.touch_updated_at();
