# INSPECTION_V2 — /v2/preparation (état actuel, sans modif)

> Daté du 2026-05-16 (matin). Inspection pure, aucun fichier touché.

---

## 1. Structure du module

| Fichier | Type | Rôle |
|---|---|---|
| `app/v2/preparation/page.tsx` | Client component (411 lignes) | Kanban 4 colonnes (À préparer / En préparation / Prêtes / Retirées). Charge `listCommandesDrive` + `listLignesPourCommande` pour chacune. Realtime via Supabase channel sur les 2 tables ; fallback polling 12 s. Action sheet en bottom-drawer (Framer) pour avancer une commande. |
| `app/v2/preparation/[id]/page.tsx` | Client component (369 lignes) | Détail d'une commande. Fetch produits par dépôt pour enrich les lignes. Groupe par `zone_preparation` (particulier/professionnel/traiteur), cold-chain en premier. UI orientée **scan-based** : bouton "Scanner produit" + bouton "Manquant" par ligne, sticky bottom CTA "Marquer prêt" qui passe la commande en `pret` + appelle `/api/notify`. |

Aucun sous-dossier `components/` propre à `/v2/preparation` — tout est inline dans les 2 pages. Les composants partagés (BackButton, V2Shell, PriceTag, ProductThumbnail, ClientTypeBadge, PageAccentStripe) viennent de `components/v2/`.

---

## 2. Query Supabase actuelle

### Liste Kanban (page.tsx)
```ts
// listCommandesDrive() — lib/db/index.ts:926
const { data } = await sb
  .from("commandes_drive")
  .select("*")            // ← prend TOUTES les colonnes au runtime
  .order("creneau_retrait");
// Pas de filtre statut côté requête (filtre en mémoire après).

// listLignesPourCommande() — lib/db/index.ts:945
const { data } = await sb
  .from("commandes_drive_lignes")
  .select("*")            // ← prend TOUTES les colonnes
  .eq("commande_id", commandeId);
```
Le `.select("*")` ramène déjà les colonnes Stripe (migration 0029) — `statut_paiement`, `montant_autorise_ttc`, `stripe_payment_intent_id`, `montant_capture_ttc`, `autorisation_expire_at` — mais le **type TS `CommandeDrive` ne les expose pas** (`lib/types/db.ts` est figé sur 0001_init). Idem pour `CommandeDriveLigne` : `quantite_estimee`, `quantite_reelle_pesee`, `montant_estime_ttc`, `montant_reel_ttc`, `pese_par`, `pese_at` sont en DB mais pas dans le type.

### Filtre en mémoire
```ts
setCommandes(enriched.filter((c) => c.statut !== "annule"));
```
→ Garde tout sauf `annule`. Les 4 colonnes kanban dispatchent par `c.statut`.

**Note importante** : le kanban a une colonne `a_preparer` mais `commandes_drive.statut` CHECK constraint (0001_init.sql:161) n'accepte que `'en_preparation','pret','retire','annule'`. Soit une migration ultérieure a étendu le CHECK, soit la colonne `a_preparer` est volontairement vide. Aucune commande seedée en `a_preparer` n'a été vue côté E2E.

---

## 3. Routing

| URL | Destination |
|---|---|
| `/v2/preparation` | Kanban |
| `/v2/preparation/[id]` | Détail (page.tsx `[id]/page.tsx`), `params.id = commande.id` (UUID) |

Liens internes :
- Card Kanban → `<Link href="/v2/preparation/${cmd.id}">` ("Détail" + "Avancer →" qui ouvre l'action sheet)
- Action sheet → bouton "Ouvrir le détail" (`<Link>` vers `/v2/preparation/[id]`)
- Détail → `router.replace("/v2/preparation")` après finalize

---

## 4. Actions existantes

### Bouton "Avancer →" du Kanban
Ouvre l'`actionFor` action sheet → un bouton selon le statut courant :
- `a_preparer` → "Accepter et commencer la préparation" → `advance(cmd, "en_preparation")`
- `en_preparation` → "Marquer prête au retrait" → `advance(cmd, "pret")`
- `pret` → "Marquer retirée par le client" → `advance(cmd, "retire")`

`advance()` appelle `setCommandeStatut(cmd.id, target)` (lib/db/index.ts:1139) qui fait simplement :
```ts
await sb.from("commandes_drive").update({ statut }).eq("id", commandeId);
```
→ **Aucune capture Stripe**. **Aucun appel `/api/stripe/capture-payment`**. Le flow actuel ignore complètement le statut_paiement.

### Bouton "Marquer prêt" (page détail)
1. Vérifie que toutes les lignes ont `statut_preparation !== 'en_attente'`
2. `await setCommandeStatut(commande.id, "pret")`
3. `POST /api/notify` avec payload `{ kind: 'commande_prete', payload: { commande, client, telephone } }`
4. `router.replace("/v2/preparation")`

### Scan / Manquant
- Scan EAN → `findProduitByEan` → `updateLignePreparation(ligneId, { statut_preparation: 'prepare' })`
- Manquant + photo → idem mais `statut_preparation: 'manquant'`

Aucune logique de **pesée**, **écart**, **capture Stripe**.

---

## 5. Réutilisabilité

### Composant `<PreparationWorkflow>` de `/staff/preparation`
Importable techniquement, mais :
- ❌ Utilise sa propre palette (slate/emerald/amber/red), pas la palette v2 (sapin/or/crème)
- ❌ Layout vertical full-page, pas adapté à un détail v2 qui a déjà BackButton + header sticky
- ❌ Props attendent un type `Commande` augmenté différent de `CommandeDrive` du repo

→ **Réutiliser le composant tel quel = laid**. Préférer extraire :
- Les **helpers** `computeEcartPct` + `determineEcartAction` de `lib/drive-pesee.ts` ✅ (importables directement, types compatibles)
- Le **hack** `HARDCODED_ADMIN_UUID` + `getUserUuid()` : actuellement défini INLINE dans `PreparationWorkflow.tsx`. À extraire dans un fichier partagé (ex: `lib/staff/auth-fallback.ts`) pour que `/v2/preparation/[id]` puisse l'importer sans dupliquer la constante.
- Les **server actions** `markLineWeighed` + `finalizePreparation` de `lib/staff/preparation-actions.ts` ✅ (importables, signatures compatibles, gèrent déjà la capture Stripe + l'insertion dans `drive_ecarts_poids`)

### Auth dans /v2/preparation
- Lit `useV2((s) => s.currentEmploye)` (cf. ligne 62 de `[id]/page.tsx`), pas `useStore((s) => s.currentUser)` comme `/staff/preparation`. Donc le hack `getUserUuid` doit accepter `employe.id` (string non-UUID type `emp_…`) ET retourner l'UUID admin hardcodé en fallback.

---

## 6. Recommandation — plan d'évolution en 5 étapes

| # | Étape | Effort estimé | Risque |
|---|---|---|---|
| **1** | **Étendre les types DB** dans `lib/types/db.ts` : ajouter les colonnes 0029 en optionnel à `CommandeDrive` (`statut_paiement?: string`, `montant_autorise_ttc?: number`, `stripe_payment_intent_id?: string`, `montant_capture_ttc?: number`, `autorisation_expire_at?: string`) et à `CommandeDriveLigne` (`quantite_estimee?`, `quantite_reelle_pesee?`, `montant_estime_ttc?`, `montant_reel_ttc?`, `pese_par?`, `pese_at?`). Pas de breaking change : tout est `?`. | 15 min | Très faible |
| **2** | **Sortir le hack auth** dans `lib/staff/auth-fallback.ts` (export `HARDCODED_ADMIN_UUID` + `getUserUuid`). Mettre à jour les 2 imports dans `PreparationWorkflow.tsx`. | 10 min | Faible |
| **3** | **Enrichir le Kanban** (`page.tsx`) : sur chaque card avec `statut_paiement === 'autorise'`, afficher un badge "🔒 Pré-autorisé X €" remplaçant le tag prix actuel. Si la commande a au moins 1 ligne avec `unit_type='weight'` ou `'weight_bracket'` (à fetcher en JOIN ou via produit_id), badge "⚖ N à peser". Le `listLignesPourCommande` doit être étendu pour récupérer l'`unit_type` du produit via embedded select `produits(unit_type, price_per_kg, poids_min_kg, poids_max_kg)`. | 25 min | Moyen — il faut tester le embedded select PostgREST sur la FK `produit_id → produits` |
| **4** | **Page détail `[id]/page.tsx`** : ajouter un module pesée AU-DESSUS du flow scan existant (pas en remplacement). Si une ligne a `unit_type='weight'` → un input poids `step=0.01` qui calcule l'écart live (badge couleur via `determineEcartAction`). Si `unit_type='weight_bracket'` → radio des brackets. Pour les lignes `unit`, on garde le scan/manquant existant. Sauvegarde via server action `markLineWeighed`. | 40 min | Moyen — UI cohabite avec scan |
| **5** | **Modifier `finalize()`** dans `[id]/page.tsx` : si `commande.statut_paiement === 'autorise'`, appeler `finalizePreparation` (server action — fait la capture Stripe + UPDATE statut + insert ecarts) AU LIEU du couple `setCommandeStatut('pret')` + `/api/notify`. Pour les commandes 100% unit sans `statut_paiement`, garder le flow legacy. Bouton intitulé "Finaliser & capturer X €" si flow Stripe, "Marquer prêt" sinon. | 20 min | Moyen — il faut s'assurer que `/api/notify` est toujours appelé après la capture |

**Total estimé : ~1h50** (cohérent avec la fenêtre 1-2 h du brief).

### Décisions à valider au check-in

1. **Filtrage Kanban** — le brief 2.1 propose 2 options : (a) ne montrer que `statut_paiement IN ('autorise', 'capture')`, ou (b) tout montrer avec badge différencié. → **Recommandation : (b)**. Les commandes legacy (100% unit, pas de pré-auto) doivent rester visibles. Badge "🔒 Pré-autorisé" sur les commandes Stripe.
2. **UX bouton "Avancer → en_preparation"** — actuellement c'est une étape métier ("le préparateur accepte la commande"). Cette transition reste pure (`setCommandeStatut`, pas de Stripe). La capture se fait uniquement sur la transition `en_preparation → pret`.
3. **Boutons existants** "Scanner" et "Manquant" — gardés pour les lignes `unit`. Pour weight/bracket, ces boutons sont cachés au profit de l'input pesée.
4. **Realtime** — le channel actuel se déclenche sur UPDATE de `commandes_drive_lignes`. Quand le préparateur saisit un poids et que `markLineWeighed` fait l'UPDATE, le realtime va recharger la page et écraser l'état local. → **Risque** : à mitiger en gardant `lignes` en state local pendant la session de pesée, ou en désactivant le realtime pendant la pesée. À trancher au check-in.

### Risques globaux

- **Type DB pas généré** : `lib/types/db.ts` est manuel. Les colonnes 0029 sont accessibles au runtime via `.select("*")` mais pas au TS. Casts ponctuels nécessaires. À long terme : régénérer via `supabase gen types`.
- **`unit_type` sur `produits` vs `products`** : le module v2 utilise `produits` (FR). La migration 0029 a posé les colonnes weight sur les 2 tables. Pas de risque ici, juste à confirmer que le seed `produits` a bien les `unit_type` non-`unit`.
- **CHECK constraint statut** : si la migration 0001 n'autorise pas `a_preparer`, on ne peut pas y placer une commande. À ignorer pour la démo (les seeds arrivent en `en_preparation` directement).
- **Pas de test framework** côté salam-stock — pas de Vitest. Le test sera manuel via E2E (étape 4 du brief).

---

## Conclusion

L'évolution est **propre et minimale** : on étend les types, on extrait un hack, on enrichit 2 pages, sans toucher aux routes API ni à `/staff/preparation` (qui sera déprécié séparément à l'étape 3 du brief).

J'attends ton GO sur ce plan (notamment les 4 décisions ci-dessus) avant de commencer l'ÉTAPE 2.
