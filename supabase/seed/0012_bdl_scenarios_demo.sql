-- ════════════════════════════════════════════════════════════════
-- SEED — 5 BDL réalistes pour démo mardi 12 mai 2026
--
-- Scénarios couverts :
--   #2026-0142 KEREM HALAL    — réception standard + 1 surplus
--   #2026-0143 MAGHREB IMPORT — réception sans problème (cas idéal)
--   #2026-0144 FRANCE FRAIS   — manquant fournisseur (qty=0)
--   #2026-0145 METRO TOULOUSE — surplus quantité (24 livré / 20 attendu)
--   #2026-0146 DAVIGEL        — produit inconnu (EAN absent catalogue)
--
-- + 1 BDL "réception libre" historique BARAKAT HALAL LYON (11 mai 16h45).
--
-- Idempotent : `on conflict do nothing` sur fournisseurs + numéros BDL.
-- À appliquer via Supabase dashboard SQL Editor.
-- ════════════════════════════════════════════════════════════════

begin;

-- ──────── FOURNISSEURS (insert si absent) ────────
insert into public.fournisseurs (nom, contact_email, contact_telephone)
values
  ('KEREM HALAL', 'commandes@kerem-halal.fr', '+33 5 61 12 34 56'),
  ('MARCHÉ MAGHREB IMPORT', 'compta@maghreb-import.fr', '+33 4 91 22 33 44'),
  ('FRANCE FRAIS', 'orders@francefrais.fr', '+33 5 34 50 60 70'),
  ('METRO TOULOUSE', 'pro-livraison@metro.fr', '+33 5 61 99 88 77'),
  ('DAVIGEL', 'salam-toulouse@davigel.fr', '+33 2 32 96 50 00'),
  ('BARAKAT HALAL LYON', null, '+33 4 78 12 34 56')
on conflict do nothing;

-- ──────── BDL ────────
do $$
declare
  v_depot_part uuid := (select id from public.depots where nom = 'Particulier' limit 1);
  v_depot_pro  uuid := (select id from public.depots where nom = 'Professionnel' limit 1);
  v_depot_sod  uuid := (select id from public.depots where nom = 'Sodrune' limit 1);
  v_otmane     uuid := (select id from public.employes where prenom = 'Otmane' limit 1);

  v_kerem    uuid := (select id from public.fournisseurs where nom = 'KEREM HALAL' limit 1);
  v_maghreb  uuid := (select id from public.fournisseurs where nom = 'MARCHÉ MAGHREB IMPORT' limit 1);
  v_frais    uuid := (select id from public.fournisseurs where nom = 'FRANCE FRAIS' limit 1);
  v_metro    uuid := (select id from public.fournisseurs where nom = 'METRO TOULOUSE' limit 1);
  v_davigel  uuid := (select id from public.fournisseurs where nom = 'DAVIGEL' limit 1);
  v_barakat  uuid := (select id from public.fournisseurs where nom = 'BARAKAT HALAL LYON' limit 1);

  v_bdl_kerem   uuid;
  v_bdl_maghreb uuid;
  v_bdl_frais   uuid;
  v_bdl_metro   uuid;
  v_bdl_davigel uuid;
  v_bdl_libre   uuid;

  v_today date := current_date;
  v_yesterday date := current_date - 1;
begin

  -- ════════ BDL #2026-0142 KEREM HALAL — standard + surplus ════════
  insert into public.bons_de_livraison
    (numero_bdl, fournisseur_id, depot_destination_id,
     date_livraison_prevue, statut, notes)
  values
    ('BDL-2026-0142', v_kerem, v_depot_part, v_today, 'prevue',
     'Livraison hebdo viandes halal · créneau 10h-11h')
  on conflict do nothing
  returning id into v_bdl_kerem;

  if v_bdl_kerem is null then
    select id into v_bdl_kerem from public.bons_de_livraison where numero_bdl = 'BDL-2026-0142';
  end if;

  -- Lignes attendues KEREM (matchées par EAN existants ou code_barre_attendu)
  insert into public.bons_de_livraison_lignes
    (bdl_id, code_barre_attendu, quantite_attendue, statut)
  values
    (v_bdl_kerem, '2900000010001', 8,  'attendu'),  -- Viande hachée 500g
    (v_bdl_kerem, '2900000010002', 10, 'attendu'),  -- Merguez fraîches x10
    (v_bdl_kerem, '3266980025441', 12, 'attendu'),  -- Poulet entier 1.4kg
    (v_bdl_kerem, '3266980025442', 6,  'attendu'),  -- Cordon bleu x4
    (v_bdl_kerem, 'KEREM-EPAULE-1KG', 8, 'attendu') -- Code interne KEREM
  on conflict do nothing;

  -- ════════ BDL #2026-0143 MAGHREB IMPORT — cas idéal ════════
  insert into public.bons_de_livraison
    (numero_bdl, fournisseur_id, depot_destination_id,
     date_livraison_prevue, statut, notes)
  values
    ('BDL-2026-0143', v_maghreb, v_depot_pro, v_today, 'prevue',
     'Épicerie maghrébine · créneau 14h-16h')
  on conflict do nothing
  returning id into v_bdl_maghreb;

  if v_bdl_maghreb is null then
    select id into v_bdl_maghreb from public.bons_de_livraison where numero_bdl = 'BDL-2026-0143';
  end if;

  insert into public.bons_de_livraison_lignes
    (bdl_id, code_barre_attendu, quantite_attendue, statut)
  values
    (v_bdl_maghreb, '6111034567890', 30, 'attendu'),  -- Couscous Dari
    (v_bdl_maghreb, '3700222111444', 20, 'attendu'),  -- Semoule fine
    (v_bdl_maghreb, '3700987654321', 24, 'attendu'),  -- Harissa Cap Bon
    (v_bdl_maghreb, '3700111222333', 18, 'attendu'),  -- Dattes Medjool
    (v_bdl_maghreb, '6191234567890', 12, 'attendu'),  -- Huile olive Tunisie
    (v_bdl_maghreb, '3700333444555', 10, 'attendu'),  -- Thé vert Sultan
    (v_bdl_maghreb, '3700555666777', 8,  'attendu')   -- Miel jujubier
  on conflict do nothing;

  -- ════════ BDL #2026-0144 FRANCE FRAIS — manquant ════════
  insert into public.bons_de_livraison
    (numero_bdl, fournisseur_id, depot_destination_id,
     date_livraison_prevue, statut, notes)
  values
    ('BDL-2026-0144', v_frais, v_depot_part, v_today, 'prevue',
     'Frais quotidien · créneau 7h-8h. Démo : beurre oublié.')
  on conflict do nothing
  returning id into v_bdl_frais;

  if v_bdl_frais is null then
    select id into v_bdl_frais from public.bons_de_livraison where numero_bdl = 'BDL-2026-0144';
  end if;

  insert into public.bons_de_livraison_lignes
    (bdl_id, code_barre_attendu, quantite_attendue, statut)
  values
    (v_bdl_frais, '3033491200310', 30, 'attendu'),  -- Yaourt Activia x4
    (v_bdl_frais, 'FFRAIS-FROMAGE-PRESIDENT-250',   15, 'attendu'),
    (v_bdl_frais, 'FFRAIS-BEURRE-PRESIDENT-250',    10, 'attendu'),  -- ⬅ scénario manquant
    (v_bdl_frais, 'FFRAIS-OEUFS-LR-X6',             24, 'attendu'),
    (v_bdl_frais, 'FFRAIS-LAIT-LACTEL-1L',          36, 'attendu')
  on conflict do nothing;

  -- ════════ BDL #2026-0145 METRO — surplus quantité ════════
  insert into public.bons_de_livraison
    (numero_bdl, fournisseur_id, depot_destination_id,
     date_livraison_prevue, statut, notes)
  values
    ('BDL-2026-0145', v_metro, v_depot_sod, v_today, 'prevue',
     'Boissons + traiteur Pro · créneau 11h-12h. Démo : Coca livré +4.')
  on conflict do nothing
  returning id into v_bdl_metro;

  if v_bdl_metro is null then
    select id into v_bdl_metro from public.bons_de_livraison where numero_bdl = 'BDL-2026-0145';
  end if;

  insert into public.bons_de_livraison_lignes
    (bdl_id, code_barre_attendu, quantite_attendue, statut)
  values
    (v_bdl_metro, '5449000131836', 20, 'attendu'),  -- Coca Zero 1.5L (sera livré 24)
    (v_bdl_metro, 'METRO-EAU-CRISTALINE-1.5L',  15, 'attendu'),
    (v_bdl_metro, 'METRO-SIROP-TEISSEIRE-MENTHE', 8,  'attendu'),
    (v_bdl_metro, 'METRO-PIZZA-MERGUEZ-400',     24, 'attendu')
  on conflict do nothing;

  -- ════════ BDL #2026-0146 DAVIGEL — produit inconnu ════════
  insert into public.bons_de_livraison
    (numero_bdl, fournisseur_id, depot_destination_id,
     date_livraison_prevue, statut, notes)
  values
    ('BDL-2026-0146', v_davigel, v_depot_pro, v_today, 'prevue',
     'Surgelés Pro · créneau 9h-10h. Démo : 6 plats Bourguignon EAN inconnu.')
  on conflict do nothing
  returning id into v_bdl_davigel;

  if v_bdl_davigel is null then
    select id into v_bdl_davigel from public.bons_de_livraison where numero_bdl = 'BDL-2026-0146';
  end if;

  insert into public.bons_de_livraison_lignes
    (bdl_id, code_barre_attendu, quantite_attendue, statut)
  values
    (v_bdl_davigel, 'DAVIGEL-FILETS-CABILLAUD-600',  12, 'attendu'),
    (v_bdl_davigel, 'DAVIGEL-CREVETTES-DECORT-500',  18, 'attendu'),
    (v_bdl_davigel, 'DAVIGEL-RATATOUILLE-600',       24, 'attendu')
  on conflict do nothing;

  -- ════════ BDL #2026-0147 BARAKAT — réception libre historique (11 mai) ════════
  insert into public.bons_de_livraison
    (numero_bdl, fournisseur_id, depot_destination_id,
     date_livraison_prevue, statut, receptionne_par, receptionne_le, notes)
  values
    ('BL-2026-099887', v_barakat, v_depot_part, v_yesterday,
     'receptionnee', v_otmane, (v_yesterday + interval '16 hours 45 minutes'),
     'RÉCEPTION LIBRE · livraison surprise · 3 produits scannés à la volée')
  on conflict do nothing
  returning id into v_bdl_libre;

  if v_bdl_libre is null then
    select id into v_bdl_libre from public.bons_de_livraison where numero_bdl = 'BL-2026-099887';
  end if;

  insert into public.bons_de_livraison_lignes
    (bdl_id, code_barre_attendu, quantite_attendue, quantite_recue, statut, scanne_le, scanne_par)
  values
    (v_bdl_libre, '3760123456001', 5, 5, 'recu',
     v_yesterday + interval '16 hours 50 minutes', v_otmane),
    (v_bdl_libre, '3700111222333', 3, 3, 'recu',
     v_yesterday + interval '16 hours 52 minutes', v_otmane),
    (v_bdl_libre, 'BARAKAT-DATTES-PREMIUM-500', 6, 6, 'recu',
     v_yesterday + interval '16 hours 55 minutes', v_otmane)
  on conflict do nothing;

end$$;

commit;

-- Reload schema cache (PostgREST)
notify pgrst, 'reload schema';
