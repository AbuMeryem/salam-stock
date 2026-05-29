# CONTEXT — Salam Stock (staff PWA)

Glossaire du langage métier utilisé dans ce dépôt. À utiliser tel quel dans le code, les issues, les titres de PR, les noms de tests. Les termes en **gras** sont canoniques — ne pas dériver vers des synonymes.

Pour le détail des flux, lire `/Users/mac/WORKFLOW.md` (bible cross-repo). Pour le détail des tables, lire `SCHEMA.md`.

---

## Architecture & versions

- **V2** — Architecture actuelle du staff PWA. Routes `/v2/*`. Mobile-first, auth par PIN, multi-dépôt, kanban realtime. C'est ce qu'on développe.
- **V1 / legacy `/staff/*`** — Routes dépréciées du staff. Conservées pour transition uniquement. Toute nouvelle feature doit aller en V2.
- **Drive (app)** — La PWA client `salamarket-drive` (Vite + React). Pair de cette app. Vit dans un autre dépôt mais partage le même Supabase.
- **Stock (app)** — Cette app. Le PWA staff `salam-stock` (Next.js 14 App Router).

## Acteurs

- **Employé** — Personne staff qui se connecte par **PIN**. Stockée dans la table `employes` avec `role` + `depot_id` principal.
- **Rôle staff** — Un de `admin` | `manager` | `reception` | `preparation` | `caisse`. Détermine la nav et les accès admin (cf. WORKFLOW §4).
- **PIN auth** — Code 4 chiffres par employé. Validation **client-only** en V2 (dette connue, server-side prévu V2.1).
- **Compte Pro** — Client B2B (table `comptes_pro`). Cycle `en_validation` → `actif` → `suspendu` | `archive`.

## Dépôts & stock

- **Dépôt** — Localisation physique. Type `point_vente` (Particulier, Professionnel) ou `entrepot` (Sodrune). Table `depots`.
- **Particulier** — Dépôt B2C, défaut Drive.
- **Professionnel** — Dépôt B2B Pro.
- **Sodrune** — Entrepôt central de stockage.
- **stock_par_depot** — Niveau de stock indépendant par produit × dépôt. Table éponyme. Toute mutation de stock passe par là.
- **Produit canonique** — Ligne de la table `produits` (FR, source de vérité backoffice). FK cible pour `stock_par_depot`, `commandes_drive_lignes`, `receptions_lignes`.
- **products (table)** — **Dette** : copie physique de `produits` côté Drive. Devrait être une vue (migration 0023 jamais appliquée). Doit rester synchronisée avec `produits` par UUID identique.

## Préparation Drive

- **Préparation Drive** — Flux staff `/v2/preparation` : kanban realtime des commandes Drive à préparer pour retrait magasin.
- **Kanban 4 colonnes** — `a_preparer` (rouge) → `en_preparation` (jaune) → `pret` (or) → `retire` (vert). Statut dans `commandes_drive.statut`.
- **Batch Pick** — Mode picking groupé sur `/v2/preparation`. Agrège toutes les lignes `a_preparer` par produit, liste de courses unique triée par rayon (froid d'abord). Alternative au kanban par commande.
- **Pesée** — Saisie du poids réel pour une ligne `unit_type=weight`. Recalcule `montant_reel_ttc`, déclenche la capture Stripe.
- **Écart action** — Décision automatique selon l'écart `estime` vs `réel` :
  - `auto_accept` (< 10%)
  - `preparator_decision` (10-20% ET < 5 EUR)
  - `client_notify` (10-20% ET ≥ 5 EUR)
  - `client_validation_required` (> 20%)
- **finalizePreparation** — Fonction qui insère les écarts dans `drive_ecarts_poids` puis appelle `/api/stripe/capture-payment`.

## Stripe

- **statut_paiement** — Colonne sur `commandes_drive` : `NULL` → `autorise` → `capture` | `libere` | `echec`.
- **Manual capture** — Mode Stripe utilisé pour Drive au poids : pré-autorisation à la commande, capture après pesée. PI actif 7 jours.
- **Pré-autorisation au poids** — Montant autorisé = `ceil(weightCents * 1.20) + otherCents`. Marge 20% sur lignes au poids uniquement.
- **drive_ecarts_poids** — Table qui trace chaque écart estimé/réel par ligne, avec action prise.

## Réception marchandise

- **BDL (Bon de Livraison)** — Bon prévu attendu avec fournisseur. Table `bons_de_livraison` + lignes. Permet réception contre bon avec détection d'écarts.
- **Réception libre** — Réception surprise sans BDL. Création à la volée. Mode alternatif au BDL.
- **Surplus** — Produit scanné présent au catalogue mais pas sur le BDL en cours. Déclenche `alertes_surplus` avec photo.
- **BR (Bon de Réception)** — PDF généré à la fin d'une réception (validée). Trace les quantités effectivement reçues.
- **EAN carton** — Code-barres carton qui mappe vers N unités via `codes_barres_cartons` (multiplicateur).
- **Apprentissage EAN** — Workflow déclenché sur EAN inconnu : carton ou unité ? IA reconnaissance produit en assistance.

## Sortie de stock

- **Sortie stock** — Déclaration de perte sur `/v2/sortie`. Type + quantité + photo preuve obligatoire + check cohérence IA. Table `sorties_stock`.
- **Type de sortie** — Un de : `casse_manipulation`, `casse_client`, `perime_dlc`, `perime_ddm`, `defaut_fournisseur`, `demarque_inconnue`, `autre`.
- **Démarque inconnue** — Type historique (remplace `vol_identifie` depuis migration 0002).
- **Cohérence IA** — Score 0-1 retourné par `/api/vision-coherence` (Claude). `< 0.6` → push admin "Sortie suspecte". `< 0.4` → urgent.

## Transferts inter-dépôts

- **Transfert inter-dépôts** — Mouvement de stock entre dépôts via `/v2/transfert`. Table `transferts_inter_depots`.
- **Routes autorisées** — Matrice contraignante hors admin : Particulier ↔ Professionnel, Sodrune ↔ Professionnel. Non-admin : destination = dépôt principal uniquement.

## Inventaire

- **Inventaire tournant** — Cycle count quotidien : 7 produits aléatoires assignés à 1 employé random par dépôt. Cron 9h Paris. Table `inventaires_tournants`.
- **Conformité** — Ratio compté / théorique. `< 95%` → push admin urgent.

## Labo (recettes & productions)

- **Recette** — BOM (bill of materials) sur `/v2/labo`. Ingrédients (FK `produits`), étapes, main d'œuvre, coût théorique. Tables `recettes_*`.
- **Production** — Lot exécuté à partir d'une recette. Inputs consommés, outputs produits, coûts indirects. Tables `productions_*`.
- **Marge Labo** — Dashboard analytics (marge EUR/jour, marge %/recette, période 7/30/90j). Vue `v_productions_kpi` (cassée, dette connue).

## Caisse & comptabilité

- **Cashmag** — POS physique magasin. Ventes importées par CSV via `/v2/admin/import-cashmag`. Table `ventes_cashmag_import`.
- **Z du jour** — Récap fiscal quotidien Drive (PDF/CSV/email). Cron 23h59. Route `/v2/admin/recap-fiscal`.
- **Rapport mensuel** — Récap consolidé Drive + Magasin (PDF/CSV/email). Cron 1er du mois 6h. Route `/v2/admin/rapport-mensuel`.

## Sync Drive ↔ Stock

- **Trigger forward** — `sync_drive_order_to_stock_trigger` : `orders` → `commandes_drive` (paid → a_preparer, ready → pret, etc.).
- **Trigger reverse** — `sync_stock_statut_to_drive` : `commandes_drive.statut` → `orders.status`.
- **Drive au poids bypass** — Les commandes Drive au poids sont créées directement dans `commandes_drive` par l'edge function (pas dans `orders`). Pas de row dans `orders`, trigger forward ne fire pas. Voulu.

## Notifications

- **Push (Web Push)** — VAPID, service worker `/sw.js`, abonnements dans `push_subscriptions` (variante Stock avec `employe_id`, `user_id` nullable). iOS doit être installé en PWA standalone (iOS 16.4+).
- **Resend** — Provider email. Récap mensuel + Z quotidien + email "commande prête".

## IA

- **Assistant IA** — Chat Claude pour requêtes business sur `/v2/admin/assistant-ia`. Endpoint `/api/assistant`.
- **Vision cohérence** — `/api/vision-coherence` : Claude vérifie photo vs déclaration sortie stock.
- **Vision reconnaissance** — `/api/vision-product-recognition` : Claude identifie un produit depuis photo carton.

---

35+ termes. Ajouter ici tout nouveau concept métier dès qu'il est nommé dans le code ou la doc.
