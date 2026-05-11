# PRODUCT.md — Salam Stock V2

## Register

**product** — App opérée sur le terrain. Le design SERT la rapidité d'opération en magasin, il n'est pas le produit à vendre.

## Target users

Trois profils opérationnels physiquement présents au magasin Salam Market (Toulouse, 8 av. Larrieu-Thibaud) :

- **Otmane** — manager du magasin, 35 ans. Sur iPhone 14/15 avec gants en rayon surgelé, doigts mouillés sur la poissonnerie, regards rapides entre 2 clients. Veut un coup d'œil global multi-dépôts en 3 secondes et zéro friction sur les actions répétitives (réception fournisseur, sortie casse, transfert).
- **Ilyes** — préparateur drive, 22 ans. Scanne au rythme d'un tag/seconde. A besoin que l'app suive son rythme sans le ralentir. Tolère zéro confirmation inutile.
- **Ahmed** — admin retail. Plus à l'aise sur iPad. A besoin d'agréger les chiffres et de remonter les anomalies.

Quatrième profil ajouté tard : **Reda**, réception entrepôt back-office Sodrune, PIN 4321.

Contexte environnemental :
- Lumière magasin sodium chaud par moment, néon blanc dans le frais, plein soleil derrière les baies vitrées
- Bruit ambiant, mains prises (carton, panier roll, doigts mouillés)
- Connexion 4G/Wi-Fi du magasin, fiable mais pas garantie
- Sessions courtes (30s à 2min), beaucoup de scan-and-tap

## Product purpose

Remplacer Excel + post-it + appels téléphoniques entre les 3 dépôts (Particulier, Professionnel, Sodrune). Centraliser :

1. **Réception fournisseur** avec apprentissage automatique des codes-barres carton (différenciant fort vs concurrents)
2. **Sortie de stock** (casse / périmé / démarque) avec IA Claude Vision qui audite la cohérence photo/déclaration
3. **Transferts inter-dépôts** atomiques
4. **Inventaire tournant** auto-assigné chaque matin via cron Vercel
5. **Drive multi-zones** (Particulier / Professionnel / Traiteur) avec ordre optimisé surgelés-d'abord
6. **Étiquettes EAN-13 internes** générées en PDF pour Brother QL-820
7. **Dashboard admin** vision unifiée 3 dépôts + alertes IA

## Brand personality

- **Sérieux et chaud à la fois**. Le sapin profond évoque la rigueur (compta, traçabilité, audit fiscal halal). L'or chaleur (épicerie maghrébine, dattes, miel, thé, marché traditionnel).
- **Crémeux, pas blanc**. Le fond `#FAF7EE` est un blanc cassé chaud, jamais clinique. Pas d'hôpital.
- **Posé**. Aucun effet "wow" gratuit. Le wow vient de la rapidité d'exécution.
- **Précis**. Tabular-nums sur les chiffres, mono-font sur les EAN. La donnée doit être lisible au quart de seconde.

## Anti-references

- **Stripe-style dashboard** — propre mais froid, gris-bleu, sans-âme. Refusé.
- **Notion glassmorphism** — flou pour le flou. Refusé.
- **Shopify default green** — c'est leur identité, pas la nôtre.
- **Linear monochrome violet** — magnifique pour SaaS B2B, hors-sujet pour retail terrain.
- **Hero metrics géants façon Wise/Revolut** — pas la vie quotidienne d'Otmane.
- **Bento grids** — déjà vu partout depuis 2 ans.
- **Generic emoji 🧪 ou icônes Lucide brutes sans contexte** — déjà refusé pour le logo.

## Strategic design principles

1. **One-thumb operation**. Le pouce gauche tient l'iPhone, le pouce droit fait tout. Toutes les actions critiques à portée de pouce (bas-droite ou bas-centre). Aucune action critique en haut de l'écran.
2. **Gros tactile, jamais petit**. Minimum 44pt par cible. Boutons primaires 56pt de haut. Boutons secondaires 44pt min. Aucun chip sub-32pt.
3. **Lisible dans une vitre, à 30cm, sous néon**. WCAG AA minimum. Contrastes texte/fond ≥ 4.5:1 partout. Tailles body ≥ 15px.
4. **Tactile feedback obligatoire**. Chaque tap a une réaction visible (scale, opacity, color flash) en <100ms. Pas de "rien ne s'est passé".
5. **Zéro modale par réflexe**. Toujours préférer l'inline + progressive disclosure. Modale uniquement pour les workflows multi-étape (apprentissage carton, photo capture).
6. **Toast court, jamais bloquant**. Max 2400ms. Position top-center sous le Dynamic Island. ID stable pour éviter les doublons.
7. **Le chiffre prime sur le décor**. Un chiffre de stock à 4 chiffres se voit avant tout. Le reste est contextualisation.
8. **Empty state = guide d'action**. Jamais un blanc nu. Toujours un visuel + texte court + bouton primaire qui pointe vers l'action.
9. **Loading = squelette, pas spinner sauf <500ms**. Squelette qui reprend la forme du contenu final.
10. **Motion purposive**. `framer-motion` pour les transitions de page + apparition des cards. JAMAIS pour décorer. Ease-out exponentiel, jamais bouncy.

## Scope

V2 (cette branche `v2-multi-depots`). Pages couvertes :
- `/v2/login` (auth PIN)
- `/v2` (hub manager / employé)
- `/v2/reception` (workflow scan + apprentissage carton)
- `/v2/sortie` (sortie + IA Claude vision)
- `/v2/transfert` (transferts atomiques)
- `/v2/stock` (catalogue par dépôt)
- `/v2/admin` (dashboard multi-dépôts)
- `/v2/preparation` + `/v2/preparation/[id]` (drive multi-zones)
- `/v2/inventaire` + `/v2/inventaire/historique`
- `/v2/etiquettes` (PDF EAN-13)

## Hors scope

- V1 routes (`/`, `/login`, `/dashboard`, etc.) — gelées
- Schéma Supabase — gelé (migrations 0001 à 0006 déjà en place)
- Routing / auth flow — gelé
