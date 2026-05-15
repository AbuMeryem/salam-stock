# MISSION_REPORT — Centralisation Staff + Drive au poids

> Mission du 2026-05-15. Échéance démo client : 2026-06-10 (J-26).
> Lire `POST_MISSION_AUDIT.md` AVANT ce rapport pour les détails
> de chaque hypothèse et la liste exacte des TODOs restants.

---

## Sommaire exécutif

| Métrique | Résultat |
|---|---|
| **Commits ajoutés** | 11 (salam-stock) + 6 (salamarket-drive) = **17** |
| **Fichiers créés/modifiés** | 13 (salam-stock) + 14 (salamarket-drive) = **27** |
| **Migration SQL livrée** | 0029_drive_au_poids.sql — non appliquée |
| **Tests Vitest** | 85/85 passants (drive-pesee 34 nouveaux) |
| **Build salamarket-drive** | ✅ vert (4,08 s) |
| **Build salam-stock** | ✅ vert (après fix tsconfig agent C) |
| **Push GitHub** | ❌ aucun (consigne respectée) |

---

## Décisions architecturales

### DA-1 — Centralisation Labo + Admin Pro DIFFÉRÉE post-démo

**Contexte (brief Mission 4A)** : déplacer 10 routes admin/labo depuis
`salamarket-drive` (Vite + React Router) vers `salam-stock` (Next.js
App Router).

**Arbitrage** : différer après la démo du 10 juin.

**Justifications** :
1. `salam-stock` n'a **pas** TanStack Query — tous les hooks à porter
   en server actions / SWR / useEffect+useState
2. `salam-stock` n'a **pas** shadcn/ui (`components/ui/` vide) — chaque
   page utilise extensivement button/card/dialog/select/table/badge
   à recoder
3. `salam-stock` n'a **pas** React Router — chaque `<Link to>` et
   `useNavigate` à convertir en `next/navigation`
4. `salam-stock` n'a **pas** Supabase Auth opérationnelle côté serveur
   (zustand-local) — toutes les pages protégées à re-câbler
5. Effort estimé : **6-10 h** pour 10 routes
6. Bénéfice immédiat pour la démo du 10 juin : **nul**. Les routes
   actuelles dans salamarket-drive fonctionnent (RLS labo fixée le
   2026-05-15, seeds en base, tests verts).

**Risque évité** : laisser une migration à mi-chemin = **deux versions
cassées** à 26 jours du RDV.

**Validation utilisateur** : oui (message explicite du 2026-05-15).

**Fenêtre dédiée** : à planifier post-10-juin (estimé 1 journée de
focus pleine).

### DA-2 — Migration 0029 commitée mais NON appliquée

La migration `0029_drive_au_poids.sql` est commitée dans
`/Users/mac/salamarket-drive/supabase/migrations/` (commit `3d76c17`)
mais **pas appliquée** sur l'instance Supabase. Décision conforme au
brief.

L'utilisateur l'appliquera manuellement via SQL Editor (le fichier est
idempotent, sûr à rejouer). Cf. POST_MISSION_AUDIT Q2 pour le contenu
complet.

### DA-3 — Stripe TEST MODE verrouillé au runtime

`lib/stripe.ts` côté salam-stock throw au démarrage si `STRIPE_SECRET_KEY`
ne commence pas par `sk_test_`. Verrou anti-incident avant la démo.

Conséquence : pour passer en LIVE plus tard, retirer ce check (1 ligne).

### DA-4 — Branche salam-stock `chore/drive-products-view`

Les 11 commits salam-stock sont sur la branche pré-existante
`chore/drive-products-view`, pas sur `main`. Cette branche était déjà
en avance de 2 commits (`feat(db): migration 0024 — production traiteur`
et `feat(view): vue products mappant produits`). À merger avant prod —
cf. TODO Q7.

### DA-5 — Catalogue dual products / produits maintenu

Les colonnes weight ajoutées par 0029 vont sur **les deux tables**.
Aucune migration de fusion. Vie en parallèle pour la démo, à
réconcilier (vue ou trigger) post-démo.

### DA-6 — Auth `/staff/*` côté salam-stock en mode dégradé

Le layout `app/staff/layout.tsx` utilise un client component + Zustand
local au lieu d'un server component + Supabase Auth, car salam-stock
n'a pas Supabase Auth câblée côté serveur. À fixer avant prod (cf. Q7).

---

## Modifications par repo

### Repo : `/Users/mac/salam-stock`

| Fichier | Type | Lignes | Auteur |
|---|---|---|---|
| `lib/stripe.ts` | nouveau | 25 | Agent A |
| `lib/drive-pesee.ts` | nouveau | 46 | Agent A |
| `app/api/stripe/create-payment-intent/route.ts` | nouveau | ~120 | Agent A |
| `app/api/stripe/capture-payment/route.ts` | nouveau | ~100 | Agent A |
| `app/api/stripe/webhook/route.ts` | nouveau | ~85 | Agent A |
| `.env.local.example` | nouveau | 4 | Agent A |
| `tsconfig.json` | modifié (exclude supabase/functions) | +2 | Agent C |
| `app/staff/layout.tsx` | nouveau | ~50 | Agent C |
| `app/staff/preparation/page.tsx` | nouveau | ~180 | Agent C |
| `app/staff/preparation/[id]/page.tsx` | nouveau | ~120 | Agent C |
| `app/staff/preparation/components/PreparationWorkflow.tsx` | nouveau | ~380 | Agent C |
| `app/staff/preparation/components/types.ts` | nouveau | ~30 | Agent C |
| `lib/staff/preparation-actions.ts` | nouveau | ~150 | Agent C |
| `POST_MISSION_AUDIT.md` | nouveau | 400 | main |
| `MISSION_REPORT.md` | nouveau | ce fichier | main |
| `DEMO_SCRIPT.md` | nouveau | (à venir) | main |
| `package.json` | modifié (+stripe@22.1.1) | +1 | Agent A |

### Repo : `/Users/mac/salamarket-drive`

| Fichier | Type | Lignes | Auteur |
|---|---|---|---|
| `supabase/migrations/0029_drive_au_poids.sql` | nouveau | 200 | main |
| `BLOCKERS.md` | nouveau | 100 | main |
| `src/integrations/supabase/types.ts` | modifié (+weight columns sur products) | +15 | main |
| `src/types/product.ts` | modifié (ProductUnitType + champs weight) | ~20 | Agent B |
| `src/lib/drive-pesee.ts` | nouveau | 138 | Agent B |
| `src/hooks/useProducts.ts`, `useProduct.ts` | modifiés (fetch weight cols) | ~10 | Agent B |
| `src/components/ProductCard.tsx` | modifié (badges weight/bracket) | ~30 | Agent B |
| `src/stores/cartStore.ts` | modifié (CartItem + version 2 persist) | ~50 | Agent B |
| `src/pages/Cart.tsx` | modifié (kg input + bandeau pré-auto) | ~80 | Agent B |
| `src/pages/ProductDetail.tsx` | modifié (kg stepper / brackets) | ~80 | Agent B |
| `src/pages/Checkout.tsx` | modifié (Stripe Elements CTA) | ~40 | Agent B |
| `src/pages/DriveAuPoids.tsx` | nouveau (page éducation) | ~250 | Agent B |
| `src/components/DriveStripePayment.tsx` | nouveau | ~120 | Agent B |
| `src/App.tsx` | modifié (route /drive-au-poids lazy) | +2 | Agent B / user |
| `src/test/drive-pesee.test.ts` | nouveau (34 tests) | 278 | main |
| `.env.local.example` | nouveau | 2 | Agent B |
| `package.json` | modifié (+@stripe/stripe-js, +@stripe/react-stripe-js) | +2 | Agent B |

---

## Commits (chrono inverse, par repo)

### `/Users/mac/salam-stock` (11 commits, branche `chore/drive-products-view`)

```
e0c7c9e docs: POST_MISSION_AUDIT 8 questions critiques
f935912 feat(staff/preparation): détail commande + workflow pesée + capture Stripe
0617fb5 feat(staff/preparation): layout staff + liste commandes Drive à préparer
9a1b3df fix(tsconfig): exclude supabase/functions (Deno runtime, hors compilation Next)
0a52d33 feat(stripe): route webhook (réconciliation statut_paiement)
5d4f9c0 feat(stripe): route capture-payment (capture après pesée)
2c9cc76 feat(stripe): route create-payment-intent (pré-auto manual capture)
839ece5 feat(stripe): client serveur + helpers compute pour Drive au poids
```
(2 commits pré-existants `6b52e9f` et `779656f` non inclus dans la
mission mais visibles sur la même branche)

### `/Users/mac/salamarket-drive` (6 commits, branche `main`)

```
b2524ea test(drive-pesee): 34 tests sur calculs poids + écarts + pré-auto
86b3d92 feat(drive-au-poids): page éducation client
3a822de feat(checkout): Stripe Elements + manual capture intent
5702c40 feat(panier): saisie poids estimé + bandeau pré-autorisation
2d2740e feat(catalogue): affichage prix selon unit_type
eb655d9 types(supabase): ajoute colonnes weight sur products
3d76c17 feat(drive-pesee): migration DB schéma poids variable
```

---

## Health checks

| Commande | Repo | Résultat |
|---|---|---|
| `npm run build` | salamarket-drive | ✅ vert, 4,08 s, chunks split lazy |
| `npm run test` | salamarket-drive | ✅ **85/85** passants (5 fichiers : example, tva, format, recettes-kpi, drive-pesee) |
| `npm run build` | salam-stock | ✅ vert (après fix tsconfig agent C qui exclut `supabase/functions/` Deno) |
| `npx tsc --noEmit` | salam-stock | ✅ 0 erreur sur les fichiers livrés ; 1 erreur pré-existante (`useEmployeeOrders.ts` côté drive — hors scope cette mission) |
| `npm run lint` | salamarket-drive | 7 erreurs + 8 warnings pré-existantes (hors fichiers livrés) |

---

## Routes & captures texte

### Drive Particulier (`/Users/mac/salamarket-drive`)

| URL | Statut | Capture (descriptif) |
|---|---|---|
| `/` (Home) | ✅ inchangée | Comportement actuel ; ProductCard détecte unit_type et ajoute un badge "Au poids" si pertinent |
| `/produit/:id` | ✅ adaptée weight | Pour `weight` : kg-stepper (step 0,1, min 0,1, max 5). Pour `weight_bracket` : 3 cards radio. Sticky CTA bottom mobile. |
| `/panier` | ✅ adaptée weight | Bandeau jaune-paille "Vous serez débité du poids réellement préparé". Input kg éditable par ligne weight. Lien vers `/drive-au-poids`. |
| `/paiement` (Checkout) | ✅ Stripe Elements + manual capture | Affiche "Pré-autoriser X €" (estimé × 1,20). `<DriveStripePayment>` créé. Actif uniquement quand le backend renvoie `commande_id` (cf. TODO câblage). |
| `/drive-au-poids` | ✅ nouvelle page | Hero, 3 étapes (commander → peser → débité), exemple chiffré merguez 18 €/kg → 21,60 € autorisé → 19,26 € débité, FAQ 4 questions. |

### Labo + Admin Pro (`/Users/mac/salamarket-drive`)
Inchangés depuis le 2026-05-15. RLS fixée, seeds appliqués. Cf.
`DEMO_BRIEF.md` pour le détail.

### Staff (`/Users/mac/salam-stock`)

| URL | Statut | Capture |
|---|---|---|
| `/staff/preparation` | ✅ liste filtrable | H1 "Commandes à préparer", 3 pills filtre créneau, grille cards rounded-2xl. Chaque card : numéro, client, créneau, montants estimé/autorisé, "X lignes". Click → détail. |
| `/staff/preparation/[id]` | ✅ workflow pesée | Détail commande, stats 3-grid (estimé/autorisé/réel pesé), liste lignes avec UI selon unit_type : checkbox (unit), input kg (weight), 3 radio (bracket). Badge écart live (vert<10%/orange/rouge>20%). Footer sticky "Finaliser & capturer". |

---

## Limitations connues (par ordre d'urgence pour la démo)

1. **Trigger sync `orders` → `commandes_drive`** : à vérifier qu'elle
   tourne bien (migrations 0008/0009/0017 côté salam-stock). Sans elle,
   les commandes salamarket-drive ne remontent jamais dans
   `/staff/preparation`. **À diagnostiquer en priorité.**

2. **Câblage checkout Stripe Elements** : `<DriveStripePayment>` créé
   par Agent B mais le checkout actuel renvoie `checkout_url` (Stripe
   Checkout hosted) plutôt que `commande_id`. Le backend
   `create-checkout-session` côté salamarket-drive doit être modifié
   pour renvoyer `commande_id` quand le panier contient une ligne
   weight, déclenchant le flow manual capture.

3. **Supabase Auth côté salam-stock** : non câblée côté serveur.
   `/staff/*` actuel utilise zustand local. La capture Stripe
   ne fonctionnera pas tant que `currentUser.id` n'est pas un vrai
   UUID Supabase (la route `/api/stripe/capture-payment` rejette les
   non-UUID en 401, par sécurité).

4. **Pas de balance physique** : saisie manuelle kg. À brancher
   WebHID/WebSerial post-démo.

5. **Pas d'email/SMS sur écart > 20 %** : seul le badge UI
   `client_validation_required` est affiché côté préparateur.

6. **Real-time updates absent** sur `/staff/preparation` : bouton
   "Rafraîchir" manuel.

7. **Centralisation différée** : Labo + Admin Pro restent dans
   salamarket-drive (cf. DA-1).

---

## TODOs avant le 10 juin (résumé — détails dans POST_MISSION_AUDIT Q7)

Effort total estimé : **6-10 h**

🔴 Bloquant démo :
- [ ] Appliquer migration 0029 (5 min)
- [ ] Remplir clés Stripe TEST + webhook secret (15 min)
- [ ] Vérifier/réparer trigger `orders` → `commandes_drive` (1-2 h)
- [ ] Câbler `<DriveStripePayment>` au checkout salamarket-drive (1-2 h)
- [ ] Seeder 3 produits weight + 1 weight_bracket (20 min)
- [ ] Test end-to-end TEST mode (1 h)

🟡 Souhaitable démo :
- [ ] Câbler Supabase Auth dans salam-stock pour `/staff/*` réel (2-4 h)
- [ ] Email post-prep client via Resend (déjà installé) (2-3 h)
- [ ] Merger `chore/drive-products-view` → `main` côté salam-stock (10 min)

❌ Reporté post-démo :
- Centralisation Labo + Admin Pro (6-10 h)
- Balance physique USB
- SMS sur écart
- Tests E2E Playwright
- Real-time updates `/staff/preparation`
