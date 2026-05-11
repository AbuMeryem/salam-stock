-- ════════════════════════════════════════════════════════════════
-- Seed traiteur + 3 commandes drive démo
-- À appliquer après 0008_unify_drive_traiteur.sql.
-- ════════════════════════════════════════════════════════════════

begin;

-- ──────── Plats traiteur ────────
insert into public.produits (ean, nom, marque, categorie, sous_categorie, est_traiteur, requires_barcode_print)
values
  ('2900200000011', 'Couscous royal traiteur 4 pers', 'Salam Cuisine', 'Traiteur', 'Plats préparés', true, true),
  ('2900200000012', 'Tajine agneau pruneaux 6 pers', 'Salam Cuisine', 'Traiteur', 'Plats préparés', true, true),
  ('2900200000013', 'Pastilla poulet maison',        'Salam Cuisine', 'Traiteur', 'Plats préparés', true, true),
  ('2900200000014', 'Méchoui agneau préparé 2kg',    'Salam Cuisine', 'Traiteur', 'Plats préparés', true, true),
  ('2900200000015', 'Salade composée maison 500g',   'Salam Cuisine', 'Traiteur', 'Plats préparés', true, true)
on conflict (ean) do update set est_traiteur = true, sous_categorie = excluded.sous_categorie;

-- ──────── Stock traiteur (uniquement Particulier — cuisine sur place) ────────
insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible)
select p.id, d.id, s.qty, s.prix, true
from (values
  ('2900200000011', 8::int, 39.90::numeric),
  ('2900200000012', 5,      54.00),
  ('2900200000013', 12,     18.50),
  ('2900200000014', 3,      78.00),
  ('2900200000015', 16,      8.90)
) as s(ean, qty, prix)
join public.produits p on p.ean = s.ean
cross join (select id from public.depots where nom = 'Particulier') d
on conflict (produit_id, depot_id) do update set quantite = excluded.quantite, prix_vente = excluded.prix_vente;

-- ──────── 3 commandes drive démo ────────
-- Note : on stocke les UUIDs en CTE pour pouvoir référencer les lignes.

-- Commande #1 — Mohamed Test (4 produits Particulier + Surgelés)
with cmd1 as (
  insert into public.commandes_drive
    (numero_commande, client_nom, client_telephone, creneau_retrait, statut, total_ttc, mode_paiement)
  values
    ('SM-2026-0001', 'Mohamed Test', '+33 6 12 34 56 78',
     now() + interval '1 hour', 'en_preparation', 24.40, 'stripe')
  returning id
)
insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, quantite, prix_unitaire, statut_preparation)
select c.id, p.id, d.id, l.qty, l.prix, 'en_attente'
from cmd1 c
cross join (values
  ('3760123456001', 'Particulier', 1::int, 6.90::numeric),   -- Olives Picholine
  ('6111034567890', 'Particulier', 2,      2.80),             -- Couscous Dari
  ('8722700171768', 'Particulier', 1,      6.20),             -- Glace Magnum
  ('3270160820158', 'Particulier', 1,     10.50)              -- Crevettes surgelées
) as l(ean, depot, qty, prix)
join public.produits p on p.ean = l.ean
join public.depots d on d.nom = l.depot;

-- Commande #2 — Restaurant Le Bosphore (6 produits multi-zones Pro + Particulier)
with cmd2 as (
  insert into public.commandes_drive
    (numero_commande, client_nom, client_telephone, creneau_retrait, statut, total_ttc, mode_paiement)
  values
    ('SM-2026-0002', 'Restaurant Le Bosphore', '+33 5 61 22 18 04',
     now() + interval '2 hours', 'en_preparation', 187.20, 'en_magasin')
  returning id
)
insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, quantite, prix_unitaire, statut_preparation)
select c.id, p.id, d.id, l.qty, l.prix, 'en_attente'
from cmd2 c
cross join (values
  ('5011157102251', 'Professionnel', 3::int, 18.90::numeric),  -- Riz Basmati 5kg
  ('3760123456001', 'Particulier',   4,       6.90),            -- Olives Picholine
  ('3700987654321', 'Professionnel', 6,       3.20),            -- Harissa Cap Bon
  ('3700111222333', 'Particulier',   2,      10.90),            -- Dattes Medjool
  ('6111034567890', 'Professionnel',10,       2.80),            -- Couscous Dari
  ('5449000131836', 'Professionnel',12,       1.80)             -- Fanta Orange
) as l(ean, depot, qty, prix)
join public.produits p on p.ean = l.ean
join public.depots d on d.nom = l.depot;

-- Commande #3 — Famille Belkacem (3 produits dont 1 traiteur, retrait 30min)
with cmd3 as (
  insert into public.commandes_drive
    (numero_commande, client_nom, client_telephone, creneau_retrait, statut, total_ttc, mode_paiement)
  values
    ('SM-2026-0003', 'Famille Belkacem', '+33 6 78 90 12 34',
     now() + interval '30 minutes', 'en_preparation', 54.70, 'stripe')
  returning id
)
insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, quantite, prix_unitaire, statut_preparation)
select c.id, p.id, d.id, l.qty, l.prix, 'en_attente'
from cmd3 c
cross join (values
  ('2900200000011', 'Particulier', 1::int, 39.90::numeric),  -- Couscous royal traiteur
  ('3760123456001', 'Particulier', 1,       6.90),            -- Olives Picholine
  ('3700111222333', 'Particulier', 1,      10.90)             -- Dattes Medjool
) as l(ean, depot, qty, prix)
join public.produits p on p.ean = l.ean
join public.depots d on d.nom = l.depot;

commit;
