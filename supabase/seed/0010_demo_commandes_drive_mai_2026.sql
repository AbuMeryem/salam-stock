-- ════════════════════════════════════════════════════════════════
-- Seed 10 commandes Drive démo pour les RDV Otmane (10-11 mai 2026)
-- Permet d'avoir du contenu visible dans :
--   /v2/admin (chart CA + KPI Drive)
--   /v2/admin/recap-fiscal (Z journalier)
--   /v2/admin/rapport-mensuel (consolidation mai)
--
-- À exécuter dans SQL Editor Supabase. Idempotent (delete + re-insert
-- via numero_commande unique).
-- ════════════════════════════════════════════════════════════════

begin;

-- 1. Clean previous demo seed (idempotent)
delete from public.commandes_drive_lignes
 where commande_id in (
   select id from public.commandes_drive
    where numero_commande like 'DRV-20260510-%'
       or numero_commande like 'DRV-20260511-%'
 );
delete from public.commandes_drive
 where numero_commande like 'DRV-20260510-%'
    or numero_commande like 'DRV-20260511-%';

-- 2. Insert 10 commandes Drive avec UUID déterministes
--    (préfixe `dd1` = "Demo Day 1" pour le 10 mai, `dd2` pour le 11)
do $$
declare
  v_depot_particulier uuid;
  v_zone_part text := 'particulier';
  v_zone_pro text := 'professionnel';
  v_zone_traiteur text := 'traiteur';
  v_cmd_id uuid;
  v_prod_record record;
begin
  select id into v_depot_particulier from public.depots where nom = 'Particulier' limit 1;
  if v_depot_particulier is null then
    raise notice 'Pas de dépôt Particulier — seed avorté';
    return;
  end if;

  -- ──────────────────────── 10 MAI 2026 (6 commandes) ─────────────────────

  -- DRV-20260510-A1B2 — Restaurant Le Bosphore (Pro, 17h12)
  v_cmd_id := 'dd1aaaa1-aaaa-4aaa-aaaa-aaaaaaaa0001'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260510-A1B2', 'Restaurant Le Bosphore', '+33 5 61 22 33 44',
    'commande@lebosphore.fr', '2026-05-10T19:00:00+02:00'::timestamptz, 'retire',
    187.20, 'stripe', '2026-05-10T17:12:00+02:00'::timestamptz);
  for v_prod_record in
    select id, nom, categorie from public.produits where nom ilike '%poulet%' or nom ilike '%entrec%te%' or nom ilike '%riz%' limit 3
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_pro::zone_preparation_drive, 4, 15.60, 'prepare');
  end loop;

  -- DRV-20260510-C3D4 — Famille Belkacem (Particulier, 10h45, traiteur inclus)
  v_cmd_id := 'dd1aaaa1-aaaa-4aaa-aaaa-aaaaaaaa0002'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260510-C3D4', 'Famille Belkacem', '+33 6 12 34 56 78',
    'belkacem@gmail.com', '2026-05-10T11:30:00+02:00'::timestamptz, 'retire',
    98.50, 'stripe', '2026-05-10T10:45:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%couscous%' or nom ilike '%traiteur%' or nom ilike '%pastilla%' limit 2
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_traiteur::zone_preparation_drive, 1, 39.90, 'prepare');
  end loop;
  for v_prod_record in
    select id from public.produits where nom ilike '%merguez%' or nom ilike '%harissa%' limit 2
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 1, 9.35, 'prepare');
  end loop;

  -- DRV-20260510-E5F6 — Imane Tazi (Particulier, 14h20)
  v_cmd_id := 'dd1aaaa1-aaaa-4aaa-aaaa-aaaaaaaa0003'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260510-E5F6', 'Imane Tazi', '+33 6 87 65 43 21',
    'imane.tazi@gmail.com', '2026-05-10T17:00:00+02:00'::timestamptz, 'retire',
    54.70, 'stripe', '2026-05-10T14:20:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%dattes%' or nom ilike '%th%' or nom ilike '%miel%' or nom ilike '%huile%' limit 4
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 1, 13.67, 'prepare');
  end loop;

  -- DRV-20260510-G7H8 — Karim Boumediene (Particulier, 16h00)
  v_cmd_id := 'dd1aaaa1-aaaa-4aaa-aaaa-aaaaaaaa0004'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260510-G7H8', 'Karim Boumediene', '+33 6 14 25 36 47',
    'karim.b@hotmail.fr', '2026-05-10T18:30:00+02:00'::timestamptz, 'retire',
    73.40, 'stripe', '2026-05-10T16:00:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%semoule%' or nom ilike '%cordon%' or nom ilike '%bricks%' or nom ilike '%pois chiches%' limit 4
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 2, 9.18, 'prepare');
  end loop;

  -- DRV-20260510-I9J0 — Boulangerie El Andalous (Pro, 06h45 le matin)
  v_cmd_id := 'dd1aaaa1-aaaa-4aaa-aaaa-aaaaaaaa0005'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260510-I9J0', 'Boulangerie El Andalous', '+33 5 61 78 90 12',
    'compta@elandalous.fr', '2026-05-10T08:30:00+02:00'::timestamptz, 'retire',
    142.00, 'stripe', '2026-05-10T06:45:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%poulet%' or nom ilike '%hach%e%' limit 2
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_pro::zone_preparation_drive, 5, 14.20, 'prepare');
  end loop;

  -- DRV-20260510-K1L2 — Sarah Mansouri (Particulier, 19h30)
  v_cmd_id := 'dd1aaaa1-aaaa-4aaa-aaaa-aaaaaaaa0006'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260510-K1L2', 'Sarah Mansouri', '+33 7 89 12 34 56',
    'sarah.m@yahoo.fr', '2026-05-10T20:30:00+02:00'::timestamptz, 'retire',
    32.80, 'stripe', '2026-05-10T19:30:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%loukoum%' or nom ilike '%olives%' or nom ilike '%houmous%' limit 3
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 1, 5.47, 'prepare');
  end loop;

  -- ──────────────────────── 11 MAI 2026 (4 commandes) ─────────────────────

  -- DRV-20260511-M3N4 — Mohamed Test (Particulier, 09h17, fait par Mohamed pendant ses tests)
  v_cmd_id := 'dd2aaaa2-aaaa-4aaa-aaaa-aaaaaaaa0001'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260511-M3N4', 'Mohamed Test', '+33 6 98 76 54 32',
    'mohamed.test@gmail.com', '2026-05-11T11:00:00+02:00'::timestamptz, 'pret',
    24.40, 'stripe', '2026-05-11T09:17:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%merguez%' or nom ilike '%poulet%' limit 2
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 1, 12.20, 'prepare');
  end loop;

  -- DRV-20260511-O5P6 — Famille Belkacem (Particulier, 13h46)
  v_cmd_id := 'dd2aaaa2-aaaa-4aaa-aaaa-aaaaaaaa0002'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260511-O5P6', 'Famille Belkacem', '+33 6 12 34 56 78',
    'belkacem@gmail.com', '2026-05-11T16:30:00+02:00'::timestamptz, 'pret',
    87.50, 'stripe', '2026-05-11T13:46:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%tajine%' or nom ilike '%couscous%' limit 1
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_traiteur::zone_preparation_drive, 1, 54.00, 'en_attente');
  end loop;
  for v_prod_record in
    select id from public.produits where nom ilike '%harissa%' or nom ilike '%pois chiches%' or nom ilike '%semoule%' limit 3
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 1, 11.16, 'en_attente');
  end loop;

  -- DRV-20260511-Q7R8 — Imane Tazi (Particulier, 14h46)
  v_cmd_id := 'dd2aaaa2-aaaa-4aaa-aaaa-aaaaaaaa0003'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260511-Q7R8', 'Imane Tazi', '+33 6 87 65 43 21',
    'imane.tazi@gmail.com', '2026-05-11T17:30:00+02:00'::timestamptz, 'en_preparation',
    54.70, 'stripe', '2026-05-11T14:46:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%dattes%' or nom ilike '%miel%' or nom ilike '%th%' limit 3
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 2, 9.12, 'en_attente');
  end loop;

  -- DRV-20260511-S9T0 — Karim Particulier (16h30)
  v_cmd_id := 'dd2aaaa2-aaaa-4aaa-aaaa-aaaaaaaa0004'::uuid;
  insert into public.commandes_drive (id, numero_commande, client_nom, client_telephone,
    client_email, creneau_retrait, statut, total_ttc, mode_paiement, created_at)
  values (v_cmd_id, 'DRV-20260511-S9T0', 'Karim Lahmar', '+33 6 76 54 32 10',
    'karim.lahmar@orange.fr', '2026-05-11T19:00:00+02:00'::timestamptz, 'en_preparation',
    73.40, 'stripe', '2026-05-11T16:30:00+02:00'::timestamptz);
  for v_prod_record in
    select id from public.produits where nom ilike '%semoule%' or nom ilike '%huile%' or nom ilike '%cumin%' or nom ilike '%ras el%' limit 4
  loop
    insert into public.commandes_drive_lignes (commande_id, produit_id, depot_id, zone_preparation, quantite, prix_unitaire, statut_preparation)
    values (v_cmd_id, v_prod_record.id, v_depot_particulier, v_zone_part::zone_preparation_drive, 1, 9.18, 'en_attente');
  end loop;

end$$;

commit;

-- Verif rapide
select date(created_at at time zone 'Europe/Paris') as jour,
       count(*) as nb,
       sum(total_ttc) as ca_ttc
  from public.commandes_drive
 where numero_commande like 'DRV-202605%'
 group by 1
 order by 1 desc;
