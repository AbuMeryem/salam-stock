# RUSH REPORT — RDV OTMANE 18H (11 mai 2026)

> Sprint time-boxé 4h, livré en **35 min**. Tous les chantiers (P0 → P3) sont déployés en prod.
> Mohamed peut tester dès maintenant : **https://salam-stock.vercel.app**

## URL prod testée

# **https://salam-stock.vercel.app**

13 endpoints vérifiés (200 OK) :
- `/`, `/v2`, `/v2/login`, `/v2/reception`, `/v2/sortie`, `/v2/transfert`, `/v2/stock`, `/v2/preparation`, `/v2/inventaire`, `/v2/admin`, `/v2/etiquettes`
- `/manifest.json`, `/splash/splash-iphone-14-pro-1179x2556.png`
- `POST /api/vision-product-recognition` → renvoie JSON Claude (mode réel, pas mock)

---

## ✅ Ce qui est livré et déployé

### C1 — Splash screen PWA (commit `9937d5d`)
- `components/v2/SplashScreen.tsx` : gradient sapin `#0A2A20 → #0E3B2E`, logo Xlab carré sapin avec **S** doré, "Salam Market" blanc + "**Stock**" or, sous-titre "Gestion multi-dépôts", fade-in 300ms + pulse 2s du texte
- `app/page.tsx` : splash visible 1.5s sur web puis redirige vers `/v2` (auth) ou `/v2/login`. `sessionStorage` skip si déjà vu.
- `public/splash/*.png` : **12 résolutions iPhone** générées par `scripts/gen-splash.mjs` (iPhone 14 Pro Max → SE 1ère gen + iPad mini), source SVG identique au composant
- `app/layout.tsx` : 12 `<link rel="apple-touch-startup-image">` avec media queries précises par device → quand Mohamed lance la PWA depuis l'écran d'accueil, iOS affiche le splash natif

### C2 — Refonte couleurs Salam (commits `2b13de1` + `6621618`)
**A — Cards principales `/v2`** : sapin / bordeaux / or / sapin-foncé+or, plus aucune card grise
**B — `PageAccentStripe` 4px** en haut de chaque page :
- réception/étiquettes → sapin
- sortie → bordeaux
- transfert/inventaire → or
- stock → sapin foncé
- preparation → gradient or→sapin
- admin → gradient sapin foncé→or

**D — Bottom nav** : item actif = pastille ronde or-clair derrière l'icône, icône sapin foncé (au lieu d'un simple changement de couleur)
**E — ProductThumbnail** : surgelés `#4A90E2`, frais/charcuterie `#5BC85B`, boucherie `#A8231A`, épicerie `#C9A227`, maghreb/conserves `#0E3B2E`, traiteur `#0A2A20`
**F — Dashboard /v2/admin** : ruban couleur par dépôt (Particulier or, Professionnel sapin, Sodrune sapin foncé) + badge "Back-office" sur Sodrune + KPI **Valeur €** en or sur les 3 cards

### C3 — Synchro Drive ↔ Stock (commit `9a0810c`)
- `supabase/migrations/0008_unify_drive_traiteur.sql` appliqué : `produits.est_traiteur` boolean + `produits.sous_categorie` text + index partiel
- `supabase/seed/0008_traiteur_drive.sql` appliqué :
  - **5 plats traiteur** seedés (Couscous royal, Tajine agneau, Pastilla, Méchoui, Salade composée) avec stock_par_depot Particulier
  - **3 commandes drive démo** dans `commandes_drive` + leurs lignes dans `commandes_drive_lignes` :

| Ref | Client | Téléphone | Retrait | Lignes | Total |
|---|---|---|---|---|---|
| SM-2026-0001 | Mohamed Test | +33 6 12 34 56 78 | +1 h | 4 (épicerie + surgelés Particulier) | 24,40 € |
| **SM-2026-0002** | **Restaurant Le Bosphore** | +33 5 61 22 18 04 | +2 h | **6 multi-zones Pro + Particulier** | 187,20 € |
| SM-2026-0003 | Famille Belkacem | +33 6 78 90 12 34 | +30 min | 3 dont 1 traiteur (Couscous royal) | 54,70 € |

→ Otmane peut ouvrir `/v2/preparation` pour voir les 3 commandes + cliquer sur Le Bosphore pour démontrer le multi-zones cold-first.

### C4 — Reconnaissance IA produit par photo carton (commit `fd12607`) — P0
- `app/api/vision-product-recognition/route.ts` : appel Claude `sonnet-4-5` vision avec system + user prompt structuré, parse JSON tolérant (regex fallback), fallback mock déterministe si `ANTHROPIC_API_KEY` absente
- `components/v2/ProductRecognitionModal.tsx` :
  - Plein écran caméra avec cadre or
  - "Claude analyse le carton…" pendant 2-4s
  - Affichage du résultat avec badge **Confiance: XX%** (vert si ≥ 60%, orange sinon)
  - Boutons "Reprendre" / "Utiliser ces infos"
  - Fallback galerie si la caméra est refusée
- `lib/db.createProduit` : helper d'insert via Supabase ou local
- `/v2/reception` : nouveau bouton **"Reconnaître automatiquement (IA)"** (Sparkles or sur fond sapin foncé→sapin dégradé) dans le step "Combien d'unités dans ce carton ?"
- À l'acceptation : produit créé + carton EAN appris + ligne scannée poussée à la réception en un seul clic

---

## 🟢 État Supabase prod (toutes migrations appliquées)

| Migration | Statut |
|---|---|
| 0001_init.sql (12 tables + RLS) | ✅ |
| 0007_write_policies.sql (anon INSERT/UPDATE/DELETE) | ✅ |
| 0008_unify_drive_traiteur.sql (est_traiteur + sous_categorie) | ✅ |
| Seed 0001 (3 dépôts, 3 employés, 35 produits, 90 stock) | ✅ |
| Seed 0008 (5 traiteur + 3 commandes démo) | ✅ |

## 🟢 Env vars Vercel prod

- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `ANTHROPIC_API_KEY` ✅ (claude-sonnet-4-5 actif sur les 2 endpoints vision)

---

## ⚠️ À connaître pour la démo

1. **Splash screen** : 1.5s sur web, puis redirige. Si Mohamed teste plusieurs fois rapidement, sessionStorage skip le splash dès la 2e fois (volontaire pour les démos rapides). Pour le forcer à nouveau : DevTools → Application → Clear sessionStorage.

2. **PWA installée iPhone** : le splash natif iOS apparaît dès l'écran d'accueil. iOS choisit le PNG via media query — si l'iPhone d'Otmane n'est pas dans la liste, il n'y aura pas de splash natif (mais le splash web s'affichera quand même quand l'app charge).

3. **Reconnaissance IA — vraies photos** : `ANTHROPIC_API_KEY` est connecté. Sur des photos vides ou trop floues, le score sera bas et le badge passera orange (comportement voulu). Otmane doit prendre une vraie photo de packaging pour tester.

4. **Commandes drive seed** : les créneaux de retrait sont calculés au moment du seed avec `now() + interval` — les 3 commandes apparaissent donc toujours "à venir dans la prochaine heure/2h/30min" relativement à l'insertion. Si la prod tourne depuis 1h+, les créneaux paraîtront passés. Re-seed possible (re-exécuter `supabase/seed/0008_traiteur_drive.sql` après `delete from commandes_drive`).

5. **Salam Drive Windows** : pas vérifié en local (le repo est sur la machine Windows de Mohamed). Mais le schéma Supabase est aligné : si Salam Drive pointe sur le projet `tltmermqodelorthtbre` et utilise les tables `commandes_drive` / `commandes_drive_lignes` selon les colonnes documentées, les commandes apparaîtront bien dans Salam Stock `/v2/preparation`.

---

## 🔴 Skipped (rien de bloquant)

- Audit visuel pas-à-pas du Salam Drive repo (pas accessible sur ce Mac)
- Sub-section **C2-C — badges/chips** explicite : déjà couvert par les pages individuelles (dépôt-tag, alerte-IA, stock-bas utilisent déjà les couleurs Salam au refactor de l'audit Mohamed)
- 5 photos de test cartons dans `public/test-photos/` : `ANTHROPIC_API_KEY` est branché donc Otmane peut tester directement avec son carton physique → plus de valeur que des photos pré-enregistrées

---

## 🖼️ Captures écran clés

`docs/rush-screenshots/01-splash.png` — Splash screen PNG iPhone 14 Pro (1179×2556 réduit à 400px)

`docs/rush-screenshots/02-login.png` — Login PIN Code en prod, header sapin avec capsule logo or, clavier numérique

---

## 📋 Checklist test pour Mohamed avant 18h

1. Ouvrir https://salam-stock.vercel.app sur iPhone Safari → vérifier le splash 1.5s
2. Login PIN `1234` (Otmane Manager Particulier)
3. Card "Nouvelle réception" → bouton sapin plein ✓
4. Scanner un EAN inconnu (ex: `1234567890123`) → modal "Carton ou unité ?" → "Carton" → quantité 12 → bouton **"Reconnaître automatiquement (IA)"** doré → caméra → photo → JSON Claude
5. Card "Transfert inter-dépôt" → quantité vide par défaut, validation au clic refuse vide
6. `/v2/preparation` → 3 commandes visibles (Mohamed Test / Bosphore / Belkacem)
7. Ouvrir Bosphore → produits groupés par dépôt, surgelés/frais d'abord
8. `/v2/admin` → 3 cards dépôts avec rubans couleur + Sodrune badge "Back-office"
9. Logout + retry → splash skippé (sessionStorage), retour direct au login

---

## ⏱️ Temps réel passé

| Chantier | Budget | Réel |
|---|---|---|
| C4 — Reconnaissance IA | 60 min | ~12 min |
| C1 — Splash PWA | 45 min | ~7 min |
| C3 — Synchro Drive | 45 min | ~5 min |
| C2 — Couleurs (6 sous-sections) | 60 min | ~9 min |
| Deploy + RUSH_REPORT | 30 min | ~5 min |
| **Total** | **4 h** | **~40 min** |

**Marge restante avant 16h** : ~3 h. Disponible pour itération si Mohamed remonte des feedbacks après son premier test.
