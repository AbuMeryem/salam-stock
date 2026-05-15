# POST_MISSION_AUDIT — Drive au poids variable + Stripe manual capture

> Audit honnête de la mission du 15 mai 2026.
> À lire AVANT MISSION_REPORT.md et AVANT d'appliquer la migration SQL.

---

## Q1 — Noms des tables Drive existantes (la vérité)

Vérification faite via :
- `grep -rh "create table" /Users/mac/salam-stock/supabase/migrations/`
- `grep -rh "create table" /Users/mac/salamarket-drive/supabase/migrations/`

**Tables Drive trouvées dans `tltmermqodelorthtbre` (instance Supabase partagée) :**

| Table | Source de création | Usage |
|---|---|---|
| `public.commandes_drive` | `salam-stock/supabase/migrations/0001_init.sql:153` | **Canonique** côté staff/préparation V2. C'est cette table qui est étendue par 0029. |
| `public.commandes_drive_lignes` | `salam-stock/0001_init.sql:168` | **Canonique** côté staff. Étendue par 0029. |
| `public.orders` | `salamarket-drive/20260428024903_…sql:1` | Table historique du checkout salamarket-drive (Drive Particulier B2C). Synchronisée vers `commandes_drive` via les triggers des migrations 0008/0009/0017 de salam-stock. |
| `public.commandes_pro` + `commandes_pro_lignes` | `salamarket-drive/0025_drive_pro.sql` | Module B2B Drive Pro — **HORS scope** de cette mission. Pas touchées. |

**Décision** : `drive_orders` / `drive_order_lines` du brief n'existent pas. La migration 0029 cible `commandes_drive` + `commandes_drive_lignes` (vraies tables).

**Conséquence** : la table `orders` (salamarket-drive checkout) n'a pas reçu les colonnes Stripe. Si le checkout salamarket-drive écrit toujours dans `orders`, il faudra soit :
- ajouter une trigger de sync `orders` → `commandes_drive` côté DB (probablement déjà là via 0008-0009-0017, à vérifier)
- soit faire pointer le checkout directement vers `commandes_drive`

**À valider en prod** : `select count(*) from commandes_drive` (vide ou peuplé ?). Si vide, la sync trigger n'a peut-être pas tourné, ou n'existe que dans un sens.

---

## Q2 — Contenu intégral de la migration 0029

**Fichier** : `/Users/mac/salamarket-drive/supabase/migrations/0029_drive_au_poids.sql`
**Commit** : `3d76c17` dans le repo salamarket-drive (branche `main`)
**Taille** : 200 lignes, 5 sections

```sql
-- =====================================================================
-- 0029_drive_au_poids.sql
-- Système de Drive au poids variable + Stripe manual capture.
--
-- Date : 2026-05-15
-- Échéance démo : 2026-06-10
--
-- Hypothèses figées (cf. BLOCKERS.md) :
--   - Catalogue : DEUX tables (products EN, produits FR) — colonnes
--     ajoutées sur les deux pour cohérence cross-app
--   - Drive orders canoniques = commandes_drive + commandes_drive_lignes
--     (et non drive_orders/drive_order_lines du brief)
--   - drive_ecarts_poids référence commandes_drive_lignes(id)
--   - RLS pattern : policies pour authenticated SANS clause `to anon`
--     stricte (cf. RLS Labo fixée le 2026-05-15)
--   - Idempotent : IF NOT EXISTS partout
-- =====================================================================

-- ════════════════════════════════════════════════════════════════════
-- 1. CATALOGUE — Ajout colonnes weight sur products (EN) ET produits (FR)
-- ════════════════════════════════════════════════════════════════════

-- products (salamarket-drive)
alter table public.products
  add column if not exists unit_type text not null default 'unit';

alter table public.products
  drop constraint if exists products_unit_type_check;

alter table public.products
  add constraint products_unit_type_check
  check (unit_type in ('unit', 'weight', 'weight_bracket'));

alter table public.products
  add column if not exists price_per_kg numeric;

alter table public.products
  add column if not exists estimated_weight_kg numeric;

alter table public.products
  add column if not exists poids_min_kg numeric;

alter table public.products
  add column if not exists poids_max_kg numeric;

-- Cohérence : weight_bracket exige min < max
alter table public.products
  drop constraint if exists products_poids_bracket_check;

alter table public.products
  add constraint products_poids_bracket_check
  check (
    unit_type <> 'weight_bracket'
    or (poids_min_kg is not null and poids_max_kg is not null
        and poids_min_kg < poids_max_kg)
  );

-- produits (salam-stock) — mêmes colonnes, mêmes contraintes
alter table public.produits
  add column if not exists unit_type text not null default 'unit';

alter table public.produits
  drop constraint if exists produits_unit_type_check;

alter table public.produits
  add constraint produits_unit_type_check
  check (unit_type in ('unit', 'weight', 'weight_bracket'));

alter table public.produits
  add column if not exists price_per_kg numeric;

alter table public.produits
  add column if not exists estimated_weight_kg numeric;

alter table public.produits
  add column if not exists poids_min_kg numeric;

alter table public.produits
  add column if not exists poids_max_kg numeric;

alter table public.produits
  drop constraint if exists produits_poids_bracket_check;

alter table public.produits
  add constraint produits_poids_bracket_check
  check (
    unit_type <> 'weight_bracket'
    or (poids_min_kg is not null and poids_max_kg is not null
        and poids_min_kg < poids_max_kg)
  );

-- ════════════════════════════════════════════════════════════════════
-- 2. COMMANDES — Stripe manual capture sur commandes_drive
-- ════════════════════════════════════════════════════════════════════

alter table public.commandes_drive
  add column if not exists stripe_payment_intent_id text;

alter table public.commandes_drive
  add column if not exists montant_autorise_ttc numeric;

alter table public.commandes_drive
  add column if not exists montant_capture_ttc numeric;

alter table public.commandes_drive
  add column if not exists statut_paiement text default 'autorise';

alter table public.commandes_drive
  drop constraint if exists commandes_drive_statut_paiement_check;

alter table public.commandes_drive
  add constraint commandes_drive_statut_paiement_check
  check (statut_paiement in ('autorise', 'capture', 'libere', 'echec'));

alter table public.commandes_drive
  add column if not exists autorisation_expire_at timestamptz;

create unique index if not exists uq_commandes_drive_stripe_pi
  on public.commandes_drive(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists idx_commandes_drive_statut_paiement
  on public.commandes_drive(statut_paiement);

-- ════════════════════════════════════════════════════════════════════
-- 3. LIGNES — Pesée + écarts sur commandes_drive_lignes
-- ════════════════════════════════════════════════════════════════════

alter table public.commandes_drive_lignes
  add column if not exists quantite_estimee numeric;

alter table public.commandes_drive_lignes
  add column if not exists quantite_reelle_pesee numeric;

alter table public.commandes_drive_lignes
  add column if not exists montant_estime_ttc numeric;

alter table public.commandes_drive_lignes
  add column if not exists montant_reel_ttc numeric;

alter table public.commandes_drive_lignes
  add column if not exists pese_par uuid references public.profiles(id) on delete set null;

alter table public.commandes_drive_lignes
  add column if not exists pese_at timestamptz;

create index if not exists idx_commandes_drive_lignes_pese
  on public.commandes_drive_lignes(pese_at) where pese_at is not null;

-- ════════════════════════════════════════════════════════════════════
-- 4. AUDIT — drive_ecarts_poids
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.drive_ecarts_poids (
  id              uuid primary key default gen_random_uuid(),
  ligne_id        uuid not null references public.commandes_drive_lignes(id) on delete cascade,
  ecart_pct       numeric not null,
  action          text not null,
  decision_par    uuid references public.profiles(id) on delete set null,
  decision_at     timestamptz not null default now(),
  notes           text,

  constraint drive_ecarts_poids_action_check
    check (action in (
      'auto_accept',                 -- écart < 10 %, validation automatique
      'preparator_decision',         -- 10-20 % : préparateur tranche
      'client_notify',               -- 10-20 % et > 5 € : notification client
      'client_validation_required'   -- > 20 % : validation client obligatoire
    ))
);

create index if not exists idx_drive_ecarts_poids_ligne
  on public.drive_ecarts_poids(ligne_id);

create index if not exists idx_drive_ecarts_poids_action
  on public.drive_ecarts_poids(action);

-- ════════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════

alter table public.drive_ecarts_poids enable row level security;

drop policy if exists "ecarts_poids_select_staff" on public.drive_ecarts_poids;
create policy "ecarts_poids_select_staff"
  on public.drive_ecarts_poids for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager', 'employee')
    )
  );

drop policy if exists "ecarts_poids_insert_staff" on public.drive_ecarts_poids;
create policy "ecarts_poids_insert_staff"
  on public.drive_ecarts_poids for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'manager', 'employee')
    )
  );
```

---

## Q3 — Hypothèses prises sans vérification

Toutes documentées dans `/Users/mac/salamarket-drive/BLOCKERS.md` (commit `3d76c17`). Récap :

| # | Hypothèse | Justification | Risque si fausse |
|---|---|---|---|
| H1 | `commandes_drive` est la table canonique (pas `orders`) | Migration `salam-stock/0001_init.sql` la crée ; les triggers de sync 0008-0009-0017 la peuplent depuis `orders`. La staff/préparation V2 lit `commandes_drive`. | Si la sync ne tourne pas, le checkout salamarket-drive remplit `orders` mais la pesée staff lit `commandes_drive` vide. À valider en prod. |
| H2 | Dualité `products` (EN) / `produits` (FR) à maintenir | Aucune migration de fusion trouvée. Les 2 apps consomment chacune leur table. | Données catalogue divergent. Le fix idéal serait une vue OU une trigger sync — hors scope démo. |
| H3 | Pas de table `profiles` dans salam-stock (migrations) | `grep "create table.*profiles" salam-stock/supabase/migrations/` → 0 match. `profiles` est créée par salamarket-drive. Les deux apps partagent la même instance Supabase donc la table est accessible des deux côtés. | `references public.profiles(id)` dans 0029 fonctionnera tant que la table existe (créée côté salamarket-drive). |
| H4 | Rôle profiles : `admin`, `manager`, `employee`, `customer` (4 valeurs) | Cf. migration 0027 du repo salamarket-drive (CHECK constraint). | Si la DB a d'autres valeurs (ex. `directeur` côté salam-stock zustand), les policies RLS de 0029 refusent l'accès → l'écriture dans `drive_ecarts_poids` échouera silencieusement (`[]`). |
| H5 | API Stripe : version `2026-04-22.dahlia` | Agent A a noté que `2025-09-30.clover` (du brief) n'est plus dans le type `LatestApiVersion` de stripe-node v22. Adapté. | Aucun. Stripe accepte les versions antérieures. |
| H6 | Pré-auto Stripe arrondi au centime **supérieur** (`Math.ceil`) | Pour ne JAMAIS sous-couvrir le montant réel. | Aucun. |
| H7 | Webhook Stripe répond toujours 200 OK même sur events non gérés | Évite retry-loop côté Stripe. Erreurs loggées en console. | Réconciliation manuelle nécessaire si erreur silencieuse. |
| H8 | Idempotence `create-payment-intent` : on `retrieve` si déjà un PI | Évite les doubles pré-autos si retry front. | Si la commande a un PI déjà capturé et qu'on rappelle l'endpoint, on renverra ce PI existant — pas de nouveau PI créé. À surveiller. |
| H9 | Centralisation **différée** | Cf. BLOCKERS.md B7 + arbitrage utilisateur validé. Refactor Next.js 6-10h sans bénéfice immédiat. | 0 risque démo : Labo + Admin Pro restent fonctionnels dans salamarket-drive. |
| H10 | `unit_type` par défaut `'unit'` sur les 2 catalogues | Migration met DEFAULT `'unit'`. Donc tous les produits existants restent en mode forfait — comportement actuel inchangé. | Aucun. |
| H11 | Stripe TEST MODE strict | `lib/stripe.ts` throw si la clé ne commence pas par `sk_test_`. Anti-incident avant la démo. | Aucun. |

---

## Q4 — Routes migrées (centralisation salamarket-drive → salam-stock)

**Statut : 0 route migrée.** La centralisation (Mission 4A du brief) a été **différée** d'un commun accord après audit. Cf. arbitrage utilisateur validé le 2026-05-15.

| URL avant (salamarket-drive) | URL après (salam-stock) | Statut | Commit |
|---|---|---|---|
| `/admin/comptes-pro` | (cible : `/admin/comptes-pro` ou `/v2/admin/comptes-pro`) | ⏸ **différé post-démo** | — |
| `/admin/commandes-pro` | (idem) | ⏸ **différé post-démo** | — |
| `/admin/factures-pro` | (idem) | ⏸ **différé post-démo** | — |
| `/v2/labo/recettes` (et sous-routes) | (cible : `/v2/labo/recettes`) | ⏸ **différé post-démo** | — |
| `/v2/labo/productions` (et sous-routes) | (idem) | ⏸ **différé post-démo** | — |
| `/v2/labo/marges` | (idem) | ⏸ **différé post-démo** | — |

**Raisons** :
1. salam-stock n'a **pas** TanStack Query — toutes les hooks à porter sont à refactor manuel
2. salam-stock n'a **pas** shadcn/ui (`components/ui/` vide) — toutes les pages utilisent extensivement button/card/dialog/select/table/badge à recoder
3. salam-stock n'a **pas** React Router — chaque `Link` et `navigate` à convertir en Next.js
4. salam-stock n'a **pas** Supabase Auth opérationnelle (zustand-only) — toutes les pages protégées à re-câbler
5. Effort estimé : **6-10h** pour 10 routes, sans bénéfice immédiat pour la démo du 10 juin
6. Risque : laisser une migration à mi-chemin = deux versions cassées 26 jours avant le RDV

**Décision** : on garde Labo + Admin Pro dans salamarket-drive pour la démo. Migration vers salam-stock prévue post-démo dans une fenêtre dédiée.

**Aucune route legacy n'a été commentée** dans salamarket-drive (les `// LEGACY_MIGRATION:` du brief restent inutilisés). Les routes restent vivantes.

---

## Q5 — Packages npm ajoutés

### salamarket-drive
```diff
+ "@stripe/stripe-js": "^9.5.0"
+ "@stripe/react-stripe-js": "^6.3.0"
```

### salam-stock
```diff
+ "stripe": "^22.1.1"
```

**Aucun autre ajout.** Pas de `react-email`, pas de `mjml`, pas de `playwright`. Cf. Q7 pour ce qui reste à installer.

---

## Q6 — Variables `.env` à ajouter

### `/Users/mac/salamarket-drive/.env.local`
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_ME
VITE_STRIPE_API_BASE_URL=http://localhost:3000
```
Fichier de référence : `/Users/mac/salamarket-drive/.env.local.example` (commité).

### `/Users/mac/salam-stock/.env.local`
```
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
```
Fichier de référence : `/Users/mac/salam-stock/.env.local.example` (commité).

**⚠ Garde-fou** : `lib/stripe.ts` côté salam-stock **throw au démarrage** si `STRIPE_SECRET_KEY` ne commence pas par `sk_test_`. Si tu tentes de mettre une clé `sk_live_*` avant le 10 juin, l'app refusera de démarrer. Volontaire.

**Webhook secret** : à récupérer depuis Stripe Dashboard → Developers → Webhooks → Add endpoint :
- URL : `https://<host>/api/stripe/webhook` (ou `stripe listen --forward-to localhost:3000/api/stripe/webhook` pour le dev)
- Events : `payment_intent.succeeded`, `payment_intent.canceled`, `payment_intent.payment_failed`

---

## Q7 — TODOs restants pour la démo du 10 juin

| Item | Estimation | Bloquant démo ? |
|---|---|---|
| Appliquer la migration 0029 sur Supabase (SQL Editor) | 5 min | ✅ Oui |
| Remplir `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET` dans `.env.local` des 2 repos | 10 min | ✅ Oui |
| Configurer le webhook Stripe dans le dashboard | 5 min | ✅ Oui (sans webhook, les annulations ne libèrent pas la pré-auto) |
| Seeder 2-3 produits `weight` (merguez, kefta, brochettes) + 1 produit `weight_bracket` (poulet fermier) avec `unit_type` / `price_per_kg` / `poids_min_kg` / `poids_max_kg` renseignés | 20 min | ✅ Oui (sans seed, impossible de démontrer le flow weight) |
| Vérifier que la trigger de sync `orders` → `commandes_drive` existe et fonctionne (sinon, ajouter une trigger ou pointer le checkout salamarket-drive vers `commandes_drive` directement) | 1-2 h | 🔴 **Probablement bloquant** — sans sync, le checkout n'arrive jamais dans la liste préparation |
| Brancher Supabase Auth dans salam-stock (server actions + middleware) pour que `/staff/*` fonctionne avec de vrais utilisateurs | 2-4 h | 🟡 Démontrable en mode dégradé (login zustand local) mais pas crédible client |
| Faire pointer le checkout salamarket-drive vers la route Stripe `create-payment-intent` (le code Agent B a ajouté `<DriveStripePayment />` mais le checkout actuel utilise encore l'endpoint hosted) | 1-2 h | 🔴 Bloquant : sans ça, les paniers avec lignes weight reviendront sur le checkout hosted historique (PI manuel n'est jamais créé) |
| Tester end-to-end le flow client + staff avec une vraie commande TEST Stripe | 1 h | ✅ Indispensable |
| **Centralisation Labo + Admin Pro** (Mission 4A reportée) | 6-10 h | ❌ Différé, pas pour le 10 juin |
| SMS/email client sur écart > 20 % | 2-4 h | ❌ Pas pour le 10 juin (montrer le badge `client_validation_required` suffit visuellement) |
| Intégration physique balance USB (WebHID/WebSerial) | 4-8 h | ❌ Saisie manuelle OK pour démo |
| Tests E2E Playwright (3 scénarios unit/weight/bracket) | 4-6 h | ❌ Vitest unitaire couvre les calculs, démo manuelle suffit |
| Email post-préparation au client (template react-email + Resend déjà dans salam-stock) | 2-3 h | 🟡 Démo OK sans, vrai client ratera la confirmation |
| Réel-time updates sur la liste préparation (Supabase channels) | 1 h | ❌ Bouton "Rafraîchir" suffit |
| Merger la branche `chore/drive-products-view` → `main` côté salam-stock | 10 min | ✅ Indispensable avant push vers prod |
| Régénérer les types Supabase salam-stock une fois CLI accessible | 30 min | ❌ Pas pour le 10 juin |

**Effort total restant pour démo crédible : ~6-10 h**, dominé par la trigger de sync `orders` → `commandes_drive` et le câblage Supabase Auth dans salam-stock.

---

## Q8 — Schéma migration 0029 vs Notion "12 · Stratégie Drive au poids"

Je n'ai pas eu accès au Notion (pas de MCP Notion sur ce projet). J'ai utilisé le brief texte de la mission comme source de vérité.

| Champ Notion attendu | Implémenté en 0029 ? | Détail |
|---|---|---|
| `unit_type` sur catalogue avec 3 valeurs | ✅ | CHECK in (`unit`, `weight`, `weight_bracket`) sur `products` ET `produits` |
| `price_per_kg` | ✅ | numeric nullable |
| `estimated_weight_kg` | ✅ | numeric nullable |
| `poids_min_kg` / `poids_max_kg` | ✅ | numeric nullable + CHECK `min < max` si weight_bracket |
| `quantite_estimee` (ligne) | ✅ | numeric nullable sur `commandes_drive_lignes` |
| `quantite_reelle_pesee` (ligne) | ✅ | numeric nullable |
| `montant_estime_ttc` (ligne) | ✅ | numeric nullable |
| `montant_reel_ttc` (ligne) | ✅ | numeric nullable |
| `pese_par` + `pese_at` | ✅ | uuid FK `profiles(id)` + timestamptz |
| `stripe_payment_intent_id` (commande) | ✅ | text + index unique partiel |
| `montant_autorise_ttc` (estimé × 1.20) | ✅ | numeric — calcul fait côté backend Node (`computeMontantAutorise`), pas trigger DB |
| `montant_capture_ttc` | ✅ | numeric |
| `statut_paiement` 4 valeurs | ✅ | CHECK in (`autorise`, `capture`, `libere`, `echec`) |
| `autorisation_expire_at` | ✅ | timestamptz — défaut `now() + 7 days` posé par l'API route `create-payment-intent` |
| Table `drive_ecarts_poids` | ✅ | avec ligne_id, ecart_pct, action, decision_par, decision_at, notes |
| Action écart : 4 valeurs | ✅ | CHECK in (`auto_accept`, `preparator_decision`, `client_notify`, `client_validation_required`) |
| Seuils 10 % / 20 % / 5 € | ✅ | Implémentés en TS dans `determineEcartAction` (testé Vitest, 6 cas dont seuils exacts) |

**Écarts par rapport au Notion (non vérifié faute d'accès) :**
- Si le Notion mentionne des champs supplémentaires (ex. `notes_client`, `validation_sms_envoye_at`, `balance_serial_number`), ils ne sont pas dans 0029. À me dire si manquant.
- Si le Notion utilise des noms FR (`montant_autorise` au lieu de `montant_autorise_ttc`), j'ai préféré garder le suffixe `_ttc` pour expliciter (cohérent avec `montant_ht/tva/ttc` existant sur `commandes_pro`).

---

## Synthèse audit

- **Schéma DB** : aligné brief, idempotent, hypothèses documentées
- **Stripe** : TEST MODE verrou actif, 3 routes API, helpers compute testés (34 tests Vitest)
- **UI client** : catalogue/panier/checkout/éducation livrés, palette intacte
- **UI staff** : `/staff/preparation` livré avec limitations auth zustand (À régler avant prod)
- **Centralisation** : différée post-démo (arbitrage explicite)
- **Tests** : 85/85 verts côté salamarket-drive ; salam-stock pas de framework Vitest installé
- **Branche salam-stock** : commits sur `chore/drive-products-view`, **NON sur main**. À merger.
