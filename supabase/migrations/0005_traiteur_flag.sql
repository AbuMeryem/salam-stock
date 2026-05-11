-- ─────────────────────────────────────────────────────────────────────────
-- 0005_traiteur_flag.sql
-- Distingue les produits "traiteur" (plats préparés maison, sortent de la
-- cuisine du magasin) du reste du catalogue. Sert au routage automatique
-- de la zone_preparation lors de l'ajout au panier drive.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.produits
  add column if not exists est_traiteur boolean not null default false;

-- Seed 5 plats traiteur démo, attachés au dépôt Particulier (la cuisine
-- est physiquement au Particulier en magasin).
do $$
declare
  depot_particulier uuid;
  pid uuid;
begin
  select id into depot_particulier from public.depots where nom = 'Particulier';
  if depot_particulier is null then
    raise notice 'Dépôt Particulier introuvable — skip seed traiteur';
    return;
  end if;

  -- Couscous royal traiteur 4 pers
  insert into public.produits (ean, nom, marque, categorie, est_traiteur, requires_barcode_print)
  values ('2900200000011', 'Couscous royal traiteur 4 pers', 'Salam Cuisine', 'Traiteur', true, true)
  on conflict (ean) do update set est_traiteur = true, categorie = 'Traiteur'
  returning id into pid;
  insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
  values (pid, depot_particulier, 8, 39.90, true)
  on conflict do nothing;

  -- Tajine agneau pruneaux 6 pers
  insert into public.produits (ean, nom, marque, categorie, est_traiteur, requires_barcode_print)
  values ('2900200000012', 'Tajine agneau pruneaux 6 pers', 'Salam Cuisine', 'Traiteur', true, true)
  on conflict (ean) do update set est_traiteur = true, categorie = 'Traiteur'
  returning id into pid;
  insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
  values (pid, depot_particulier, 5, 54.00, true)
  on conflict do nothing;

  -- Pastilla poulet maison
  insert into public.produits (ean, nom, marque, categorie, est_traiteur, requires_barcode_print)
  values ('2900200000013', 'Pastilla poulet maison', 'Salam Cuisine', 'Traiteur', true, true)
  on conflict (ean) do update set est_traiteur = true, categorie = 'Traiteur'
  returning id into pid;
  insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
  values (pid, depot_particulier, 12, 18.50, true)
  on conflict do nothing;

  -- Méchoui d'agneau préparé
  insert into public.produits (ean, nom, marque, categorie, est_traiteur, requires_barcode_print)
  values ('2900200000014', 'Méchoui d''agneau préparé 2kg', 'Salam Cuisine', 'Traiteur', true, true)
  on conflict (ean) do update set est_traiteur = true, categorie = 'Traiteur'
  returning id into pid;
  insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
  values (pid, depot_particulier, 3, 78.00, true)
  on conflict do nothing;

  -- Salade composée maison
  insert into public.produits (ean, nom, marque, categorie, est_traiteur, requires_barcode_print)
  values ('2900200000015', 'Salade composée maison 500g', 'Salam Cuisine', 'Traiteur', true, true)
  on conflict (ean) do update set est_traiteur = true, categorie = 'Traiteur'
  returning id into pid;
  insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
  values (pid, depot_particulier, 16, 8.90, true)
  on conflict do nothing;
end $$;

commit;
