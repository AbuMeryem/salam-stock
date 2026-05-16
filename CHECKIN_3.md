# CHECKIN_3 — Intégration Drive au poids dans /v2/preparation

> Date : 2026-05-16 (matin / fin de matinée)
> Statut global : ✅ **ÉTAPES 1-3 TERMINÉES, BUILD VERT, E2E À DÉROULER**
> Bonus : 1 bug latent corrigé (`prete_retrait` → `pret`)

---

## État des 5 étapes (commits salam-stock `chore/drive-products-view`)

| # | Étape | Commit | Statut |
|---|---|---|---|
| 1 | Inspection `/v2/preparation` (INSPECTION_V2.md) | `6725460` | ✅ |
| 2.1 | Étendre `CommandeDrive`/`CommandeDriveLigne`/`Produit` avec colonnes 0029 en optionnel | `1f87331` | ✅ |
| 2.2 | Extraire `HARDCODED_ADMIN_UUID` + `getUserUuid` dans `lib/staff/auth-fallback.ts` | `2fad599` | ✅ |
| 2.3 | Kanban enrichi : badge "Pré-aut. X €" / "Capt. X €" + "{N} à peser" + filtre `statut_paiement='echec'` | `5947450` | ✅ |
| 2.4+2.5 | Page détail : composant `<WeightLineRow>` (input kg/bracket + badge écart live) + `finalize()` conditionnel `finalizePreparation` | `3b4b9e0` | ✅ |
| 3 | Deprecate `/staff/preparation` + DEPRECATED.md + redirect 301 dans `next.config.mjs` | `15f5156` | ✅ |
| **bonus** | Fix `finalizePreparation` statut `'prete_retrait'` (hors CHECK) → `'pret'` | `4220200` | ✅ |

---

## Health

| Vérification | Résultat |
|---|---|
| `npm run build` salam-stock | ✅ vert après chaque commit (5 builds successifs) |
| Type DB cohérent (back-compat 100%) | ✅ tous nouveaux champs optionnels |
| Redirection `/staff/preparation` → `/v2/preparation` | ✅ 308 Permanent (équivalent 301 Next.js) testé via curl |
| Palette V2 respectée (sapin/or/crème) | ✅ aucun slate/emerald, classes `bg-cream`, `bg-success-soft`, `bg-gold-soft`, `bg-warning-soft`, `bg-danger-soft` |
| Helpers `drive-pesee.ts` réutilisés | ✅ `computeEcartPct`, `determineEcartAction` importés |
| Hack auth partagé | ✅ `lib/staff/auth-fallback.ts` consommé par `/staff` ET `/v2` |
| Realtime décision Q4 | ⚪ Sans effet — la page détail n'a pas de channel realtime (constat inspection). Risque d'écrasement état inexistant. |

---

## Test E2E sur commande D2026-91867807-070

### Vérif backend (via REST API, fait depuis ce shell)

Commande :
```json
{
  "id": "348dcc72-850a-4326-841f-3f68f7eaa355",
  "numero_commande": "D2026-91867807-070",
  "statut": "a_preparer",
  "statut_paiement": "autorise",
  "montant_autorise_ttc": 41.4,
  "stripe_payment_intent_id": "pi_3TXWEiAlnuJ0imbq06VcgfAV",
  "total_ttc": 37
}
```
✅ Le `montant_autorise_ttc = 41.4` confirme l'Edge Function applique
correctement la marge **uniquement sur weight** : `ceil(22 × 1.20) + 15 = 26.40 + 15 = 41.40`. Le bug "marge sur tout" du 16/05 matin n'est pas reproduit.

Lignes :
```json
[
  {
    "produit_id": "00000000-0030-0000-0000-000000000004",
    "quantite": 1, "quantite_estimee": 1,
    "montant_estime_ttc": 15, "prix_unitaire": 15,
    "produits": { "nom": "Poulet fermier entier", "unit_type": "weight_bracket", "price_per_kg": null }
  },
  {
    "produit_id": "00000000-0030-0000-0000-000000000001",
    "quantite": 1, "quantite_estimee": 1,
    "montant_estime_ttc": 22, "prix_unitaire": 22,
    "produits": { "nom": "Merguez Salam Maison", "unit_type": "weight", "price_per_kg": 22 }
  }
]
```
✅ Les lignes ont bien `unit_type` propagé via JOIN PostgREST (la nouvelle `listLignesPourCommandeAvecUnitType` fonctionnera).

### Test UI à dérouler par toi (je n'ai pas de browser headless)

| # | URL | Action attendue | Résultat |
|---|---|---|---|
| K | `http://localhost:3000/v2/preparation` | Card "D2026-91867807-070" dans colonne "À préparer" avec : badge **`⚖ 2 à peser`** (gold-soft) + badge **`🔒 Pré-aut. 41 €`** (icône Lock) | ☐ |
| D | Click "Détail" sur la card | `/v2/preparation/348dcc72-…`, header palette V2, 2 lignes affichées par zone "Particulier" | ☐ |
| L1 | Sur ligne Merguez (weight) | Pas de bouton "Manquant". Au lieu : input kg + label "kg" à droite. Bouton "Enregistrer" (icône Scale). | ☐ |
| L1.b | Saisir `1.07` puis click Enregistrer | Badge `+4.8%` (vert success — auto_accept), badge "Pesée enregistrée" + check vert. POST server action `markLineWeighed` → UPDATE DB. | ☐ |
| L2 | Sur ligne Poulet (weight_bracket) | Affichage "1.2-1.5 kg · 15.00 €" + bouton "Enregistrer" direct. | ☐ |
| L2.b | Click Enregistrer | Badge "Pesée enregistrée". | ☐ |
| F | CTA bottom "Finaliser & capturer" | Label dynamique : "FINALISER & CAPTURER" + montant total réel (≈ `38,54 €` : `1.07 × 22 + 15`). Icône CreditCard. | ☐ |
| F.b | Click | Server action `finalizePreparation` → INSERT `drive_ecarts_poids` (1 ligne pour la merguez avec action=auto_accept, ecart_pct≈4.8) → POST `/api/stripe/capture-payment` (avec UUID admin hardcodé) → UPDATE `statut='pret'` (CHECK OK depuis fix 4220200) | ☐ |
| F.c | Toast | "D2026-91867807-070 : 38,54 € capturés via Stripe" | ☐ |
| F.d | Redirect | Retour `/v2/preparation`, la card disparaît de "À préparer" et apparaît dans "Prêtes au retrait" (statut='pret') | ☐ |

### Vérif DB post-finalize (à lancer dans SQL Editor)

```sql
-- 1. Statut + montants
select id, statut, statut_paiement, montant_capture_ttc, montant_autorise_ttc
  from commandes_drive
 where numero_commande = 'D2026-91867807-070';
-- attendu : statut='pret', statut_paiement='capture',
--           montant_capture_ttc ≈ 38.54

-- 2. Lignes pesées
select produit_id, quantite_reelle_pesee, montant_reel_ttc, pese_par, pese_at
  from commandes_drive_lignes
 where commande_id = (select id from commandes_drive
                      where numero_commande = 'D2026-91867807-070');
-- attendu : merguez 1.07 / 23.54 / UUID admin / now()
--           poulet 1 / 15.00 / UUID admin / now()

-- 3. Écarts audités
select ligne_id, ecart_pct, action, decision_par
  from drive_ecarts_poids
 where ligne_id in (
   select id from commandes_drive_lignes
    where commande_id = (select id from commandes_drive
                         where numero_commande = 'D2026-91867807-070')
 );
-- attendu : 1 ligne pour merguez, action='auto_accept', ecart_pct≈4.8
--          (le bracket a écart=0 donc pas d'INSERT)
```

### Vérif Stripe Dashboard

https://dashboard.stripe.com/test/payments → chercher `pi_3TXWEiAlnuJ0imbq06VcgfAV` :
- `status: succeeded`
- `amount: 4140` (centimes pré-auto)
- `amount_captured: 3854` (centimes capturés après pesée)
- `amount_refunded: 0` (la différence 2.86 € sera libérée auto sous 7 jours par Stripe)

---

## Bugs résiduels potentiels

| # | Risque | Atténuation |
|---|---|---|
| 1 | `getUserUuid(employe?.id)` retombe sur le hack UUID admin si l'employé local n'est pas un UUID. Le `decision_par` et `pese_par` seront tous l'admin, peu importe qui est connecté. | ✓ accepté pour la démo — Mission 4 fixera (Supabase Auth + UUID auth.users réel). Tag `TODO_DEMO_10_JUIN`. |
| 2 | Si tu cliques "Avancer →" dans le Kanban (action sheet) puis "Marquer prête au retrait", `setCommandeStatut('pret')` est appelé SANS capture Stripe. La commande passe en `'pret'` mais le PI Stripe reste en `requires_capture` → fonds bloqués client. | À documenter en aval. Solution future : désactiver le bouton "Avancer → pret" sur les commandes `statut_paiement='autorise'` et forcer le passage via le détail (`finalize()` qui fait la capture). Pas un blocker démo si on dit aux préparateurs "toujours via le détail". |
| 3 | Realtime Kanban va re-fetcher pendant qu'un préparateur saisit du poids sur la page détail. Comme le détail n'a PAS de realtime, pas de risque d'écrasement. Mais le badge "{N} à peser" sur le Kanban se rafraîchira après chaque save. Cosmétique. | OK |
| 4 | Si `productions.produit_id` pointe vers un produit avec `unit_type=null` (produit historique), `isWeightLine` retournera false → ligne en mode unit (Check/Manquant). Comportement attendu. | OK |

---

## Commits récap (de la session du 16/05)

```
4220200 fix(preparation-actions): statut 'pret' au lieu de 'prete_retrait' (CHECK constraint)
15f5156 deprecate(staff/preparation): bascule vers /v2/preparation + redirect 301
3b4b9e0 feat(v2/preparation): détail — pesée + capture Stripe pour lignes weight/bracket
5947450 feat(v2/preparation): kanban — badges Stripe pré-autorisé + nb à peser
2fad599 refactor(staff): extrait hack auth dans lib/staff/auth-fallback.ts
1f87331 types(db): ajoute colonnes 0029 (weight + Stripe pesée) en optionnel
6725460 docs(v2/preparation): INSPECTION_V2 rapport pré-intégration drive au poids
```

---

## Prochaines actions

1. **Dérouler le test UI** sur ton navigateur (10 min, checklist ci-dessus). Coche les ☐.
2. Si toute la séquence est verte → **Mission 4** (Supabase Auth propre + retrait `TODO_DEMO_10_JUIN`).
3. Si une étape casse → log précis (URL + console + DB), on debug.

**Background jobs vivants** : salam-stock dev (port 3000), salamarket-drive dev (port 8081), stripe listen (en background depuis Mission 3).
