# Démo Salam Stock V2 — 12 mai 2026 · 19h00

**Présent côté Otmane** : Otmane Jamal (manager Salam Market), Ahmed Nasri.
**Présent côté équipe** : Mohamed.
**Durée totale** : 13 minutes.
**Device** : iPhone 14 Pro iOS 26.4 + PWA Salam Stock installée.

---

## Pré-démo (à faire avant 18h)

1. **Migrations SQL** — sur Supabase Studio → SQL Editor, exécuter dans l'ordre :
   - `supabase/migrations/0012_bdl_livraisons.sql` (tables BDL + alertes_surplus)
   - `supabase/migrations/0013_push_subscriptions.sql` (Web Push)
   - `supabase/seed/0011_realistic_salam_market.sql` (120 produits + historique + 3 BDL today)

2. **Désinstaller l'ancienne PWA** sur iPhone 14, vider le cache Safari, **réinstaller** depuis `https://salam-stock.vercel.app/v2/login`.

3. **Login PIN 1234** (Otmane) → vérifier que :
   - 3 BDL apparaissent sur `/v2/reception` (KEREM, MAGHREB, FRANCE FRAIS)
   - Le bouton "Assistant IA" et "Alertes IA" s'affichent sur `/v2/admin`
   - La card WhatsApp recap rend correctement les chiffres

4. **Scanner sanity check** : ouvrir `/v2/reception` → BDL KEREM → scanner.
   - Si "Moteur : Safari natif" affiché + frames > 0 → ✅ OK
   - Si erreur permission → Réglages iPhone → Salam Stock → Caméra ON

---

## Script minuté

### [00:00 — 02:00] Tour d'horizon (Mohamed)

> "Otmane, on a livré V2 avec les 4 promesses du RDV de ce matin. Démarrons."

1. Ouvre la PWA iPhone → login PIN.
2. Show `/v2` (hub) : badges dépôt, raccourcis Réception / Sortie / Transfert / Dashboard.
3. Tap "Dashboard admin" → graphique CA temps réel Stock + toggle Drive.
4. Pointe les **3 pills colorés** en haut : "Récap fiscal", "Alertes IA", "Assistant IA".

### [02:00 — 06:00] Réception BDL KEREM — workflow professionnel

> "Voilà comment se passe une livraison fournisseur."

1. Tap onglet Réception en bas. → Section "Livraisons attendues aujourd'hui" → 3 cards.
2. Tap **BDL #2026-0142 KEREM HALAL** → header sticky + liste 8 produits attendus.
3. Tap "Scanner produit suivant" → bar debug montre `Moteur : Safari natif`.
4. Scanner **3 produits attendus** : épaule d'agneau (1) + cuisses poulet (3) + viande hachée (2).
   - Chaque scan → toast vert "+1" + progression `6/86 unités`.
5. Scanner un **4e produit hors BDL** (ex : Coca Zero) → modal rouge **"PRODUIT NON COMMANDÉ DÉTECTÉ"**.
   - Saisit quantité = 2 → tap "Signaler à Otmane et Ahmed".
   - Toast vert "Surplus signalé".
6. Tap les 2 emplacements photo palette → prend les 2 photos.
7. Tap "Valider la réception" → toast "Stock mis à jour" → retour /v2/reception.

> "Le surplus est maintenant dans le dashboard admin pour décision Otmane / Ahmed."

### [06:00 — 08:30] Dashboard alertes IA Otmane

1. Retour /v2/admin → tap pill rouge **"Alertes IA"**.
2. Show KPI top : 3 urgentes, démarque 7j, surplus, employés < 0.5.
3. Tap onglet **"Sorties suspectes"** → liste sorties IA score < 0.7.
   - Tap une sortie score 0.42 → modal détail avec photo + analyse Claude Vision.
   - Show les 3 boutons : Accepter / Demander clarification / Rejeter.
4. Tap onglet **"Démarque"** → écart **−14 unités Coca Zero = 30,80 €** + Yaourt + Fromage.
5. Tap onglet **"Surplus"** → card KEREM (12 cuisses hier) + le surplus qu'on vient de signaler.
6. Tap "Page complète surplus" → /v2/admin/alertes-surplus → boutons **Accepter facturer fournisseur / Refuser retourner**.

### [08:30 — 10:30] Assistant IA business

1. Retour /v2/admin → tap pill or-vert **"Assistant IA"**.
2. Empty state avec 5 suggestions. Tap **"Combien j'ai vendu de Coca cette semaine ?"**.
3. Typing dots → réponse Claude qui cite les chiffres exacts (CA, qté, panier).
4. Show badge expansible "1 tool exécuté" → `query_ventes_periode (date_start, date_end, produit_search)`.
5. Tape une question libre : **"Quels employés ont le score IA le plus bas ?"** → classement.

> "L'assistant interroge Supabase en temps réel via 6 tools : ventes, stock, alertes, top, employés, démarque. Aucune réponse inventée."

### [10:30 — 11:30] Récap WhatsApp 19h

1. Scroll en bas du dashboard admin → card **WhatsApp recap**.
2. Bulle WhatsApp authentique (fond beige + texte vert) avec :
   - CA jour calculé en temps réel
   - Drive + Magasin
   - 3 alertes urgentes
   - Réceptions OK / attendues
   - Top produit
3. Mention **"Envoyé tous les soirs à 19h00 à Otmane et Ahmed via WhatsApp Business. Activation pendant les Travaux de Mise en Service."**

### [11:30 — 13:00] Recap fiscal Drive + Rapport mensuel consolidé

1. Tap pill **"Récap fiscal du jour"** → ticket Z visuel Drive (CA, TVA par taux, modes paiement, NET).
2. Bouton "PDF" → Share Sheet iOS (Save to Files) → bar "Retour à l'admin" apparaît.
3. Tap pill **"Rapport mensuel"** → CA total consolidé + ventilation TVA + sections magasin/drive.
4. Bouton "CSV 4 sections" → DL → bar retour.

> "Tous les téléchargements sont iOS-PWA-safe : le scanner reste accessible, pas besoin de quitter l'app."

---

## Critères de succès

- ✅ Scanner décode un EAN-13 réel en < 5 secondes (Safari natif preferred)
- ✅ Workflow BDL bout en bout : scan → surplus → photo palette → validation
- ✅ Dashboard alertes : 3 alertes réalistes avec détails IA
- ✅ Assistant IA répond à 5 questions tests
- ✅ Mockup WhatsApp ressemble à un vrai message
- ✅ 120+ produits Salam Market crédibles
- ✅ Historique 14 jours visible dans graphs / listes
- ✅ Zéro erreur Next.js dans le scénario démo

## Si le scanner échoue

- **Plan B immédiat** : saisie manuelle EAN (bar visible sous le viseur).
- Tap les EAN : `10000001` (épaule agneau), `5449000131836` (Coca Zero).
- La démo continue sans rupture — démontrer que le filet de sécurité fonctionne.

## URLs prod

- App : `https://salam-stock.vercel.app/v2/login`
- BDL KEREM : `/v2/reception` → tap KEREM card
- Alertes : `/v2/admin/alertes`
- Surplus : `/v2/admin/alertes-surplus`
- Assistant : `/v2/admin/assistant-ia`
- Récap fiscal : `/v2/admin/recap-fiscal`
- Rapport mensuel : `/v2/admin/rapport-mensuel`
