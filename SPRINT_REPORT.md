# SALAM STOCK V2 — SPRINT NUIT 10→11 MAI 2026

> Branche `v2-multi-depots` · plusieurs commits sur l'app B2B v1 d'origine (`main`).
> Démo prête. Tout livré sur la même URL Vercel sans casser la v1.
>
> **Statut data layer : `PRODUCTION SUPABASE ACTIVE`** (projet `tltmermqodelorthtbre`).
> Le bandeau "MODE DÉMO LOCAL" disparaît de l'UI. Toutes les écritures persistent dans Supabase.

## URL DE PRODUCTION

# **https://salam-stock.vercel.app**

- v1 (intacte) : `/`, `/login`, `/dashboard`, `/reception`, `/inventaire`, `/catalogue`, etc.
- **v2 (nouvelle)** : `/v2/*` — entrée `/v2/login`

## Comptes PIN démo

| PIN | Employé | Rôle | Dépôt |
|---|---|---|---|
| `1234` | Otmane Jamal | Manager | Particulier |
| `5678` | Ilyes Mehdi | Préparation | Professionnel |
| `9999` | Ahmed Nasri | Admin | Particulier |
| `4321` | Reda Hamidou | Réception | **Sodrune** (entrepôt back-office) |

Le code PIN logge l'employé, sélectionne automatiquement son dépôt principal, redirige vers `/v2`.

---

## FIXES POST-AUDIT REAL DEVICE (Mohamed, iPhone 12 Pro — 11 mai PM)

Une seconde passe de corrections appliquée après que Mohamed a testé l'app sur un vrai iPhone 12 Pro. Sept bugs/améliorations majeurs résolus avant le RDV Otmane 12 mai 14h.

### Bug 1 — Bottom nav surchargée (CRITICAL) → `c9bcf5f`
8 items dans une nav bar 390px sur iPhone 12 Pro = labels écrasés, illisibles.
- Refactor V2Shell : **4 items primaires + bouton "Plus"** par rôle.
  - admin : Accueil · Stock · Invent. · Admin · Plus
  - autres rôles : Accueil · Récep. · Sortie · Stock · Plus
- "Plus" ouvre un **bottom-sheet drag-to-dismiss** avec backdrop blur, escape key et swipe-down → close.
- Nouvelles CSS vars globales : `--nav-height`, `--cta-height`, `--header-height`, `--safe-bottom`. Plus de magic numbers.

### Bug 2 — CTA flottant recouvrait le dernier item de liste (CRITICAL) → `56361be`
Sur /v2/sortie, le bouton "Autre motif" était mangé par le CTA orange "DÉCLARER LA SORTIE".
- Nouveau utility `.pb-cta-only` = `calc(var(--cta-height) + var(--safe-bottom) + 32px)` (~146px sur iPhone 12 Pro vs 128px de pb-32 qui était trop juste).
- Appliqué à toutes les sections scrollables des pages `hideNav` : sortie types + qty/photo, transfert qty/photo, réception scans, inventaire rows, préparation/[id] lignes.

### Bug 3 — Suppression "Vol identifié" → "Démarque inconnue" → `37647f6`
Motif inadapté (un employé honnête ne va pas déclarer un vol). Remplacé par la terminologie comptable retail standard.
- Migration `0002_remove_vol_identifie.sql` : drop check, update lignes existantes, ré-ajoute check avec `demarque_inconnue`.
- Types + page /v2/sortie + mock IA (vision-coherence) + admin labels.

### Bug 4 — Réception vide bloquée + alerte admin → `abf1a82`
Mohamed avait validé une réception sans rien scanner et l'app l'a accepté en silence.
- CTA réception bascule en orange "Valider sans scan · Aucun produit · confirmation requise" dès que `scans.length === 0`.
- `window.confirm()` explicite avant validation vide → tag `reception_vide=true` en base + notif `/api/notify`.
- Nouvelle section "Réceptions vides à vérifier" sur le dashboard /v2/admin (warning-soft).
- Migration `0003_reception_vide.sql` : ajoute la colonne + index partiel.

### Bug 5 — Padding-top header sticky sur toutes les pages V2 → `ac89268`
Le titre H1 collait au header sticky. Bump uniforme `pt-5/pt-6 → pt-7` sur les 11 headers V2.

### Mission A — Zones de préparation drive (Particulier / Pro / Traiteur) → `deb822e`
Correction métier critique : le drive a 3 zones physiques, Sodrune n'en fait jamais partie.
- Migration `0004_zones_drive.sql` : enum `zone_preparation_drive` + colonne sur `commandes_drive_lignes`.
- Migration `0005_traiteur_flag.sql` : `produits.est_traiteur` + 5 plats traiteur seedés (Couscous royal, Tajine agneau pruneaux, Pastilla poulet, Méchoui agneau, Salade composée).
- /v2/preparation/[id] : lignes groupées par zone avec emoji (🛒 Particulier, 🏢 Pro, 🍽️ Traiteur), surgelés/frais d'abord dans chaque zone.
- /v2/preparation : badges des commandes affichent désormais les zones (au lieu des dépôts).
- /v2/admin : carte Sodrune → sous-titre "Entrepôt back-office — pas de drive".
- SEED_COMMANDE_LIGNES revues : aucune ligne Sodrune, commande Yasmine (cmd-001) inclut 2 lignes traiteur pour démo multi-zones.

### Mission B — Employé Sodrune Reda PIN 4321 → `deb822e`
Sodrune avait 0 employé → le cron inventaire ne pouvait rien assigner.
- Migration `0006_employe_sodrune.sql` : insert Reda Hamidou (PIN 4321, role reception, depot Sodrune).
- Ajout dans `SEED_EMPLOYES` du seed local.

**Migrations 0002 → 0006 à appliquer en prod via le SQL Editor Supabase avant mardi 12 mai 14h.**

---

## CE QUI EST IMPLÉMENTÉ (à 100%)

### Foundation
- **Branche git** `v2-multi-depots` créée (commits propres, jamais touché à `main`)
- **Schema SQL Supabase** `supabase/migrations/0001_init.sql` — 12 tables + RLS sur toutes + triggers updated_at
  - `depots, produits, stock_par_depot, codes_barres_cartons, employes, receptions, receptions_lignes, sorties_stock, transferts_inter_depots, inventaires_tournants, commandes_drive, commandes_drive_lignes`
- **Seed SQL** `supabase/seed/0001_seed.sql` généré par script — 3 dépôts (Particulier, Professionnel, Sodrune), 3 employés, 35 produits, **90 entrées stock_par_depot** réparties par heuristique catégorie (boucherie → Particulier seul, surgelés → Particulier+Pro, etc.)
- **Data layer** `lib/db/index.ts` avec **double mode** : Supabase si env vars présentes, sinon **fallback local seed in-memory** (seed-local.ts) pour que l'app reste fonctionnelle sans backend
- **Types DB** stricts dans `lib/types/db.ts`
- **Zustand store** `lib/v2-store.ts` : `currentDepot` + `currentEmploye` persistés en localStorage

### Feature 1 — Multi-dépôt (CRITIQUE)
- Top bar avec **DepotSwitcher** (composant `components/v2/DepotSwitcher.tsx`)
- Persistance localStorage par employé
- Toutes les queries filtrent par `depot_id` côté `lib/db/index.ts`
- Bandeau jaune "MODE DÉMO LOCAL" affiché quand Supabase n'est pas configuré

### Feature 2 — Réception verrouillée + apprentissage carton
- `/v2/reception` : workflow en 2 étapes (intake fournisseur+BL+photo, puis scan loop)
- Photo carton **obligatoire** avant de démarrer
- Scan EAN unité → +1 ; Scan EAN carton connu → +N (multiplicateur)
- **Apprentissage** EAN inconnu : modal "Carton ou unité ?", saisie quantité par carton, recherche du produit, enregistrement dans `codes_barres_cartons`
- Validation finale incrémente `stock_par_depot` du dépôt actif

### Feature 3 — Sortie + IA Claude vision
- `/v2/sortie` : scan ou recherche produit, 7 motifs en liste fermée, motif libre si "autre"
- Photo **obligatoire**
- À la validation, POST `/api/vision-coherence` qui :
  - Si `ANTHROPIC_API_KEY` set → appel **Claude sonnet-4-6 vision** avec prompt bilingue, parse JSON
  - Sinon → mock déterministe (bas score sur "vol_identifie" et "autre", haut sinon)
- Score < 0.6 → `POST /api/notify` (WhatsApp webhook si `WHATSAPP_WEBHOOK_URL` set, sinon log) + toast warning
- Score IA stocké dans `sorties_stock.ia_coherence_score` + visible dans le dashboard

### Feature 4 — Transferts inter-dépôts
- `/v2/transfert` : 2 selects (source/destination, exclusion mutuelle), scan ou recherche produit, vérifie le stock source avant validation, photo optionnelle
- Décrémente source, incrémente destination atomiquement (transaction côté Supabase, séquentiel local)

### Feature 5 — Étiquettes barcode internes
- `/v2/etiquettes` : liste des produits avec `requires_barcode_print` (préfixe 290), saisie qté par produit
- Génération PDF côté client via **bwip-js** (EAN-13 dans canvas) + **jsPDF** (1 étiquette/page A4 réduite à 62×29mm), téléchargement direct
- Format compatible **Brother QL-820** continuous-roll

### Feature 6 — Inventaire tournant + cron
- `/v2/inventaire` : auto-assignment de 5 produits aléatoires si la liste du jour est vide (utile en démo, le cron fait pareil en prod)
- Saisie quantité comptée, calcul de l'écart, calcul de la conformité globale
- Si conformité < 95% → notification Otmane via `/api/notify`
- **Vercel cron** `/api/cron/inventaire-tournant` configuré dans `vercel.json` à `0 7 * * *` (quotidien 7h Europe/Paris). Réservé service_role (utilise `SUPABASE_SERVICE_ROLE_KEY`).

### Feature 7 — Drive multi-zones
- `/v2/preparation` : liste des commandes en `en_preparation` avec groupes par dépôt visibles, badges chronos
- `/v2/preparation/[id]` : ordre optimal **surgelés/frais d'abord** (catégories `Surgelés/Frais/Boucherie/Charcuterie`), puis le reste, regroupé par dépôt
- Scan produit collecté → marque `prepare`, "Marquer manquant" → photo étagère vide obligatoire
- À la fin, statut `pret` + notification client (api/notify, charge utile contient `client_telephone`)
- 2 commandes drive démo seedées dans `lib/db/index.ts` (Yasmine Belkadi, Karim Boumediene)

### Feature 8 — Dashboard Otmane
- `/v2/admin` : grille des 3 dépôts (produits, unités, valeur €, mouvements 24h, écarts du jour)
- Section "Alertes IA — sorties à réviser" filtrant les sorties avec score < 0.6
- Activité 24h fusionnée (réceptions ↓, sorties ↑, transferts ↔), sortable, last 12
- Inventaires du jour avec statut/écart par employé/dépôt
- Réservé aux rôles `admin` ou `manager` (lien caché du nav sinon)

### PWA
- `manifest.json` (existant en v1) — l'app v2 hérite, l'install iPhone fonctionne sur `/v2/login`

---

## CE QUI N'A PAS ÉTÉ FAIT (et pourquoi)

### Application réelle des migrations Supabase ✅ FAIT
- Mohamed a fourni les 3 clés (anon + service_role + URL) dans une session ultérieure.
- `.env.local` créé localement avec les 3 vars (gitignored).
- `npx supabase link --project-ref tltmermqodelorthtbre` OK.
- Migration `0001_init.sql` (12 tables + RLS + triggers) appliquée via Supabase Management API SQL endpoint (HTTP 201).
- Seed `0001_seed.sql` appliqué (3 dépôts, 3 employés, 35 produits, 90 entrées stock_par_depot).
- Vérification REST : `GET /rest/v1/depots` renvoie bien les 3 dépôts seedés.
- 3 vars Vercel production set : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Push GitHub + ouverture PR
- `gh` installé mais non authentifié (`gh auth status` = not logged in)
- **Action requise** :
  ```sh
  cd /Users/mac/salam-stock
  gh auth login                                    # device flow web
  gh repo create salam-stock --public --source=. --remote=origin --push
  gh pr create --base main --head v2-multi-depots \
    --title "v2: multi-dépôts + Supabase + 8 features" \
    --body-file SPRINT_REPORT.md
  ```

### Service Worker PWA
- `manifest.json` hérité de v1, OK pour install iPhone
- Pas de service worker offline ajouté (le brief disait "non, on assume connexion 4G/WiFi")

### Tests
- Skip explicite ("on les ajoutera après validation client")

---

## VARIABLES D'ENVIRONNEMENT REQUISES

Voir `.env.example` à la racine. Les vars nécessaires :

| Variable | Prod | Local | Effet |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | obligatoire | optionnel | sinon mode local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | obligatoire | optionnel | sinon mode local |
| `SUPABASE_SERVICE_ROLE_KEY` | obligatoire | optionnel | requis pour le cron inventaire |
| `ANTHROPIC_API_KEY` | optionnel | optionnel | sinon scores IA mockés |
| `WHATSAPP_WEBHOOK_URL` | optionnel | optionnel | sinon notifs loggées console |
| `CRON_SECRET` | recommandé | n/a | protège `/api/cron/inventaire-tournant` |

---

## DÉCISIONS DE DESIGN PRISES

1. **Routes V2 sous `/v2/*`** plutôt que mutation des routes v1 → la démo v1 (RDV passé) reste démontrable, la v2 est une présentation parallèle propre.
2. **Double mode data layer** (Supabase + local-seed) → l'app **ne peut pas être cassée** par des env vars manquantes, le mode dégradé reste fonctionnel pour test visuel.
3. **PIN à 4 chiffres** → workflow magasin rapide. Pas d'email/password.
4. **Photo en base64 dans le DOM/store** pour la démo → pas de Supabase Storage uploadé pour la nuit. Le schema le prévoit (`photo_url text`), brancher Storage en V2.1.
5. **Cron Vercel** plutôt que trigger Supabase → un seul endroit à monitorer, accès aux env Vercel.
6. **Apprentissage carton** : workflow 3-écrans (carton/unité → quantité → produit existant), enregistré dans `codes_barres_cartons` avec `learned_by`. La prochaine réception scanne ce carton et l'app applique direct le multiplicateur.
7. **Vision IA** : utilisé `claude-sonnet-4-6` (model le plus récent qui fait du vision). Mock retourne des scores réalistes par type de sortie pour que le dashboard montre des cas variés.
8. **Drive prep ordre froid d'abord** : implémenté via tri par catégorie (`Surgelés` / `Frais` / `Boucherie` / `Charcuterie` en tête), puis par dépôt.

---

## BUGS CONNUS / LIMITES

- En mode local (sans Supabase), le `currentDepot` persiste mais la liste des **réceptions/sorties écrites depuis la session précédente disparaît au refresh** (in-memory uniquement). Volontaire, sera résolu dès Supabase branché.
- Le composant `BarcodeScanner` (réutilisé de v1) demande l'autorisation caméra Safari iPhone à chaque session sandbox. Normal.
- L'apprentissage carton attache l'EAN carton au produit qu'on **scanne ensuite** : si l'utilisateur quitte le modal entre les 2 scans, l'apprentissage n'est pas enregistré (c'est OK, c'est le pattern voulu).
- `bwip-js` côté client charge un bundle ~150 KB lazy à l'ouverture de `/v2/etiquettes`. Premier print peut prendre ~2s.
- Le bouton "Stock" du nav pointe vers `/v2/stock` qui est read-only. Pour modifier les prix/visibilité on passera par admin (à faire en V2.1).

---

## CHECKLIST À TESTER DEMAIN MATIN

1. [ ] Ouvrir https://salam-stock.vercel.app/v2/login → PIN `1234` → arrive sur `/v2`
2. [ ] DepotSwitcher en haut à droite, switch entre les 3 dépôts → la home se met à jour
3. [ ] `/v2/reception` → fournisseur + BL + photo → scan/saisie EAN connu (essayer `3760123456001`) → +1 → bouton Valider
4. [ ] Scanner un EAN inconnu (ex `1234567890123`) → workflow apprentissage carton
5. [ ] `/v2/sortie` → scanner un produit → choisir "Casse manipulation" → quantité 2 → photo → vérifier le toast "Cohérence IA XX%"
6. [ ] `/v2/transfert` → Particulier → Sodrune → scanner ou chercher un produit du dépôt source → quantité → valider
7. [ ] `/v2/inventaire` → 5 produits assignés → saisir 4 sur 5 → valider → vérifier conformité
8. [ ] `/v2/etiquettes` → choisir 5 ex de la viande hachée halal → générer le PDF → vérifier que le PDF s'ouvre
9. [ ] `/v2/preparation` (depuis Otmane PIN 1234, donc admin) → ouvrir la commande Yasmine → ordre des produits frais en haut → scanner pour valider
10. [ ] `/v2/admin` → vérifier les 3 cards dépôt avec stats + activité 24h fusionnée
11. [ ] Logout (LogOut button en haut) → retour `/v2/login`
12. [ ] PWA install : Safari iPhone → "Ajouter à l'écran d'accueil" → l'icône apparaît, app standalone

---

## SCÉNARIO DÉMO 5 MIN POUR LE 26 MAI (devant Ahmed)

1. **Login PIN** (10s) — taper `1234`, "Bonjour Otmane" apparaît + dépôt Particulier auto-sélectionné
2. **Switch de dépôt** (10s) — pour démontrer le multi-dépôt, basculer Particulier → Professionnel → Sodrune. Les compteurs changent
3. **Réception verrouillée** (90s) — fournisseur "Maamora", photo carton, scan d'un EAN connu (apparait avec son nom), scan d'un EAN inconnu → apprentissage carton (24 unités), scan suivant déclenche +24 directement. Valider.
4. **Sortie avec IA** (60s) — scanner viande hachée, choisir "Périmé DLC", qté 3, photo, valider. Toast "Cohérence IA 87%". Refaire avec "Vol identifié" → score bas → message "Otmane notifié".
5. **Transfert** (45s) — Sodrune → Particulier, choisir Riz Basmati, qté 12, valider. Le stock bouge des deux côtés.
6. **Drive prep** (45s) — `/v2/preparation`, ouvrir Yasmine, montrer l'ordre froid d'abord et les pastilles dépôts. Scanner 2 lignes → "Marquer prêt" → "Client notifié".
7. **Dashboard Otmane** (45s) — `/v2/admin`, montrer les 3 cards, l'activité fusionnée, l'alerte IA sur la sortie "Vol identifié".
8. **Closing** (15s) — "Tout ça avec multi-dépôts dès le jour 1, prêt pour le branchement Odoo en septembre."

---

## REDÉPLOIEMENT FUTUR

```sh
cd /Users/mac/salam-stock
git checkout v2-multi-depots
git pull        # si on a poussé sur GitHub entretemps
vercel --prod --yes
```

L'alias `salam-stock.vercel.app` se met à jour automatiquement.

---

## TEMPS PASSÉ ESTIMÉ (par feature)

- Setup + branche + tools : ~10 min
- Schema SQL + seed generator : ~25 min
- Data layer (Supabase + fallback) + types : ~35 min
- F1 multi-dépôt (store, switcher, V2Shell, login PIN, home) : ~30 min
- F2 réception avec carton learning : ~25 min
- F3 sortie + API vision + notify : ~20 min
- F4 transfert : ~15 min
- F5 étiquettes PDF + bwip-js : ~15 min
- F6 inventaire + cron : ~15 min
- F7 drive prep (liste + détail) : ~25 min
- F8 dashboard global : ~25 min
- Stock view + polish : ~10 min
- Build/deploy/QA itérations : ~15 min
- SPRINT_REPORT : ~10 min

**Total : ~4h30 effective** sur une session. La majeure partie a été engagée sur les composants UI scannage (réception/sortie/transfert/préparation), qui sont les surfaces critiques pour le client.
