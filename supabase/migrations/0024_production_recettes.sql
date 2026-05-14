-- ════════════════════════════════════════════════════════════════
-- 0024 — Production traiteur / charcuterie / boucherie transformée
--
-- Architecture en 2 couches :
--   1. recettes / recettes_ingredients / recettes_etapes /
--      recettes_main_oeuvre : TEMPLATES de production (réutilisables)
--   2. productions / productions_inputs / productions_outputs /
--      productions_couts_indirects : INSTANCES réelles avec coût
--      effectivement constaté + marge calculée
-- ════════════════════════════════════════════════════════════════

-- ──────── Templates de recette ────────
create table if not exists public.recettes (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  categorie   text,
  version     integer not null default 1,
  statut      text not null default 'active'
              check (statut in ('draft', 'active', 'archived')),
  created_by  uuid references public.employes(id),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_recettes_statut on public.recettes(statut);
create index if not exists idx_recettes_categorie on public.recettes(categorie);

create table if not exists public.recettes_ingredients (
  id               uuid primary key default gen_random_uuid(),
  recette_id       uuid not null references public.recettes(id) on delete cascade,
  produit_id       uuid references public.produits(id),
  quantite         numeric not null check (quantite > 0),
  unite            text not null,
  ordre            integer not null default 0,
  notes            text,
  ingredient_libre text,
  check (produit_id is not null or ingredient_libre is not null)
);

create index if not exists idx_recettes_ingredients_recette
  on public.recettes_ingredients(recette_id);

create table if not exists public.recettes_etapes (
  id                 uuid primary key default gen_random_uuid(),
  recette_id         uuid not null references public.recettes(id) on delete cascade,
  ordre              integer not null,
  description        text not null,
  duree_minutes      integer,
  temperature_celsius numeric,
  equipement         text
);

create index if not exists idx_recettes_etapes_recette
  on public.recettes_etapes(recette_id, ordre);

create table if not exists public.recettes_main_oeuvre (
  id                  uuid primary key default gen_random_uuid(),
  recette_id          uuid not null references public.recettes(id) on delete cascade,
  poste               text not null,
  duree_minutes       integer not null check (duree_minutes > 0),
  taux_horaire_charge numeric not null check (taux_horaire_charge > 0)
);

-- ──────── Instances de production ────────
create table if not exists public.productions (
  id                       uuid primary key default gen_random_uuid(),
  recette_id               uuid references public.recettes(id),
  date_production          date not null,
  lot_numero               text unique,
  employe_responsable_id   uuid references public.employes(id),
  statut                   text not null default 'en_cours'
                           check (statut in ('en_cours', 'terminee', 'archivee')),
  notes                    text,
  cout_total_calcule       numeric,
  marge_calculee           numeric,
  created_at               timestamptz not null default now(),
  terminee_at              timestamptz
);

create index if not exists idx_productions_date on public.productions(date_production desc);
create index if not exists idx_productions_statut on public.productions(statut, date_production desc);

create table if not exists public.productions_inputs (
  id                         uuid primary key default gen_random_uuid(),
  production_id              uuid not null references public.productions(id) on delete cascade,
  produit_id                 uuid references public.produits(id),
  quantite_prevue            numeric,
  quantite_reelle_consommee  numeric not null check (quantite_reelle_consommee >= 0),
  unite                      text not null,
  cout_unitaire_ht           numeric not null check (cout_unitaire_ht >= 0),
  cout_total                 numeric generated always as
                              (quantite_reelle_consommee * cout_unitaire_ht) stored,
  source_depot_id            uuid references public.depots(id),
  scanne_par                 uuid references public.employes(id),
  scanne_at                  timestamptz not null default now()
);

create index if not exists idx_productions_inputs_production
  on public.productions_inputs(production_id);

create table if not exists public.productions_outputs (
  id                         uuid primary key default gen_random_uuid(),
  production_id              uuid not null references public.productions(id) on delete cascade,
  produit_id                 uuid references public.produits(id),
  quantite_prevue            numeric,
  quantite_reelle_produite   numeric not null check (quantite_reelle_produite >= 0),
  unite                      text not null,
  prix_vente_unitaire_ttc    numeric not null check (prix_vente_unitaire_ttc >= 0),
  depot_destination_id       uuid references public.depots(id),
  date_peremption            date,
  numero_lot                 text
);

create index if not exists idx_productions_outputs_production
  on public.productions_outputs(production_id);

create table if not exists public.productions_couts_indirects (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  type          text not null
                check (type in ('main_oeuvre', 'energie', 'consommable',
                                'amortissement_equipement', 'autre')),
  description   text,
  montant       numeric not null check (montant >= 0)
);

-- ──────── RLS permissive (alignée autres tables démo) ────────
alter table public.recettes enable row level security;
alter table public.recettes_ingredients enable row level security;
alter table public.recettes_etapes enable row level security;
alter table public.recettes_main_oeuvre enable row level security;
alter table public.productions enable row level security;
alter table public.productions_inputs enable row level security;
alter table public.productions_outputs enable row level security;
alter table public.productions_couts_indirects enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'recettes', 'recettes_ingredients', 'recettes_etapes',
    'recettes_main_oeuvre', 'productions', 'productions_inputs',
    'productions_outputs', 'productions_couts_indirects'
  ])
  loop
    execute format(
      'drop policy if exists "anon all %1$s" on public.%1$s', t
    );
    execute format(
      'create policy "anon all %1$s" on public.%1$s
         for all to anon using (true) with check (true)', t
    );
  end loop;
end$$;

notify pgrst, 'reload schema';
