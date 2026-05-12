# Guide migration — unification Drive ↔ Stock sur un seul Supabase

**Décision** : on lâche le Supabase Drive (`rvdelylmyyyelgfatewy`, non accessible côté admin) et on rapatrie tout sur le Supabase Stock (`tltmermqodelorthtbre`).

**Bénéfices long terme** :
- Une seule base, une seule auth, un seul catalogue produits
- Le trigger Postgres `sync_drive_order_to_stock` fonctionne nativement (plus de cross-project sync impossible)
- Realtime Supabase entre orders et le Kanban Stock instantané
- Un seul billing Supabase, une seule rotation de clés à gérer
- Un retrait Drive décrémente vraiment le stock magasin (via FK partagé)

## Étapes de cutover (à exécuter dans l'ordre)

### 1. Migration SQL côté Stock (5 min)

Va sur le SQL Editor de Stock : https://supabase.com/dashboard/project/tltmermqodelorthtbre/sql

Copie-colle le contenu de [`supabase/migrations/0022_unify_drive_into_stock.sql`](./supabase/migrations/0022_unify_drive_into_stock.sql) et exécute. Cette migration :
- Crée `profiles`, `pickup_slots`, `orders`
- Ajoute 6 colonnes Drive à `produits` (visible_drive, prix_drive_cents, etc.)
- RLS, triggers, realtime activés

**Aucun impact** sur les données Stock existantes (additive).

### 2. Déployer les 6 edge functions Drive sur Stock Supabase (10 min)

Depuis ton terminal, dans `/Users/mac/salam-stock` :

```bash
# Authenticate avec ton compte Supabase
supabase login

# Linker le repo au projet Stock
supabase link --project-ref tltmermqodelorthtbre

# Déployer les 6 fonctions
supabase functions deploy confirm-order \
  create-checkout-session \
  ensure-slots \
  notify-new-order \
  update-order-status \
  verify-checkout-session
```

### 3. Configurer les secrets Stripe + Resend + Web Push sur Stock (5 min)

Les edge functions ont besoin de variables Supabase secrets. Va sur :
https://supabase.com/dashboard/project/tltmermqodelorthtbre/functions/secrets

Ajoute (récupère les valeurs du dashboard Drive original `rvdelylmyyyelgfatewy` si tu y as accès, sinon recrée des clés neuves) :
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY` (si email recap activé)
- `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` (web push)
- `VAPID_SUBJECT` = `mailto:rmdiscount3182@gmail.com`

### 4. Seed quelques produits Drive (2 min)

Toujours dans le SQL Editor Stock :

```sql
update public.produits
   set visible_drive = true,
       prix_drive_cents = round(prix_vente * 100 * 1.1)::int,
       drive_unit = 'piece',
       drive_category = lower(coalesce(categorie, 'epicerie'))
 where prix_vente is not null
   and visible_drive = false
limit 20;
```

Ça active 20 produits Stock comme produits Drive avec un prix +10% vs magasin (à ajuster).

### 5. Mettre à jour les env Vercel Drive (3 min)

```bash
cd /Users/mac/salamarket-drive

# Retire les anciennes
vercel env rm VITE_SUPABASE_URL production --yes
vercel env rm VITE_SUPABASE_PUBLISHABLE_KEY production --yes
vercel env rm VITE_SUPABASE_PROJECT_ID production --yes

# Ajoute les nouvelles (Stock)
echo "https://tltmermqodelorthtbre.supabase.co" | vercel env add VITE_SUPABASE_URL production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdG1lcm1xb2RlbG9ydGh0YnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjQwMDksImV4cCI6MjA5MjkwMDAwOX0.0PHyLa0a0Aar8ukfdGWw_rtnbwiQ-QaM640Y1VysaAM" | vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
echo "tltmermqodelorthtbre" | vercel env add VITE_SUPABASE_PROJECT_ID production
```

### 6. Merger les PR + déployer (5 min)

```bash
# Stock — déjà mergé via PR #42, juste déployer
cd /Users/mac/salam-stock
vercel --prod --yes

# Drive — merger la PR #72 puis déployer
cd /Users/mac/salamarket-drive
gh pr merge 72 --merge --repo Milouze27/salamarket-drive
git checkout main && git pull
vercel --prod --yes
```

## Test end-to-end (10 min)

1. Ouvre `salamarket-drive.vercel.app` en navigation privée
2. Inscris-toi avec un email test (le trigger `handle_new_user` doit créer une profile automatiquement)
3. Ajoute 2-3 produits au panier (parmi les 20 produits Drive seedés)
4. Choisis un créneau de retrait (créé par `ensure-slots`)
5. Checkout → paiement Stripe test ou paiement magasin
6. Sur la page de confirmation → panier vide ✓ (PR #69 + #70)
7. Ouvre `salam-stock.vercel.app/v2/preparation` côté employé
8. La commande doit apparaître **dans la colonne "À préparer"** en quelques secondes (trigger `sync_drive_order_to_stock`)
9. Tap "Accepter la commande" → bascule en "En préparation" → notif live côté Drive client

## Si quelque chose casse

- Migration applique correctement : pas de risque de perte de données (additive)
- Edge functions déploiement échoue : on peut redéployer une à une
- Drive ne s'ouvre plus : redéploie avec les anciens env vars en attendant
- Trigger ne fire pas : vérifier `select * from public.sync_drive_order_to_stock` est bien défini dans le SQL editor

## Long terme (post-cutover)

- Supprimer le projet Supabase Drive d'origine (`rvdelylmyyyelgfatewy`) pour cesser le billing
- Documenter qui possède quoi (Vercel + Supabase) pour la passation
- Mettre en place un backup automatique du Supabase Stock (point de restauration)
- Rotation des clés service-role tous les 6 mois
