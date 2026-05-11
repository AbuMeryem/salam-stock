-- ════════════════════════════════════════════════════════════════
-- 0012 — Bons de livraison, fournisseurs, alertes surplus
--
-- À appliquer sur Supabase prod via SQL Editor pour activer le
-- workflow réception professionnel (page /v2/reception refondue,
-- page /v2/reception/[bdl_id], page /v2/admin/alertes-surplus).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.fournisseurs (
  id                  uuid primary key default gen_random_uuid(),
  nom                 text not null,
  contact_email       text,
  contact_telephone   text,
  adresse             text,
  siret               text,
  created_at          timestamptz not null default now()
);

create table if not exists public.bons_de_livraison (
  id                       uuid primary key default gen_random_uuid(),
  numero_bdl               text not null,
  fournisseur_id           uuid references public.fournisseurs(id),
  depot_destination_id     uuid references public.depots(id),
  date_livraison_prevue    date not null,
  statut                   text not null default 'prevue'
    check (statut in ('prevue','en_cours','receptionnee','litige')),
  photo_palette_url_1      text,
  photo_palette_url_2      text,
  notes                    text,
  receptionne_par          uuid references public.employes(id),
  receptionne_le           timestamptz,
  valide_par_manager       uuid references public.employes(id),
  valide_le                timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists idx_bdl_depot_date on public.bons_de_livraison(depot_destination_id, date_livraison_prevue);
create index if not exists idx_bdl_statut on public.bons_de_livraison(statut, date_livraison_prevue);

create table if not exists public.bons_de_livraison_lignes (
  id                  uuid primary key default gen_random_uuid(),
  bdl_id              uuid not null references public.bons_de_livraison(id) on delete cascade,
  produit_id          uuid references public.produits(id),
  code_barre_attendu  text,
  quantite_attendue   integer not null default 1,
  quantite_recue      integer not null default 0,
  statut              text not null default 'attendu'
    check (statut in ('attendu','recu','manquant','surplus')),
  scanne_le           timestamptz,
  scanne_par          uuid references public.employes(id)
);

create index if not exists idx_bdl_lignes_bdl on public.bons_de_livraison_lignes(bdl_id);

create table if not exists public.alertes_surplus (
  id                  uuid primary key default gen_random_uuid(),
  bdl_id              uuid references public.bons_de_livraison(id),
  code_barre_scanne   text not null,
  produit_id          uuid references public.produits(id),
  quantite_surplus    integer not null,
  signale_par         uuid references public.employes(id),
  signale_le          timestamptz not null default now(),
  statut              text not null default 'en_attente'
    check (statut in ('en_attente','accepte','refuse')),
  decideur            uuid references public.employes(id),
  decide_le           timestamptz,
  photo_preuve_url    text,
  notes               text
);

create index if not exists idx_alertes_surplus_statut on public.alertes_surplus(statut, signale_le desc);

-- ─── RLS permissive (demo, mêmes politiques que les autres tables) ──
alter table public.fournisseurs enable row level security;
alter table public.bons_de_livraison enable row level security;
alter table public.bons_de_livraison_lignes enable row level security;
alter table public.alertes_surplus enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'fournisseurs','bons_de_livraison','bons_de_livraison_lignes','alertes_surplus'
  ])
  loop
    execute format('drop policy if exists "anon_all" on public.%I', t);
    execute format('create policy "anon_all" on public.%I for all using (true) with check (true)', t);
  end loop;
end$$;

notify pgrst, 'reload schema';
