# Salamarket / Salam Stock -- Complete Database Schema

> **Generated**: 2026-05-25
> **Source**: All migration files from `salam-stock/supabase/migrations/` (0001-0024) and `salamarket-drive/supabase/migrations/` (0024b-0030 + timestamped)
> **Single source of truth** for the unified Supabase project `tltmermqodelorthtbre`

---

## Table of Contents

1. [Migration Chronology](#migration-chronology)
2. [Architectural Debt: `produits` vs `products`](#architectural-debt-produits-vs-products)
3. [Tables](#tables)
   - [depots](#depots)
   - [produits](#produits)
   - [products](#products-physical-table)
   - [stock_par_depot](#stock_par_depot)
   - [codes_barres_cartons](#codes_barres_cartons)
   - [employes](#employes)
   - [receptions](#receptions)
   - [receptions_lignes](#receptions_lignes)
   - [sorties_stock](#sorties_stock)
   - [transferts_inter_depots](#transferts_inter_depots)
   - [inventaires_tournants](#inventaires_tournants)
   - [commandes_drive](#commandes_drive)
   - [commandes_drive_lignes](#commandes_drive_lignes)
   - [ventes_cashmag_import](#ventes_cashmag_import)
   - [fournisseurs](#fournisseurs)
   - [bons_de_livraison](#bons_de_livraison)
   - [bons_de_livraison_lignes](#bons_de_livraison_lignes)
   - [alertes_surplus](#alertes_surplus)
   - [push_subscriptions](#push_subscriptions)
   - [stock_edit_window](#stock_edit_window)
   - [stock_edit_log](#stock_edit_log)
   - [profiles](#profiles)
   - [pickup_slots](#pickup_slots)
   - [orders](#orders)
   - [recettes](#recettes)
   - [recettes_ingredients](#recettes_ingredients)
   - [recettes_etapes](#recettes_etapes)
   - [recettes_main_oeuvre](#recettes_main_oeuvre)
   - [productions](#productions)
   - [productions_inputs](#productions_inputs)
   - [productions_outputs](#productions_outputs)
   - [productions_couts_indirects](#productions_couts_indirects)
   - [comptes_pro](#comptes_pro)
   - [produits_pro_prix](#produits_pro_prix)
   - [commandes_pro](#commandes_pro)
   - [commandes_pro_lignes](#commandes_pro_lignes)
   - [drive_ecarts_poids](#drive_ecarts_poids)
4. [Views](#views)
5. [Enums](#enums)
6. [Sequences](#sequences)
7. [Triggers and Functions](#triggers-and-functions)
8. [Realtime Publications](#realtime-publications)

---

## Migration Chronology

### salam-stock repo (0001 -- 0024)

| # | File | Description |
|---|------|-------------|
| 0001 | `0001_init.sql` | Initial schema: depots, produits, stock_par_depot, codes_barres_cartons, employes, receptions/lignes, sorties_stock, transferts, inventaires_tournants, commandes_drive/lignes, RLS read-all + updated_at triggers |
| 0002 | `0002_remove_vol_identifie.sql` | Replace `vol_identifie` with `demarque_inconnue` in sorties_stock type CHECK |
| 0003 | `0003_reception_vide.sql` | Add `reception_vide` boolean to receptions + partial index |
| 0004 | `0004_zones_drive.sql` | Create enum `zone_preparation_drive`, add `zone_preparation` column to commandes_drive_lignes |
| 0005 | `0005_traiteur_flag.sql` | Add `est_traiteur` boolean to produits + seed 5 traiteur demo products |
| 0006 | `0006_employe_sodrune.sql` | Insert Reda Hamidou employee for Sodrune depot |
| 0007 | `0007_write_policies.sql` | POC write policies: anon INSERT/UPDATE/DELETE on all 12 tables |
| 0008 | `0008_unify_drive_traiteur.sql` | Idempotent re-add of `est_traiteur` + `sous_categorie` + traiteur index |
| 0009 | `0009_sync_drive_orders.sql` | Bidirectional sync triggers: orders -> commandes_drive (forward) + commandes_drive.statut -> orders.status (reverse) + backfill |
| 0010 | `0010_realtime_commandes_drive.sql` | Add commandes_drive + commandes_drive_lignes to supabase_realtime publication |
| 0011 | `0011_ventes_cashmag_import.sql` | Create ventes_cashmag_import table for POS sales import |
| 0012 | `0012_bdl_livraisons.sql` | Create fournisseurs, bons_de_livraison, bons_de_livraison_lignes, alertes_surplus |
| 0013 | `0013_push_subscriptions.sql` | Create push_subscriptions table (Stock variant with employe_id) |
| 0014 | `0014_align_push_columns.sql` | Rename p256dh->keys_p256dh, auth->keys_auth on push_subscriptions |
| 0015 | `0015_push_user_id_nullable.sql` | Make push_subscriptions.user_id nullable (Stock uses PIN login, no auth.users) |
| 0016 | `0016_stock_edit_access.sql` | Create stock_edit_window + stock_edit_log tables |
| 0017a | `0017_fix_drive_sync_confirmed.sql` | Fix sync trigger: add `confirmed` status mapping + use EAN-based product matching |
| 0017b | `0017_otmane_admin_role.sql` | Promote Otmane Jamal to admin role |
| 0018 | `0018_client_type_produits.sql` | Add `client_type` column to produits (particulier/pro/traiteur) |
| 0019 | `0019_bdl_photo_numero_fournisseur.sql` | Add `numero_bdl_fournisseur` + `photo_bdl_url` to bons_de_livraison |
| 0020 | `0020_commande_drive_statut_a_preparer.sql` | Add `a_preparer` status to commandes_drive CHECK, change default |
| 0021 | `0021_fix_drive_sync_a_preparer_and_lignes.sql` | Rewrite sync trigger: paid->a_preparer, placeholder product for unmatched lines |
| 0022 | `0022_unify_drive_into_stock.sql` | MAJOR: Create profiles, pickup_slots, orders tables + extend produits with Drive columns + rewrite sync trigger + RLS |
| 0023 | `0023_drive_products_view.sql` | Create `products` VIEW mapping produits->Drive format (name, price_cents, etc.) |
| 0024 | `0024_production_recettes.sql` | Create recettes/ingredients/etapes/main_oeuvre + productions/inputs/outputs/couts_indirects |

### salamarket-drive repo (0024b -- 0030 + timestamped)

| # | File | Description |
|---|------|-------------|
| TS-01 | `20260428024903_*.sql` | **Original Drive schema**: Create `products` physical TABLE + seed 12 products + RLS public read |
| TS-02 | `20260428035416_*.sql` | Create `profiles` table + handle_new_user trigger + update_updated_at_column function |
| TS-03 | `20260428035427_*.sql` | Security: revoke execute on update_updated_at_column + handle_new_user from public |
| TS-04 | `20260428044808_*.sql` | Create `pickup_slots` table |
| TS-05 | `20260501120000_*.sql` | Add `preparing` to orders status CHECK + promote test account to employee |
| TS-06 | `20260502120000_*.sql` | Security fix: profile role escalation prevention (WITH CHECK + REVOKE UPDATE role) |
| TS-07 | `20260502120100_*.sql` | Security fix: realtime orders data leak (RLS on realtime.messages + current_user_role() helper) |
| TS-08 | `20260503100000_*.sql` | Perf: switch product images from .jpg to .webp |
| TS-09 | `20260505100000_*.sql` | Add 8 test products to products table |
| TS-10 | `20260505110000_*.sql` | Deduplicate products + add UNIQUE(name) constraint |
| TS-11 | `20260511135000_*.sql` | Add FK orders.pickup_slot_id -> pickup_slots(id) |
| -- | `enable_orders_realtime.sql` | Add orders to supabase_realtime publication |
| -- | `push_subscriptions.sql` | Create push_subscriptions (Drive variant with user_id NOT NULL) |
| -- | `push_subscriptions_update_policy.sql` | Add missing UPDATE policy on push_subscriptions |
| -- | `reset_product_catalog.sql` | DELETE all products + re-seed 12 aligned with real photos |
| -- | `update_product_images.sql` | Update product image_url paths by name matching |
| 0024b | `0024b_fixes_production.sql` | Add missing FK indexes on productions_* + tva_taux column on products |
| 0025a | `0025_drive_pro.sql` | MAJOR: Create comptes_pro, produits_pro_prix, commandes_pro, commandes_pro_lignes + sequences + triggers + RLS |
| 0025b | `0025_productions_kpi.sql` | Create v_productions_kpi view |
| 0026 | `0026_promote_zabiri_manager.sql.OBSOLETE` | (Obsolete) Promote Zabiri to manager -- superseded by 0027 |
| 0027 | `0027_setup_comptes_equipe.sql` | Promote ZBAIRI accounts to manager + CHECK on profiles.role + set_user_role() function |
| 0028 | `0028_comptes_pro_self_register.sql` | Add INSERT policy for self-registration on comptes_pro |
| 0029 | `0029_drive_au_poids.sql` | Add weight columns to products + produits, Stripe manual capture on commandes_drive, weighing on lignes, create drive_ecarts_poids |
| 0030 | `0030_seed_drive_au_poids.sql` | Seed 4 weight products in both produits + products + stock_par_depot |

---

## Architectural Debt: `produits` vs `products`

### The Problem

There are **two separate product-related objects** in the database:

1. **`produits`** (table) -- The canonical French-language product catalog, created in `0001_init.sql` (salam-stock). FK target for `commandes_drive_lignes.produit_id`, `receptions_lignes.produit_id`, `stock_par_depot.produit_id`, etc.

2. **`products`** (physical table) -- The English-language Drive catalog, **originally created as a physical TABLE** in the Drive repo (`20260428024903_*.sql`). Used by the salamarket-drive frontend.

### The History

- **0001** (salam-stock): `produits` created as the single source of truth.
- **20260428024903** (salamarket-drive): `products` created as a **separate physical table** on the (then-separate) Drive Supabase project.
- **0022** (salam-stock): Both projects unified onto a single Supabase instance. Drive-specific columns (`visible_drive`, `prix_drive_cents`, `image_drive_url`, `description_drive`, `drive_unit`, `drive_category`) added to `produits`.
- **0023** (salam-stock): `products` **recreated as a VIEW** on top of `produits`, mapping French columns to English names (e.g., `p.nom AS name`, `p.prix_drive_cents AS price_cents`). Only exposes rows where `visible_drive = true`.
- **Post-0023** (production): In reality, `products` remained a **physical table** on the production database (the view was never actually applied, or was reverted). Migration `0024b` adds `tva_taux` to `products` (treating it as a table). Migration `0030` explicitly seeds into both `produits` AND `products` with matching UUIDs, confirming `products` is a physical table in prod.

### Current State (Production)

| Object | Type | Used By |
|--------|------|---------|
| `produits` | Physical table | salam-stock (backoffice): receptions, stock, sorties, inventaires, commandes_drive_lignes FK |
| `products` | Physical table (NOT a view) | salamarket-drive (frontend): catalog display, orders.items, pro pricing FK |

### Consequences

- **Data duplication**: Product data must be inserted/updated in BOTH tables with matching UUIDs.
- **FK split**: `commandes_drive_lignes.produit_id` -> `produits(id)`, but `produits_pro_prix.produit_id` -> `products(id)`, `commandes_pro_lignes.produit_id` -> `products(id)`.
- **Drift risk**: Changes to a product in one table without the other cause inconsistency.
- **Seed complexity**: Migration 0030 explicitly seeds identical rows in both tables to maintain alignment.

### Recommended Resolution

Convert `products` back to a view (as 0023 intended) or create a sync trigger. The view approach is cleaner but requires:
1. Dropping `products` table (after migrating FK references).
2. Recreating as view per 0023.
3. Updating `produits_pro_prix` and `commandes_pro_lignes` FK to reference `produits(id)`.

---

## Tables

### depots

**Purpose**: Physical storage locations (retail stores and warehouses).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| nom | text | NOT NULL | -- |
| type | text | NOT NULL, CHECK | -- |
| adresse | text | -- | -- |
| is_active | boolean | NOT NULL | true |
| created_at | timestamptz | NOT NULL | now() |

**CHECK constraints**:
- `type IN ('point_vente', 'entrepot')`

**RLS policies**:
- `read_all`: SELECT for all (true)
- `anon_insert`: INSERT with check (true)
- `anon_update`: UPDATE using (true) with check (true)
- `anon_delete`: DELETE using (true)

**Known depots**: Particulier (point_vente), Professionnel (point_vente), Sodrune (entrepot), Salam Toulouse (point_vente, fallback from 0030)

---

### produits

**Purpose**: Canonical product catalog (French). Single source of truth for stock management. Also serves Drive via additional columns added in 0022.

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK | gen_random_uuid() | 0001 |
| ean | text | UNIQUE | -- | 0001 |
| nom | text | NOT NULL | -- | 0001 |
| marque | text | -- | -- | 0001 |
| categorie | text | -- | -- | 0001 |
| sous_categorie | text | -- | -- | 0001/0008 |
| image_url | text | -- | -- | 0001 |
| description | text | -- | -- | 0001 |
| requires_barcode_print | boolean | NOT NULL | false | 0001 |
| est_traiteur | boolean | NOT NULL | false | 0005/0008/0009 |
| client_type | text | CHECK | 'particulier' | 0018 |
| visible_drive | boolean | NOT NULL | false | 0022 |
| prix_drive_cents | integer | CHECK >= 0 or NULL | -- | 0022 |
| image_drive_url | text | -- | -- | 0022 |
| description_drive | text | -- | -- | 0022 |
| drive_unit | text | CHECK | -- | 0022 |
| drive_category | text | -- | -- | 0022 |
| unit_type | text | NOT NULL, CHECK | 'unit' | 0029 |
| price_per_kg | numeric | -- | -- | 0029 |
| estimated_weight_kg | numeric | -- | -- | 0029 |
| poids_min_kg | numeric | -- | -- | 0029 |
| poids_max_kg | numeric | -- | -- | 0029 |
| created_at | timestamptz | NOT NULL | now() | 0001 |
| updated_at | timestamptz | NOT NULL | now() | 0001 |

**CHECK constraints**:
- `client_type IN ('particulier', 'pro', 'traiteur')`
- `drive_unit IN ('kg', 'piece', 'pack')` or NULL
- `prix_drive_cents >= 0` or NULL
- `unit_type IN ('unit', 'weight', 'weight_bracket')`
- `produits_poids_bracket_check`: if unit_type = 'weight_bracket' then poids_min_kg and poids_max_kg must be NOT NULL and min < max

**Indexes**:
- `idx_produits_traiteur` on (est_traiteur) WHERE est_traiteur = true
- `idx_produits_client_type` on (client_type)
- `idx_produits_visible_drive` on (visible_drive) WHERE visible_drive = true

**Triggers**:
- `trg_touch_produits` BEFORE UPDATE -> touch_updated_at()

**RLS**: Same permissive pattern as depots (read_all + anon INSERT/UPDATE/DELETE).

---

### products (physical table)

**Purpose**: English-language product catalog used by salamarket-drive frontend. Was supposed to be a VIEW (0023) but exists as a physical table in production.

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK | gen_random_uuid() | TS-01 |
| name | text | NOT NULL, UNIQUE | -- | TS-01/TS-10 |
| description | text | NOT NULL | '' | TS-01 |
| price_cents | integer | NOT NULL, CHECK >= 0 | -- | TS-01 |
| unit | text | NOT NULL, CHECK | -- | TS-01 |
| category | text | NOT NULL | -- | TS-01 |
| image_url | text | NOT NULL | -- | TS-01 |
| in_stock | boolean | NOT NULL | true | TS-01 |
| tva_taux | numeric | NOT NULL | 5.5 | 0024b |
| unit_type | text | NOT NULL, CHECK | 'unit' | 0029 |
| price_per_kg | numeric | -- | -- | 0029 |
| estimated_weight_kg | numeric | -- | -- | 0029 |
| poids_min_kg | numeric | -- | -- | 0029 |
| poids_max_kg | numeric | -- | -- | 0029 |
| created_at | timestamptz | NOT NULL | now() | TS-01 |
| updated_at | timestamptz | NOT NULL | now() | TS-01 |

**CHECK constraints**:
- `unit IN ('kg', 'piece', 'pack')`
- `price_cents >= 0`
- `products_name_unique` UNIQUE(name)
- `products_unit_type_check`: unit_type IN ('unit', 'weight', 'weight_bracket')
- `products_poids_bracket_check`: if weight_bracket then min < max required

**Indexes**:
- `idx_products_category` on (category)

**RLS policies**:
- `Products are viewable by everyone`: SELECT using (true)

**Note**: No write policies for anon/authenticated besides admin -- only SELECT is public.

---

### stock_par_depot

**Purpose**: Current stock quantity per product per depot. Central inventory state.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| produit_id | uuid | NOT NULL, FK produits(id) CASCADE | -- |
| depot_id | uuid | NOT NULL, FK depots(id) CASCADE | -- |
| quantite | numeric | NOT NULL | 0 |
| prix_vente | numeric | -- | -- |
| is_visible | boolean | NOT NULL | true |
| updated_at | timestamptz | NOT NULL | now() |

**Unique**: (produit_id, depot_id)

**Indexes**:
- `idx_stock_depot` on (depot_id)
- `idx_stock_produit` on (produit_id)

**Triggers**:
- `trg_touch_stock` BEFORE UPDATE -> touch_updated_at()

**RLS**: Permissive (read_all + anon INSERT/UPDATE/DELETE).

---

### codes_barres_cartons

**Purpose**: Maps carton (box) barcodes to products. When an employee scans a carton barcode, the system resolves it to the product and knows the quantity per carton.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| ean_carton | text | UNIQUE, NOT NULL | -- |
| produit_id | uuid | NOT NULL, FK produits(id) CASCADE | -- |
| quantite_par_carton | integer | NOT NULL, CHECK > 0 | -- |
| fournisseur | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |
| learned_by | uuid | -- | -- |

**Indexes**:
- `idx_carton_produit` on (produit_id)

**RLS**: Permissive (read_all + anon INSERT/UPDATE/DELETE).

---

### employes

**Purpose**: Store employees with PIN-based authentication (no Supabase Auth). Used for stock operations.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| nom | text | NOT NULL | -- |
| prenom | text | -- | -- |
| role | text | NOT NULL, CHECK | -- |
| depot_principal_id | uuid | FK depots(id) | -- |
| is_active | boolean | NOT NULL | true |
| pin_code | text | NOT NULL, CHECK length = 4 | -- |

**CHECK constraints**:
- `role IN ('reception', 'caisse', 'preparation', 'manager', 'admin')`
- `length(pin_code) = 4`

**RLS**: Permissive (read_all + anon INSERT/UPDATE/DELETE).

---

### receptions

**Purpose**: Goods reception events (delivery of products to a depot).

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK | gen_random_uuid() | 0001 |
| depot_id | uuid | NOT NULL, FK depots(id) | -- | 0001 |
| employe_id | uuid | NOT NULL, FK employes(id) | -- | 0001 |
| fournisseur | text | -- | -- | 0001 |
| numero_bl | text | -- | -- | 0001 |
| photo_url | text | NOT NULL | -- | 0001 |
| statut | text | NOT NULL, CHECK | 'en_cours' | 0001 |
| reception_vide | boolean | NOT NULL | false | 0003 |
| created_at | timestamptz | NOT NULL | now() | 0001 |

**CHECK**: `statut IN ('en_cours', 'validee')`

**Indexes**:
- `idx_receptions_depot_date` on (depot_id, created_at DESC)
- `idx_receptions_vide` on (reception_vide) WHERE reception_vide = true

**RLS**: Permissive.

---

### receptions_lignes

**Purpose**: Individual line items scanned during a reception.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| reception_id | uuid | NOT NULL, FK receptions(id) CASCADE | -- |
| produit_id | uuid | NOT NULL, FK produits(id) | -- |
| code_scanne | text | -- | -- |
| quantite_scannee | integer | NOT NULL | 1 |
| quantite_calculee | numeric | NOT NULL | 1 |

**Indexes**:
- `idx_reception_lignes` on (reception_id)

**RLS**: Permissive.

---

### sorties_stock

**Purpose**: Stock exits/losses (breakage, expiry, shrinkage, etc.). Each exit is photographed and AI-scored for coherence.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| depot_id | uuid | NOT NULL, FK depots(id) | -- |
| employe_id | uuid | NOT NULL, FK employes(id) | -- |
| produit_id | uuid | NOT NULL, FK produits(id) | -- |
| type | text | NOT NULL, CHECK | -- |
| motif_libre | text | -- | -- |
| quantite | numeric | NOT NULL, CHECK > 0 | -- |
| photo_url | text | NOT NULL | -- |
| ia_coherence_score | numeric | CHECK 0-1 or NULL | -- |
| ia_coherence_notes | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |

**CHECK** (after 0002):
- `type IN ('casse_manipulation', 'casse_client', 'perime_dlc', 'perime_ddm', 'defaut_fournisseur', 'demarque_inconnue', 'autre')`

**Indexes**:
- `idx_sorties_depot_date` on (depot_id, created_at DESC)
- `idx_sorties_low_score` on (depot_id) WHERE ia_coherence_score < 0.6

**RLS**: Permissive.

**Evolution**: 0001 had `vol_identifie` in CHECK; 0002 replaced it with `demarque_inconnue`.

---

### transferts_inter_depots

**Purpose**: Inter-depot stock transfers with photo proof.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| depot_source_id | uuid | NOT NULL, FK depots(id) | -- |
| depot_destination_id | uuid | NOT NULL, FK depots(id) | -- |
| produit_id | uuid | NOT NULL, FK produits(id) | -- |
| quantite | numeric | NOT NULL, CHECK > 0 | -- |
| employe_id | uuid | NOT NULL, FK employes(id) | -- |
| photo_url | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |

**CHECK**: `depot_source_id <> depot_destination_id`

**Indexes**:
- `idx_transferts_date` on (created_at DESC)

**RLS**: Permissive.

---

### inventaires_tournants

**Purpose**: Rotating inventory counts assigned to employees.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| depot_id | uuid | NOT NULL, FK depots(id) | -- |
| produit_id | uuid | NOT NULL, FK produits(id) | -- |
| employe_assigne_id | uuid | NOT NULL, FK employes(id) | -- |
| date_assignation | date | NOT NULL | current_date |
| quantite_attendue | numeric | -- | -- |
| quantite_comptee | numeric | -- | -- |
| ecart | numeric | GENERATED ALWAYS AS (quantite_comptee - quantite_attendue) STORED | -- |
| statut | text | NOT NULL, CHECK | 'assigne' |
| created_at | timestamptz | NOT NULL | now() |
| completed_at | timestamptz | -- | -- |

**CHECK**: `statut IN ('assigne', 'compte', 'valide')`

**Indexes**:
- `idx_inv_depot_date` on (depot_id, date_assignation DESC)
- `idx_inv_assigne` on (employe_assigne_id, statut)

**RLS**: Permissive.

---

### commandes_drive

**Purpose**: Drive (click-and-collect) order headers. Synced from `orders` table via trigger. Central to the Stock Kanban preparation board.

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK | gen_random_uuid() | 0001 |
| numero_commande | text | UNIQUE, NOT NULL | -- | 0001 |
| client_nom | text | NOT NULL | -- | 0001 |
| client_telephone | text | -- | -- | 0001 |
| client_email | text | -- | -- | 0001 |
| creneau_retrait | timestamptz | NOT NULL | -- | 0001 |
| statut | text | NOT NULL, CHECK | 'a_preparer' | 0001/0020 |
| total_ttc | numeric | NOT NULL | 0 | 0001 |
| mode_paiement | text | NOT NULL, CHECK | 'en_magasin' | 0001 |
| stripe_payment_intent_id | text | -- | -- | 0029 |
| montant_autorise_ttc | numeric | -- | -- | 0029 |
| montant_capture_ttc | numeric | -- | -- | 0029 |
| statut_paiement | text | CHECK | 'autorise' | 0029 |
| autorisation_expire_at | timestamptz | -- | -- | 0029 |
| created_at | timestamptz | NOT NULL | now() | 0001 |

**CHECK constraints**:
- `statut IN ('a_preparer', 'en_preparation', 'pret', 'retire', 'annule')` (post-0020; originally without 'a_preparer')
- `mode_paiement IN ('stripe', 'en_magasin')`
- `statut_paiement IN ('autorise', 'capture', 'libere', 'echec')`

**Indexes**:
- `idx_drive_statut` on (statut, creneau_retrait)
- `uq_commandes_drive_stripe_pi` UNIQUE on (stripe_payment_intent_id) WHERE NOT NULL
- `idx_commandes_drive_statut_paiement` on (statut_paiement)

**Realtime**: Published to `supabase_realtime` (0010).

**RLS**: Permissive (anon all).

**Evolution**:
- 0001: Created with statut CHECK ('en_preparation','pret','retire','annule'), default 'en_preparation'
- 0020: Added 'a_preparer' to CHECK, changed default to 'a_preparer'
- 0029: Added Stripe manual capture columns + payment status

---

### commandes_drive_lignes

**Purpose**: Individual line items of a Drive order, with preparation tracking per line.

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK | gen_random_uuid() | 0001 |
| commande_id | uuid | NOT NULL, FK commandes_drive(id) CASCADE | -- | 0001 |
| produit_id | uuid | NOT NULL, FK produits(id) | -- | 0001 |
| depot_id | uuid | NOT NULL, FK depots(id) | -- | 0001 |
| quantite | numeric | NOT NULL, CHECK > 0 | -- | 0001 |
| prix_unitaire | numeric | NOT NULL | 0 | 0001 |
| statut_preparation | text | NOT NULL, CHECK | 'en_attente' | 0001 |
| prepare_par_employe_id | uuid | FK employes(id) | -- | 0001 |
| prepare_at | timestamptz | -- | -- | 0001 |
| zone_preparation | zone_preparation_drive | NOT NULL | 'particulier' | 0004/0009 |
| quantite_estimee | numeric | -- | -- | 0029 |
| quantite_reelle_pesee | numeric | -- | -- | 0029 |
| montant_estime_ttc | numeric | -- | -- | 0029 |
| montant_reel_ttc | numeric | -- | -- | 0029 |
| pese_par | uuid | FK profiles(id) SET NULL | -- | 0029 |
| pese_at | timestamptz | -- | -- | 0029 |

**CHECK**: `statut_preparation IN ('en_attente', 'prepare', 'manquant')`

**Indexes**:
- `idx_drive_lignes_cmd` on (commande_id)
- `idx_drive_lignes_zone` on (zone_preparation)
- `idx_commandes_drive_lignes_pese` on (pese_at) WHERE pese_at IS NOT NULL

**Realtime**: Published to `supabase_realtime` (0010).

**RLS**: Permissive (anon all).

---

### ventes_cashmag_import

**Purpose**: Imported POS (CashMag) sales data for reconciliation with stock.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| date_vente | date | NOT NULL | -- |
| heure_vente | time | -- | -- |
| numero_ticket | text | NOT NULL | -- |
| code_barre | text | -- | -- |
| designation | text | NOT NULL | -- |
| quantite | numeric | NOT NULL | 1 |
| prix_ht | numeric | -- | -- |
| prix_ttc | numeric | NOT NULL | -- |
| tva_taux | numeric | -- | -- |
| mode_paiement | text | -- | -- |
| raw_line | text | -- | -- |
| imported_at | timestamptz | NOT NULL | now() |
| imported_by | text | -- | -- |

**Unique**: (numero_ticket, code_barre, designation, quantite)

**Indexes**:
- `idx_cashmag_date` on (date_vente)
- `idx_cashmag_ticket` on (numero_ticket)

**RLS**: Permissive (anon SELECT/INSERT/UPDATE/DELETE).

---

### fournisseurs

**Purpose**: Supplier registry for delivery notes.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| nom | text | NOT NULL | -- |
| contact_email | text | -- | -- |
| contact_telephone | text | -- | -- |
| adresse | text | -- | -- |
| siret | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |

**RLS**: `anon_all` for all using (true).

---

### bons_de_livraison

**Purpose**: Delivery notes (BDL) tracking -- from expected delivery to reception and manager validation.

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK | gen_random_uuid() | 0012 |
| numero_bdl | text | NOT NULL | -- | 0012 |
| fournisseur_id | uuid | FK fournisseurs(id) | -- | 0012 |
| depot_destination_id | uuid | FK depots(id) | -- | 0012 |
| date_livraison_prevue | date | NOT NULL | -- | 0012 |
| statut | text | NOT NULL, CHECK | 'prevue' | 0012 |
| photo_palette_url_1 | text | -- | -- | 0012 |
| photo_palette_url_2 | text | -- | -- | 0012 |
| notes | text | -- | -- | 0012 |
| receptionne_par | uuid | FK employes(id) | -- | 0012 |
| receptionne_le | timestamptz | -- | -- | 0012 |
| valide_par_manager | uuid | FK employes(id) | -- | 0012 |
| valide_le | timestamptz | -- | -- | 0012 |
| numero_bdl_fournisseur | text | -- | -- | 0019 |
| photo_bdl_url | text | -- | -- | 0019 |
| created_at | timestamptz | NOT NULL | now() | 0012 |

**CHECK**: `statut IN ('prevue', 'en_cours', 'receptionnee', 'litige')`

**Indexes**:
- `idx_bdl_depot_date` on (depot_destination_id, date_livraison_prevue)
- `idx_bdl_statut` on (statut, date_livraison_prevue)

**RLS**: `anon_all` for all using (true).

---

### bons_de_livraison_lignes

**Purpose**: Individual line items expected/received on a delivery note.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| bdl_id | uuid | NOT NULL, FK bons_de_livraison(id) CASCADE | -- |
| produit_id | uuid | FK produits(id) | -- |
| code_barre_attendu | text | -- | -- |
| quantite_attendue | integer | NOT NULL | 1 |
| quantite_recue | integer | NOT NULL | 0 |
| statut | text | NOT NULL, CHECK | 'attendu' |
| scanne_le | timestamptz | -- | -- |
| scanne_par | uuid | FK employes(id) | -- |

**CHECK**: `statut IN ('attendu', 'recu', 'manquant', 'surplus')`

**Indexes**:
- `idx_bdl_lignes_bdl` on (bdl_id)

**RLS**: `anon_all` for all using (true).

---

### alertes_surplus

**Purpose**: Alerts raised when unexpected/surplus products are scanned during a delivery.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| bdl_id | uuid | FK bons_de_livraison(id) | -- |
| code_barre_scanne | text | NOT NULL | -- |
| produit_id | uuid | FK produits(id) | -- |
| quantite_surplus | integer | NOT NULL | -- |
| signale_par | uuid | FK employes(id) | -- |
| signale_le | timestamptz | NOT NULL | now() |
| statut | text | NOT NULL, CHECK | 'en_attente' |
| decideur | uuid | FK employes(id) | -- |
| decide_le | timestamptz | -- | -- |
| photo_preuve_url | text | -- | -- |
| notes | text | -- | -- |

**CHECK**: `statut IN ('en_attente', 'accepte', 'refuse')`

**Indexes**:
- `idx_alertes_surplus_statut` on (statut, signale_le DESC)

**RLS**: `anon_all` for all using (true).

---

### push_subscriptions

**Purpose**: Web Push notification subscriptions. Has TWO origin schemas (Drive variant with user_id, Stock variant with employe_id). The merged table has BOTH columns.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| user_id | uuid | FK auth.users, NULLABLE (made nullable in 0015) | -- |
| employe_id | uuid | FK employes(id) CASCADE | -- |
| endpoint | text | NOT NULL, UNIQUE | -- |
| keys_p256dh | text | -- | -- |
| keys_auth | text | -- | -- |
| user_agent | text | -- | -- |
| enabled | boolean | NOT NULL | true |
| created_at | timestamptz | NOT NULL | now() |
| last_used_at | timestamptz | NOT NULL | now() |

**Indexes**:
- `idx_push_subs_employe` on (employe_id) WHERE enabled = true
- `push_subscriptions_user_id_idx` on (user_id) (from Drive variant)

**RLS policies** (merged):
- Drive: `users read own push subs` (SELECT where auth.uid()=user_id), `users insert own push subs`, `users delete own push subs`, `users update own push subs`
- Stock: `anon all push_subs` for all to anon using (true)

**Evolution**:
- Drive `push_subscriptions.sql`: Created with user_id NOT NULL, columns p256dh/auth
- Stock 0013: Created with employe_id, columns keys_p256dh/keys_auth
- Stock 0014: Renamed p256dh->keys_p256dh, auth->keys_auth
- Stock 0015: Made user_id nullable

---

### stock_edit_window

**Purpose**: Controls whether manual stock editing is allowed per depot. One row per depot. Managers open/close the editing window.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| depot_id | uuid | NOT NULL, FK depots(id) CASCADE, UNIQUE | -- |
| is_open | boolean | NOT NULL | false |
| opened_by | uuid | FK employes(id) | -- |
| opened_at | timestamptz | -- | -- |
| closed_by | uuid | FK employes(id) | -- |
| closed_at | timestamptz | -- | -- |
| raison | text | -- | -- |
| updated_at | timestamptz | NOT NULL | now() |

**RLS**: `anon all` for all using (true).

---

### stock_edit_log

**Purpose**: Audit trail for manual stock quantity changes.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| depot_id | uuid | NOT NULL, FK depots(id) | -- |
| produit_id | uuid | NOT NULL, FK produits(id) | -- |
| quantite_avant | numeric | NOT NULL | -- |
| quantite_apres | numeric | NOT NULL | -- |
| delta | numeric | GENERATED ALWAYS AS (quantite_apres - quantite_avant) STORED | -- |
| raison | text | -- | -- |
| modifie_par | uuid | NOT NULL, FK employes(id) | -- |
| modifie_le | timestamptz | NOT NULL | now() |
| during_inventaire | boolean | NOT NULL | false |

**Indexes**:
- `idx_stock_edit_log_depot_date` on (depot_id, modifie_le DESC)
- `idx_stock_edit_log_produit` on (produit_id, modifie_le DESC)

**RLS**: `anon all` for all using (true).

---

### profiles

**Purpose**: User profiles linked 1:1 to auth.users. Manages roles for Drive and backoffice access.

| Column | Type | Constraints | Default | Added In |
|--------|------|-------------|---------|----------|
| id | uuid | PK, FK auth.users(id) CASCADE | -- | TS-02/0022 |
| email | text | NOT NULL | -- | TS-02/0022 |
| full_name | text | NOT NULL | '' | TS-02/0022 |
| phone | text | NOT NULL | '' | TS-02/0022 |
| role | text | NOT NULL, CHECK | 'customer' | 0022/0027 |
| created_at | timestamptz | NOT NULL | now() | TS-02/0022 |
| updated_at | timestamptz | NOT NULL | now() | TS-02/0022 |

**CHECK** (after 0027): `role IN ('admin', 'manager', 'employee', 'customer')`

**Indexes**:
- `idx_profiles_role` on (role)

**Triggers**:
- `trg_touch_profiles` / `update_profiles_updated_at` BEFORE UPDATE -> touch_profiles_updated_at() / update_updated_at_column()
- `on_auth_user_created` on auth.users AFTER INSERT -> handle_new_user()

**RLS policies**:
- `profiles_select_own`: SELECT where auth.uid() = id
- `profiles_insert_own`: INSERT where auth.uid() = id
- `profiles_update_own_safe` / `profiles_update_own`: UPDATE where auth.uid() = id AND role unchanged (anti-escalation)
- Column-level: `REVOKE UPDATE (role) ON profiles FROM authenticated`

**Security**: Role escalation prevented by both RLS WITH CHECK (role must match stored value) and column-level REVOKE.

---

### pickup_slots

**Purpose**: Available pickup time slots for Drive orders.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| slot_start | timestamptz | NOT NULL, UNIQUE | -- |
| slot_end | timestamptz | NOT NULL | -- |
| capacity | integer | NOT NULL, CHECK > 0 | 5 |
| reserved_count | integer | NOT NULL, CHECK >= 0 | 0 |
| created_at | timestamptz | NOT NULL | now() |

**Indexes**:
- `idx_pickup_slots_start` on (slot_start)

**RLS policies**:
- `pickup_slots_public_read`: SELECT using (true)

---

### orders

**Purpose**: Customer-facing Drive orders. Contains items as JSONB. Synced to commandes_drive via trigger for the Stock Kanban.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| user_id | uuid | NOT NULL, FK profiles(id) RESTRICT | -- |
| pickup_slot_id | uuid | FK pickup_slots(id) RESTRICT/SET NULL | -- |
| status | text | NOT NULL, CHECK | 'pending' |
| payment_method | text | NOT NULL, CHECK | -- |
| payment_status | text | NOT NULL, CHECK | 'unpaid' |
| items | jsonb | NOT NULL | -- |
| subtotal_cents | integer | NOT NULL, CHECK >= 0 | -- |
| total_cents | integer | NOT NULL, CHECK >= 0 | -- |
| customer_email | text | -- | -- |
| customer_phone | text | -- | -- |
| notes | text | -- | -- |
| stripe_session_id | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |

**CHECK constraints**:
- `status IN ('pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'cancelled')`
- `payment_method IN ('online', 'in_store')`
- `payment_status IN ('unpaid', 'paid', 'refunded', 'failed')`

**Indexes**:
- `idx_orders_user` on (user_id)
- `idx_orders_status` on (status, created_at DESC)
- `idx_orders_pickup_slot` on (pickup_slot_id)

**Triggers**:
- `trg_touch_orders` BEFORE UPDATE -> touch_orders_updated_at()
- `sync_drive_order_to_stock_trigger` AFTER INSERT OR UPDATE -> sync_drive_order_to_stock()

**Realtime**: Published to `supabase_realtime`.

**RLS policies**:
- `orders_select_own_or_staff`: SELECT where owner OR admin/employee
- `orders_insert_own`: INSERT where auth.uid() = user_id
- `orders_update_staff_or_owner_cancel`: UPDATE where staff OR (owner AND status = 'pending')

**items JSONB structure** (per element):
```json
{
  "name": "Product Name",
  "quantity": 2,
  "unit_price_cents": 1290,
  "ean": "3700000000001"
}
```

---

### recettes

**Purpose**: Production recipe templates (reusable).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| nom | text | NOT NULL | -- |
| categorie | text | -- | -- |
| version | integer | NOT NULL | 1 |
| statut | text | NOT NULL, CHECK | 'active' |
| created_by | uuid | FK employes(id) | -- |
| notes | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |

**CHECK**: `statut IN ('draft', 'active', 'archived')`

**Indexes**:
- `idx_recettes_statut` on (statut)
- `idx_recettes_categorie` on (categorie)

**RLS**: `anon all` for all.

---

### recettes_ingredients

**Purpose**: Ingredients needed for a recipe.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| recette_id | uuid | NOT NULL, FK recettes(id) CASCADE | -- |
| produit_id | uuid | FK produits(id) | -- |
| quantite | numeric | NOT NULL, CHECK > 0 | -- |
| unite | text | NOT NULL | -- |
| ordre | integer | NOT NULL | 0 |
| notes | text | -- | -- |
| ingredient_libre | text | -- | -- |

**CHECK**: `produit_id IS NOT NULL OR ingredient_libre IS NOT NULL` (must have either a linked product or free-text ingredient)

**Indexes**:
- `idx_recettes_ingredients_recette` on (recette_id)

**RLS**: `anon all` for all.

---

### recettes_etapes

**Purpose**: Step-by-step instructions for a recipe.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| recette_id | uuid | NOT NULL, FK recettes(id) CASCADE | -- |
| ordre | integer | NOT NULL | -- |
| description | text | NOT NULL | -- |
| duree_minutes | integer | -- | -- |
| temperature_celsius | numeric | -- | -- |
| equipement | text | -- | -- |

**Indexes**:
- `idx_recettes_etapes_recette` on (recette_id, ordre)

**RLS**: `anon all` for all.

---

### recettes_main_oeuvre

**Purpose**: Labor requirements template per recipe (for costing).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| recette_id | uuid | NOT NULL, FK recettes(id) CASCADE | -- |
| poste | text | NOT NULL | -- |
| duree_minutes | integer | NOT NULL, CHECK > 0 | -- |
| taux_horaire_charge | numeric | NOT NULL, CHECK > 0 | -- |

**RLS**: `anon all` for all.

---

### productions

**Purpose**: Actual production run instances (linked to a recipe template).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| recette_id | uuid | FK recettes(id) | -- |
| date_production | date | NOT NULL | -- |
| lot_numero | text | UNIQUE | -- |
| employe_responsable_id | uuid | FK employes(id) | -- |
| statut | text | NOT NULL, CHECK | 'en_cours' |
| notes | text | -- | -- |
| cout_total_calcule | numeric | -- | -- |
| marge_calculee | numeric | -- | -- |
| created_at | timestamptz | NOT NULL | now() |
| terminee_at | timestamptz | -- | -- |

**CHECK**: `statut IN ('en_cours', 'terminee', 'archivee')`

**Indexes**:
- `idx_productions_date` on (date_production DESC)
- `idx_productions_statut` on (statut, date_production DESC)

**RLS**: `anon all` for all.

---

### productions_inputs

**Purpose**: Raw materials consumed during a production run.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| production_id | uuid | NOT NULL, FK productions(id) CASCADE | -- |
| produit_id | uuid | FK produits(id) | -- |
| quantite_prevue | numeric | -- | -- |
| quantite_reelle_consommee | numeric | NOT NULL, CHECK >= 0 | -- |
| unite | text | NOT NULL | -- |
| cout_unitaire_ht | numeric | NOT NULL, CHECK >= 0 | -- |
| cout_total | numeric | GENERATED ALWAYS AS (quantite_reelle_consommee * cout_unitaire_ht) STORED | -- |
| source_depot_id | uuid | FK depots(id) | -- |
| scanne_par | uuid | FK employes(id) | -- |
| scanne_at | timestamptz | NOT NULL | now() |

**Indexes**:
- `idx_productions_inputs_production` on (production_id)
- `idx_productions_inputs_prod` on (production_id) (0024b duplicate, harmless)

**RLS**: `anon all` for all.

---

### productions_outputs

**Purpose**: Finished goods produced during a production run.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| production_id | uuid | NOT NULL, FK productions(id) CASCADE | -- |
| produit_id | uuid | FK produits(id) | -- |
| quantite_prevue | numeric | -- | -- |
| quantite_reelle_produite | numeric | NOT NULL, CHECK >= 0 | -- |
| unite | text | NOT NULL | -- |
| prix_vente_unitaire_ttc | numeric | NOT NULL, CHECK >= 0 | -- |
| depot_destination_id | uuid | FK depots(id) | -- |
| date_peremption | date | -- | -- |
| numero_lot | text | -- | -- |

**Indexes**:
- `idx_productions_outputs_production` on (production_id)
- `idx_productions_outputs_prod` on (production_id) (0024b duplicate)

**RLS**: `anon all` for all.

---

### productions_couts_indirects

**Purpose**: Indirect costs (labor, energy, consumables, equipment depreciation) for a production run.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| production_id | uuid | NOT NULL, FK productions(id) CASCADE | -- |
| type | text | NOT NULL, CHECK | -- |
| description | text | -- | -- |
| montant | numeric | NOT NULL, CHECK >= 0 | -- |

**CHECK**: `type IN ('main_oeuvre', 'energie', 'consommable', 'amortissement_equipement', 'autre')`

**Indexes**:
- `idx_productions_couts_indirects_prod` on (production_id) (0024b)

**RLS**: `anon all` for all.

---

### comptes_pro

**Purpose**: B2B professional customer accounts (restaurants, caterers, schools, associations).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| raison_sociale | text | NOT NULL | -- |
| siret | text | NOT NULL, UNIQUE | -- |
| forme_juridique | text | -- | -- |
| tva_intracom | text | -- | -- |
| adresse_facturation | text | NOT NULL | -- |
| adresse_livraison | text | -- | -- |
| delegue_user_id | uuid | FK profiles(id) SET NULL | -- |
| delegue_nom | text | NOT NULL | -- |
| delegue_telephone | text | NOT NULL | -- |
| delegue_email | text | NOT NULL | -- |
| mandat_sepa_id | text | -- | -- |
| conditions_paiement | text | NOT NULL, CHECK | 'comptant' |
| encours_max | numeric | NOT NULL | 0 |
| encours_actuel | numeric | NOT NULL | 0 |
| statut | text | NOT NULL, CHECK | 'en_validation' |
| notes_interne | text | -- | -- |
| valide_par_profile_id | uuid | FK profiles(id) SET NULL | -- |
| valide_at | timestamptz | -- | -- |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |

**CHECK constraints**:
- `statut IN ('en_validation', 'actif', 'suspendu', 'archive')`
- `conditions_paiement IN ('comptant', '30_jours', '45_jours_fin_mois')`

**Indexes**:
- `idx_comptes_pro_delegue` on (delegue_user_id)
- `idx_comptes_pro_statut` on (statut)

**Triggers**:
- `trg_comptes_pro_updated_at` BEFORE UPDATE -> update_updated_at_column()

**RLS policies**:
- `comptes_pro_select_delegue`: SELECT where auth.uid() = delegue_user_id
- `comptes_pro_all_admin_manager`: ALL where role IN ('admin','manager')
- `comptes_pro_insert_self`: INSERT where auth.uid() = delegue_user_id AND statut = 'en_validation' (0028)

**Grants**: SELECT, INSERT, UPDATE to authenticated.

---

### produits_pro_prix

**Purpose**: B2B wholesale pricing per product with volume discount tiers.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| produit_id | uuid | NOT NULL, FK **products**(id) CASCADE | -- |
| prix_ht_unitaire | numeric | NOT NULL | -- |
| conditionnement_pro | text | -- | -- |
| quantite_par_conditionnement | integer | NOT NULL | 1 |
| prix_ht_par_conditionnement | numeric | -- | -- |
| remise_palier_1_pct | numeric | -- | -- |
| qty_palier_1 | integer | -- | -- |
| remise_palier_2_pct | numeric | -- | -- |
| qty_palier_2 | integer | -- | -- |
| actif | boolean | NOT NULL | true |
| valide_a_partir_de | date | NOT NULL | current_date |
| disponible_drive_pro | boolean | NOT NULL | true |
| created_at | timestamptz | NOT NULL | now() |

**Note**: FK references `products(id)`, NOT `produits(id)` -- part of the architectural debt.

**Unique partial index**: `uniq_produits_pro_prix_actif` on (produit_id) WHERE actif = true (only one active price per product)

**RLS policies**:
- `produits_pro_prix_select_pro`: SELECT where user has an active comptes_pro
- `produits_pro_prix_all_admin_manager`: ALL where role IN ('admin','manager')

**Grants**: SELECT to authenticated.

---

### commandes_pro

**Purpose**: B2B professional orders with validation workflow and invoicing.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| compte_pro_id | uuid | NOT NULL, FK comptes_pro(id) RESTRICT | -- |
| numero_commande | text | UNIQUE | -- |
| date_commande | timestamptz | NOT NULL | now() |
| date_livraison_souhaitee | date | -- | -- |
| creneau_livraison_debut | time | -- | -- |
| creneau_livraison_fin | time | -- | -- |
| type_recuperation | text | NOT NULL, CHECK | 'livraison' |
| statut | text | NOT NULL, CHECK | 'a_valider' |
| validee_par_profile_id | uuid | FK profiles(id) SET NULL | -- |
| validee_at | timestamptz | -- | -- |
| montant_ht | numeric | NOT NULL | 0 |
| montant_tva | numeric | NOT NULL | 0 |
| montant_ttc | numeric | NOT NULL | 0 |
| mode_paiement | text | CHECK or NULL | -- |
| facture_url | text | -- | -- |
| facture_numero | text | UNIQUE | -- |
| date_echeance | date | -- | -- |
| date_paiement | timestamptz | -- | -- |
| notes_client | text | -- | -- |
| notes_interne | text | -- | -- |
| created_at | timestamptz | NOT NULL | now() |
| updated_at | timestamptz | NOT NULL | now() |

**CHECK constraints**:
- `type_recuperation IN ('livraison', 'retrait_pro')`
- `statut IN ('a_valider', 'validee', 'en_preparation', 'expediee', 'livree', 'facturee', 'payee', 'annulee')`
- `mode_paiement IN ('stripe', 'virement_30j', 'prelevement_sepa')` or NULL

**Indexes**:
- `idx_commandes_pro_compte_statut` on (compte_pro_id, statut)
- `idx_commandes_pro_relances` on (date_echeance) WHERE statut NOT IN ('payee','annulee')

**Triggers**:
- `trg_gen_numero_commande_pro` BEFORE INSERT -> gen_numero_commande_pro() (auto-generates 'CP-2026-XXXX')
- `trg_gen_facture_numero` BEFORE UPDATE -> gen_facture_numero() (generates 'F-2026-XXXX' on transition to 'facturee')
- `trg_recalc_encours_insert/update/delete` AFTER INSERT/UPDATE/DELETE -> recalc_encours_compte_pro()
- `trg_commandes_pro_updated_at` BEFORE UPDATE -> update_updated_at_column()

**RLS policies**:
- `commandes_pro_select_delegue`: SELECT where user is delegue of the compte_pro
- `commandes_pro_all_admin_manager`: ALL where role IN ('admin','manager')

**Grants**: SELECT, INSERT, UPDATE to authenticated.

---

### commandes_pro_lignes

**Purpose**: Line items of a B2B professional order.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| commande_pro_id | uuid | NOT NULL, FK commandes_pro(id) CASCADE | -- |
| produit_id | uuid | NOT NULL, FK **products**(id) RESTRICT | -- |
| quantite_conditionnements | integer | NOT NULL | -- |
| quantite_par_conditionnement | integer | NOT NULL | -- |
| quantite_unitaire_totale | numeric | GENERATED (conditionnements * par_conditionnement) STORED | -- |
| prix_ht_unitaire | numeric | NOT NULL | -- |
| prix_ht_total | numeric | GENERATED (conditionnements * par_conditionnement * prix_ht_unitaire) STORED | -- |
| tva_taux | numeric | -- (filled by trigger if null) | -- |
| created_at | timestamptz | NOT NULL | now() |

**Note**: FK references `products(id)`, NOT `produits(id)` -- part of the architectural debt.

**Indexes**:
- `idx_commandes_pro_lignes_commande` on (commande_pro_id)

**Triggers**:
- `trg_set_ligne_tva_taux` BEFORE INSERT -> set_ligne_tva_taux() (copies tva_taux from products if null)

**RLS policies**:
- `commandes_pro_lignes_select_delegue`: SELECT where user is delegue via join
- `commandes_pro_lignes_all_admin_manager`: ALL where role IN ('admin','manager')

**Grants**: SELECT, INSERT, UPDATE to authenticated.

---

### drive_ecarts_poids

**Purpose**: Audit trail for weight discrepancies during Drive order preparation (weighing vs estimated).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PK | gen_random_uuid() |
| ligne_id | uuid | NOT NULL, FK commandes_drive_lignes(id) CASCADE | -- |
| ecart_pct | numeric | NOT NULL | -- |
| action | text | NOT NULL, CHECK | -- |
| decision_par | uuid | FK profiles(id) SET NULL | -- |
| decision_at | timestamptz | NOT NULL | now() |
| notes | text | -- | -- |

**CHECK**: `action IN ('auto_accept', 'preparator_decision', 'client_notify', 'client_validation_required')`

**Business rules**:
- < 10% discrepancy: `auto_accept`
- 10-20%: `preparator_decision`
- 10-20% AND > 5 euros: `client_notify`
- > 20%: `client_validation_required`

**Indexes**:
- `idx_drive_ecarts_poids_ligne` on (ligne_id)
- `idx_drive_ecarts_poids_action` on (action)

**RLS policies**:
- `ecarts_poids_select_staff`: SELECT where role IN ('admin','manager','employee')
- `ecarts_poids_insert_staff`: INSERT where role IN ('admin','manager','employee')

---

## Views

### products (VIEW -- 0023, may not be applied in prod)

**Defined in**: `0023_drive_products_view.sql`

Maps `produits` (FR) to Drive format (EN). Only rows where `visible_drive = true`.

```sql
SELECT
  p.id,
  p.nom AS name,
  coalesce(p.description_drive, p.description, '') AS description,
  coalesce(p.prix_drive_cents, 0) AS price_cents,
  coalesce(p.drive_unit, 'piece') AS unit,
  coalesce(p.drive_category, 'epicerie') AS category,
  coalesce(nullif(p.image_drive_url, ''), p.image_url, placeholder) AS image_url,
  p.visible_drive AS in_stock,
  p.created_at,
  p.updated_at
FROM produits p WHERE p.visible_drive = true;
```

**Status**: NOT applied in production -- `products` is a physical table instead. See [Architectural Debt](#architectural-debt-produits-vs-products).

---

### v_productions_kpi

**Defined in**: `0025_productions_kpi.sql`

Real-time KPI aggregation per completed production:

| Column | Source |
|--------|--------|
| id | productions.id |
| lot_numero | productions.lot_numero |
| date_production | productions.date_production |
| recette | productions.recette |
| cout_matieres | SUM(inputs.quantite * prix_unitaire) |
| cout_indirects | SUM(couts_indirects.montant) |
| cout_total | cout_matieres + cout_indirects |
| ca_potentiel_ttc | SUM(outputs.quantite * prix_vente_unitaire_ttc) |
| ca_potentiel_ht | ca_potentiel_ttc / (1 + tva_taux/100) |
| input_total_qty | SUM(inputs.quantite) |
| output_total_qty | SUM(outputs.quantite) |
| rendement_pct | (output_qty / input_qty) * 100 |
| marge_eur_ht | ca_potentiel_ht - cout_total |
| marge_pct_ht | (marge_eur_ht / ca_potentiel_ht) * 100 |

**Filter**: Only `productions.statut = 'terminee'`

**Security**: `security_invoker = true` (respects caller's RLS)

**Known issue**: References columns `quantite` and `prix_unitaire` on `productions_inputs`, but the actual table (0024) uses `quantite_reelle_consommee` and `cout_unitaire_ht`. Also references `p.recette` on productions, which doesn't exist (should be `p.recette_id` or join to recettes.nom). This view likely fails at runtime without manual correction.

---

## Enums

### zone_preparation_drive

**Created in**: 0004, re-ensured in 0009

**Values**: `'particulier'`, `'professionnel'`, `'traiteur'`

**Used by**: `commandes_drive_lignes.zone_preparation`

---

## Sequences

| Sequence | Created In | Purpose |
|----------|-----------|---------|
| `seq_commande_pro_2026` | 0025 | Auto-increments for B2B order numbers (CP-2026-XXXX) |
| `seq_facture_2026` | 0025 | Auto-increments for invoice numbers (F-2026-XXXX) |

**Note**: Sequences are year-bound. New sequences will be needed for 2027.

---

## Triggers and Functions

### sync_drive_order_to_stock()

**Trigger name**: `sync_drive_order_to_stock_trigger` (also existed as `sync_drive_orders_to_stock` in earlier versions)
**Table**: `orders`
**Event**: AFTER INSERT OR UPDATE, FOR EACH ROW
**Security**: DEFINER

**Business logic** (final version from 0022):
1. Map orders.status to commandes_drive.statut:
   - `confirmed` -> `a_preparer`
   - `preparing` -> `en_preparation`
   - `ready` -> `pret`
   - `picked_up` -> `retire`
   - `cancelled` -> `annule`
   - `pending` -> skip (not in Kanban)
2. Look up client name from profiles (fallback to email)
3. Look up pickup slot time from pickup_slots
4. UPSERT into commandes_drive (preserves 'pret'/'retire' status -- never downgrades)
5. For states 'a_preparer'/'en_preparation': sync line items from orders.items JSONB:
   - Match product by exact name (case-insensitive)
   - Fallback: prefix match
   - Fallback: placeholder product (EAN '0000000000000')
   - Route traiteur products to 'traiteur' zone, others to 'particulier'
6. Delete only 'en_attente' lines before re-inserting (preserves prepared lines)

**Evolution**:
- 0009: Initial version, matched by name, skipped unmatched lines silently
- 0017a: Added 'confirmed' mapping, switched to EAN matching
- 0021: Added 'a_preparer' mapping, added placeholder product, name matching restored
- 0022: Final rewrite with profiles/pickup_slots joins, proper column mapping

**Known issues**:
- Name-based matching is fragile (depends on exact product names matching between orders.items JSONB and produits.nom)
- No zone 'professionnel' routing -- all non-traiteur products default to 'particulier'

---

### sync_stock_statut_to_drive()

**Trigger name**: `sync_stock_statut_to_drive`
**Table**: `commandes_drive`
**Event**: AFTER UPDATE OF statut, FOR EACH ROW
**Security**: DEFINER

**Business logic**:
1. Only fires when statut actually changes
2. Reverse maps:
   - `en_preparation` -> `preparing`
   - `pret` -> `ready`
   - `retire` -> `completed`
   - `annule` -> `canceled`
3. Updates orders.status only if different (prevents infinite loop)

**Known issue**: The reverse mapping uses 'completed' but orders CHECK constraint uses 'picked_up' (not 'completed'). This was corrected in 0022 orders schema but the reverse trigger function was NOT updated after 0022. If the function from 0009 is still active, it would fail on UPDATE with a CHECK violation.

---

### handle_new_user()

**Trigger name**: `on_auth_user_created`
**Table**: `auth.users`
**Event**: AFTER INSERT, FOR EACH ROW
**Security**: DEFINER

**Business logic**: Creates a profiles row with role='customer', email, full_name, phone from raw_user_meta_data. ON CONFLICT (id) DO NOTHING.

---

### touch_updated_at() / touch_profiles_updated_at() / touch_orders_updated_at() / update_updated_at_column()

Multiple variants that all do `NEW.updated_at = now(); RETURN NEW;`

| Function | Used By |
|----------|---------|
| touch_updated_at() | produits, stock_par_depot |
| touch_profiles_updated_at() | profiles (salam-stock variant) |
| touch_orders_updated_at() | orders |
| update_updated_at_column() | profiles (drive variant), comptes_pro, commandes_pro |

---

### gen_numero_commande_pro()

**Trigger**: `trg_gen_numero_commande_pro` BEFORE INSERT on commandes_pro
**Logic**: If numero_commande is NULL, generate 'CP-2026-' + zero-padded nextval(seq_commande_pro_2026)

---

### gen_facture_numero()

**Trigger**: `trg_gen_facture_numero` BEFORE UPDATE on commandes_pro
**Logic**: When statut transitions to 'facturee' and facture_numero is NULL, generate 'F-2026-' + zero-padded nextval(seq_facture_2026)

---

### set_ligne_tva_taux()

**Trigger**: `trg_set_ligne_tva_taux` BEFORE INSERT on commandes_pro_lignes
**Logic**: If tva_taux is NULL, copy it from products.tva_taux. Raises exception if product not found.

---

### recalc_encours_compte_pro()

**Triggers**: `trg_recalc_encours_insert/update/delete` AFTER INSERT/UPDATE/DELETE on commandes_pro
**Logic**: Recalculates comptes_pro.encours_actuel as SUM(montant_ttc) of non-paid, non-cancelled orders for that compte_pro. Handles compte_pro_id changes on UPDATE.

---

### current_user_role()

**Type**: Standalone function (not a trigger)
**Security**: DEFINER, STABLE
**Logic**: Returns role from profiles for auth.uid(). Used by RLS policies on orders and realtime.messages.
**Grants**: EXECUTE to anon, authenticated.

---

### set_user_role(p_email text, p_role text)

**Type**: Standalone function (not a trigger)
**Security**: DEFINER
**Logic**:
1. Validates role against whitelist
2. Verifies caller is admin (via auth.uid())
3. Updates profiles.role for the given email
4. Raises exception if no match
**Grants**: EXECUTE to authenticated only.

---

## Realtime Publications

Tables published to `supabase_realtime`:

| Table | Added In |
|-------|----------|
| orders | enable_orders_realtime.sql / 0022 |
| commandes_drive | 0010 |
| commandes_drive_lignes | 0010 |

RLS on `realtime.messages` (TS-07): orders events filtered by ownership or staff role.

---

## RLS Summary

### Permissive (POC -- anon full access)

These tables have `anon_all` or equivalent policies granting full CRUD to everyone. **This is technical debt for production hardening.**

- depots, produits, stock_par_depot, codes_barres_cartons, employes
- receptions, receptions_lignes, sorties_stock, transferts_inter_depots, inventaires_tournants
- commandes_drive, commandes_drive_lignes
- ventes_cashmag_import
- fournisseurs, bons_de_livraison, bons_de_livraison_lignes, alertes_surplus
- stock_edit_window, stock_edit_log
- recettes, recettes_ingredients, recettes_etapes, recettes_main_oeuvre
- productions, productions_inputs, productions_outputs, productions_couts_indirects

### Strict (Auth-based)

| Table | Pattern |
|-------|---------|
| profiles | Owner read/write, role column protected |
| orders | Owner read + staff read all; owner insert; staff update or owner cancel |
| pickup_slots | Public read only |
| products | Public read only |
| comptes_pro | Delegue read + admin/manager all + self-register insert |
| commandes_pro | Delegue read + admin/manager all |
| commandes_pro_lignes | Delegue read (via join) + admin/manager all |
| produits_pro_prix | Active pro-account read + admin/manager all |
| drive_ecarts_poids | Staff only (admin/manager/employee) |
| realtime.messages | Orders events filtered by ownership/role |
