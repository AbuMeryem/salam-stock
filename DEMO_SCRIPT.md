# DEMO_SCRIPT — RDV client du 10 juin 2026

> Script pas-à-pas pour la démo du module Drive au poids variable +
> centralisation staff. Durée cible : **30-35 minutes**.

---

## Comptes de test

| Email | Mot de passe | Rôle | Usage démo |
|---|---|---|---|
| `digitalwebmastertlse@gmail.com` | (perso) | `admin` | Démo client + démo admin Pro |
| `zbairi.mohamed@salamarket31.fr` | (perso) | `manager` | Démo validation Pro > 500 € |
| **À créer avant la démo** | `Demo2026!` | — | Compte client TEST pour la commande au poids |

**Action préparatoire (10 min)** : créer dans Supabase Auth un compte
`client-demo@salamarket-test.fr` (rôle `customer`, c'est le défaut).
Sert pour faire une vraie commande au poids pendant la démo.

---

## Avant la démo (la veille — checklist 9 juin)

- [ ] Appliquer la migration `0029_drive_au_poids.sql` dans Supabase SQL Editor
- [ ] Remplir les clés Stripe TEST dans `.env.local` des 2 repos
- [ ] Configurer le webhook Stripe Dashboard → URL endpoint + 3 events
- [ ] Seeder en SQL Editor : 3 produits weight + 1 weight_bracket
  ```sql
  -- Côté products (salamarket-drive)
  insert into products (name, description, price_cents, unit, category, image_url, unit_type, price_per_kg, estimated_weight_kg)
  values
    ('Merguez Salam Maison', 'Merguez artisanale agneau-bœuf', 0, 'kg', 'boucherie', '/img/merguez.webp', 'weight', 22, 1.0),
    ('Kefta Agneau', 'Boulettes 30g', 0, 'kg', 'boucherie', '/img/kefta.webp', 'weight', 18, 1.0),
    ('Brochettes Poulet Marinées', 'Marinade yaourt-citron', 0, 'kg', 'boucherie', '/img/brochettes.webp', 'weight', 16, 1.0);

  insert into products (name, description, price_cents, unit, category, image_url, unit_type, poids_min_kg, poids_max_kg)
  values ('Poulet fermier entier', 'Halal, élevé en plein air', 1500, 'piece', 'boucherie', '/img/poulet.webp', 'weight_bracket', 1.2, 1.5);
  ```
- [ ] Faire la même chose sur `produits` côté salam-stock si pertinent (les 2 catalogues vivent en parallèle)
- [ ] Lancer `npm run dev` dans les 2 repos
- [ ] Vérifier que `commandes_drive` se peuple bien quand on passe une commande depuis salamarket-drive (test de la trigger de sync)
- [ ] Test end-to-end TEST mode avec une carte `4242 4242 4242 4242`
- [ ] Brief Stripe Dashboard : ouvrir l'onglet "PaymentIntents" pour pouvoir montrer la pré-auto en live

---

## Parcours démo (3 actes, 30 min)

### Acte 1 — Parcours client : commande au poids (10 min)

URL de départ : `http://localhost:8080` (salamarket-drive Vite)

Compte : `client-demo@salamarket-test.fr` (créé avant la démo)

| # | URL | Action / Discours |
|---|---|---|
| 1.1 | `/` | "Le client arrive sur le Drive comme d'habitude. Aucune rupture visuelle." Pointer du doigt un produit boucherie avec **badge "Au poids"** récemment ajouté. |
| 1.2 | `/produit/<id-merguez>` | "Voilà la nouveauté : au lieu de 'pack de X', le client voit le **prix au kilo** et choisit son poids." Faire un stepper : 0,5 → 1 kg → 1,5 kg. Insister : "Estimation : 22 € pour 1 kg." Click **+ Ajouter au panier**. |
| 1.3 | `/produit/<id-poulet-fermier>` | "Pour les pièces standardisées comme un poulet entier, on propose 3 tailles. Le client choisit son bracket." Click sur la 2ᵉ taille. + Ajouter. |
| 1.4 | `/panier` | "Le panier affiche **Estimation** clairement. Bandeau jaune en haut : 'Vous serez débité du poids réellement préparé. Aucun supplément au-delà.'" Click sur le lien "Comment ça marche" du bandeau. |
| 1.5 | `/drive-au-poids` | "Page dédiée à expliquer le système. Exemple chiffré : 1 kg de merguez à 18 €/kg = 18 € estimés → pré-autorisation 21,60 € (×1,20) → vous récupérez 1,07 kg → débit final 19,26 €, libération 2,34 €." Lire l'exemple. Mettre en avant la FAQ "Pourquoi 20 % de marge ?". |
| 1.6 | `/panier` puis bouton **Commander** | Total estimé visible. Click. |
| 1.7 | `/paiement` (Checkout) | "**Montant autorisé** : 26,40 € affiché. C'est ce que le client voit avant de saisir sa carte." Carte test Stripe : `4242 4242 4242 4242`, expiration `12/30`, CVC `123`. Click **Payer (pré-autoriser 26,40 €)**. |
| 1.8 | `/commande/confirmee/:id` | Confirmation. Montrer le numéro de commande et le statut "Préparation en cours". |

**Phrases clés Acte 1** :
- *« Le tunnel client ne change pas — on ajoute juste 2 affichages clés : prix au kg et bandeau pédagogique. »*
- *« Stripe pré-autorise 20 % au-dessus pour absorber les variations, mais on capture EXACTEMENT le poids réel. »*
- *« Le client n'est jamais surfacturé. C'est notre engagement. »*

---

### Acte 2 — Parcours staff : pesée + capture (10 min)

URL de départ : `http://localhost:3000` (salam-stock Next.js)

Compte : `digitalwebmastertlse@gmail.com` (admin)

| # | URL | Action / Discours |
|---|---|---|
| 2.1 | `/login` | Connexion admin. |
| 2.2 | `/staff/preparation` | "Le préparateur voit toutes les commandes payées à préparer, filtrées par créneau de retrait." Pointer du doigt la commande qu'on vient de passer (devrait apparaître via la trigger de sync `orders` → `commandes_drive`). |
| 2.3 | `/staff/preparation/<id>` | "Pour chaque ligne, le préparateur **pèse le produit** et saisit le vrai poids. Le système calcule l'écart en temps réel." Démo : saisir **1,07** kg pour la merguez. Le badge `+7 %` apparaît en vert (`auto_accept`). Saisir **1,8** kg pour un autre produit pour montrer le badge orange (`client_notify`). |
| 2.4 | Toujours sur `/staff/preparation/<id>` | Cliquer **Sauvegarder** par ligne. Stat live "Réel pesé : X €" se met à jour. Show the écart percentage and action badges. |
| 2.5 | Sélection bracket | Pour le poulet, sélectionner le 2ᵉ bracket (le client a choisi le même). "Le bracket peut être ajusté au moment de la pesée si le préparateur trouve un poids différent." |
| 2.6 | Bouton **Finaliser préparation & capturer** | Click. "Le système appelle Stripe pour **capturer le montant exact**, pas le montant pré-autorisé." Toast succès. Redirect vers `/staff/preparation` (la commande a disparu de la liste, elle est passée en `prete_retrait`). |
| 2.7 | Onglet Stripe Dashboard | "Voyons ce qui s'est passé côté Stripe." Switcher sur le Dashboard Stripe TEST mode → PaymentIntents → l'intent de la commande. Montrer : `amount: 26,40 €`, `amount_captured: 19,26 €` (par exemple), `status: succeeded`, **les 2,34 € libérés automatiquement**. |

**Phrases clés Acte 2** :
- *« Le préparateur a un seul écran simple : produit, poids saisi, total live. Pas de logiciel à part. »*
- *« L'écart est calculé automatiquement avec une matrice de décision : <10 % auto-accept, 10-20 % décision préparateur ou notification client selon le montant, >20 % validation client obligatoire. »*
- *« Stripe gère la libération du surplus tout seul. Aucune action humaine pour récupérer l'argent du client. »*

---

### Acte 3 — Parcours admin : pilotage B2B (8 min)

URL : `http://localhost:8080/admin/comptes-pro` (salamarket-drive — pas
encore migré vers salam-stock, cf. centralisation différée).

Compte : `digitalwebmastertlse@gmail.com` (admin)

| # | URL | Action / Discours |
|---|---|---|
| 3.1 | `/admin/comptes-pro` | "On a 5 comptes Pro seedés. Voici l'École Mansour en validation — un dossier qui attend votre arbitrage manager." Montrer le compte `en_validation`. Click **Valider**. Statut passe à `actif`. |
| 3.2 | `/admin/commandes-pro` | "Toutes les commandes Pro filtrables par statut. La commande Pizzeria Le Carthage est marquée 'Validation manager requise' parce qu'elle dépasse 500 €." Pointer le badge. |
| 3.3 | Toujours `/admin/commandes-pro` | Valider la commande Carthage en cliquant. |
| 3.4 | `/admin/factures-pro` | "Le module relance. L'École Mansour est en retard de 30 jours. Bouton **Relancer** prépare un email (à brancher post-démo)." Montrer la table avec le décompte de jours de retard. |
| 3.5 | `/pro/factures` (en tant que délégué Bosphore, si auth créée) | "Côté client Pro, voici l'historique des factures avec téléchargement PDF." Click **Télécharger** sur une facture payée. PDF généré via @react-pdf/renderer. |

**Phrases clés Acte 3** :
- *« B2B et B2C cohabitent dans la même app, mais avec des tunnels visuellement distincts : palette anthracite + or côté Pro. »*
- *« Numérotation atomique côté DB : CP-2026-XXXX pour les commandes, F-2026-XXXX pour les factures. Pas d'erreur possible. »*
- *« Encours plafond surveillé en temps réel via trigger DB. Le commercial sait immédiatement si un compte peut commander à crédit. »*

---

### Acte 4 — Q&A et roadmap (5 min)

Préparer 3 messages clés :

1. **« Aujourd'hui, le Drive au poids est techniquement fonctionnel
   bout-en-bout en TEST mode Stripe. Pour passer en LIVE : retirer un
   verrou + remplir les vraies clés. »**

2. **« Le module Labo (recettes/productions/marges) est complet côté
   frontend mais reste dans salamarket-drive. La centralisation vers
   salam-stock est un refactor pur, prévu sur une fenêtre dédiée après
   votre validation. »**

3. **« Les bugs connus sont documentés et chiffrés (POST_MISSION_AUDIT.md).
   Effort restant avant LIVE prod : ~10h, dominé par le câblage
   Supabase Auth côté Next.js. »**

---

## Recovery plan (si bug en démo)

| Symptôme | Plan B |
|---|---|
| `/staff/preparation` vide alors que la commande est passée | Montrer directement la table `commandes_drive` via Supabase Dashboard → "La trigger de sync est en cours d'investigation post-démo." |
| Stripe Elements ne charge pas (clé non remplie) | Skipper l'Acte 1.7, basculer sur le checkout hosted Stripe historique pour démontrer le paiement. Montrer ensuite `<DriveStripePayment>` en local dev. |
| Capture Stripe échoue (user_id pas UUID) | Expliquer la limitation auth zustand-local actuelle. Montrer le code de `lib/staff/preparation-actions.ts` pour expliquer ce qui se passerait avec auth Supabase. |
| `/drive-au-poids` 404 | Vérifier que le commit `86b3d92` (feat(drive-au-poids)) est bien dans le déploiement local. |
| Mode `live` Stripe par erreur | Volontaire : l'app refuse de démarrer. Reset clé en `sk_test_…`. |

---

## Liens rapides

- Commits drive : `git -C /Users/mac/salamarket-drive log --oneline -10`
- Commits stock : `git -C /Users/mac/salam-stock log --oneline -10`
- Migration SQL : `/Users/mac/salamarket-drive/supabase/migrations/0029_drive_au_poids.sql`
- Tests : `cd /Users/mac/salamarket-drive && npm run test`
- DEMO_BRIEF antérieur (Labo + Pro) : `/Users/mac/salamarket-drive/DEMO_BRIEF.md`
- AUDIT_REPORT antérieur : `/Users/mac/salamarket-drive/AUDIT_REPORT.md`
- BLOCKERS (8 hypothèses) : `/Users/mac/salamarket-drive/BLOCKERS.md`
- POST_MISSION_AUDIT (8 questions) : `/Users/mac/salam-stock/POST_MISSION_AUDIT.md`
- MISSION_REPORT (récap général) : `/Users/mac/salam-stock/MISSION_REPORT.md`

Bonne démo.
