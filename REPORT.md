# SALAM STOCK — RAPPORT DE LIVRAISON

> Mission de nuit · démo prête pour le RDV de dimanche après-midi avec Ahmed & Otmane

## URL DE PRODUCTION

# **https://salam-stock.vercel.app**

Ouvre l'URL sur ton iPhone, Safari, ajoute à l'écran d'accueil pour la PWA standalone.

---

## Comptes de test

Pas de mot de passe — sur l'écran de login on tape la card du profil :

| Profil | Rôle | Initiales | Bouton après login |
|---|---|---|---|
| **Ahmed Nasri** | Directeur | AN | Dashboard |
| **Otmane Belkacem** | Manager | OB | Dashboard |
| **Mehdi Tazi** | Employé | MT | Réception |

---

## Ce qui marche à 100%

### Tunnel de réception (cœur du métier)
- Liste BL en attente avec carte par fournisseur (BC-2026-0142 Maamora, BC-2026-0143 Doux Halal)
- Scan code-barres caméra **vraiment fonctionnel** via html5-qrcode (cadre gold + détection auto)
- Capture photo carton **vraiment fonctionnelle** via getUserMedia (preview + retake + base64)
- Saisie quantité par +/− ou clavier numérique
- Calcul d'écart en temps réel par ligne (badge vert/orange/rouge selon seuil)
- Bouton « Pas de code-barres → générer EAN interne » qui produit un EAN13 préfixé `290`
- Modale obligatoire « Justifier l'écart » si écart global > 5%, avec textarea + bouton « Notifier Ahmed »
- Validation enregistre la réception (date, user, photos, justification) puis redirige vers historique avec toast
- Historique : conformité, photos en miniature, justification, badge fournisseur, taux global

### Dashboard manager
- Header dégradé vert + label gold ESPACE ADMIN + avatar + bouton settings
- Pill période Aujourd'hui / Cette semaine / Ce mois
- 4 KPI cards : Conformité 96% (graphique courbe), Écarts détectés, Réceptions traitées (bar chart), Valeur du stock (calculée live)
- Activité récente avec 5 dernières actions, icônes par type, qui+quand
- 3 alertes IA mises en avant (clic → centre d'alertes)
- Carte CTA Assistant Salam en bas

### Inventaire tournant
- Tirage aléatoire de 5 produits (priorise ceux non comptés sur 7+ jours)
- Saisie comptage par produit avec stock théorique affiché
- Photo obligatoire si écart > 0
- Validation calcule conformité, modale résultat avec message contextuel (« Bravo », « Ahmed notifié »)
- Persistance en sessionStorage de l'inventaire en cours
- Historique des inventaires avec détail produit par produit

### Catalogue
- Grille 2 colonnes mobile, search bar, pills de catégorie scrollables
- 35 produits halal/maghrébin réalistes (Olives, Harissa, Dattes Medjool, Couscous Dari, etc.)
- Badge « Stock bas » sur produits sous le seuil mini
- Bouton flottant + en bas à droite → création
- Détail produit : prix, marge, stock, fournisseur, code-barres, dernière réception, historique réceptions

### Création produit
- Formulaire complet (nom, marque, catégorie, code-barres, fournisseur, prix achat/vente, stock initial/mini, unité)
- Bouton « Créer par photo IA » avec loading 1,6s puis pré-remplissage simulé
- Badge « Bêta — propulsé par Claude »
- Bouton scan code-barres caméra dans le champ EAN

### Centre d'alertes
- 8 alertes pré-générées (écart, anomalie, vitesse écoulement, suspicion, conformité, recommandation)
- Filtres Toutes / Critiques / Recommandations / Conformité
- Badges sévérité, icônes par type
- Sheet de détail avec 3 actions : Marquer traité / Investiguer / Notifier équipe (toasts confirmant)
- Persistance du flag « traité »

### Assistant IA simulé
- Chat full-screen avec header dégradé vert + indicateur « En ligne »
- 3 questions rapides : « Quels écarts cette semaine ? » / « Produits en rupture ? » / « Analyse une livraison »
- Indicateur « Assistant réfléchit… » avec 3 dots animés
- Réponses pré-écrites riches avec **gras**, listes à puces, chiffres tirés des données
- Champ saisie libre actif (renvoie un message « disponible en V2 »)
- Disclaimer en bas

### Login + Compte
- 3 cards utilisateur avec avatar gold initiales, rôle, email
- Compte avec sections PERSONNEL et ESPACE PRO (filtré par rôle)
- Lien « Réglages admin » réservé directeur
- Bouton « Se déconnecter » en rouge

### PWA
- Manifest avec name, theme color #0E3B2E, background #FAF7EE
- Icons 192/512 + apple-touch-icon générés (logo S gold sur fond vert)
- `display: standalone`, viewport mobile-first 390px

### Design system
- Tokens CSS exacts (couleurs, ombres, radius, typo Plus Jakarta Sans)
- Composants `btn-primary`, `btn-gold`, `btn-ghost`, `btn-fab`, `pill-filter`, `card`, badges
- Bottom navigation 4 items (Accueil/Stock/Commandes/Compte) avec barre gold sur item actif
- Avatars gold à pastille verte
- Floating bottom bar style « Mon panier » réutilisée sur Réception et Inventaire

---

## Ce qui est partiel ou simplifié

| Élément | État | Raison |
|---|---|---|
| Bouton « Photo IA » dans la création produit | Simulé (1,6s puis pré-remplit avec un produit aléatoire) | Pas d'appel IA réel — c'est conforme au brief |
| Assistant : champ saisie libre | Actif mais retourne uniquement une réponse générique pour les questions hors `écarts/rupture/livraison` | Conforme au brief (V2) |
| Pages partagées par les rôles | Tout le monde peut accéder à toutes les routes une fois loggé | Le brief demande que les managers aient « tout », les employés « Réception+Inventaire » : pas de hard-block sur les autres routes (l'employé peut donc voir le dashboard) — à durcir si besoin |
| `next-pwa` package | Pas installé : on utilise le manifest natif Next.js + meta apple-web-app + icons. Suffisant pour l'install écran d'accueil iPhone | Plus simple et fiable, évite les conflits service-worker pour la démo |
| Bouton « Photo (URL) » dans la création produit | Champ texte uniquement (l'upload est marqué V2) | Simplification volontaire |
| Données en localStorage | Tout (réceptions créées, alertes traitées, inventaires) persiste localement, partagé entre onglets | OK pour la démo mais ne traverse pas les appareils |

---

## Bugs connus

- Les images Picsum peuvent être lentes à charger la première fois (CDN tiers). Faire un premier passage dans le catalogue avant la démo pour tout pré-charger.
- Si l'utilisateur refuse l'accès caméra dans Safari, il faut quitter le scanner et le rouvrir manuellement (un message clair lui explique pourquoi).
- L'inventaire en cours est mémorisé dans sessionStorage : recharger la page avec F5 le préserve, mais fermer l'onglet Safari le perd. C'est volontaire pour pouvoir relancer un nouveau tirage à la demande.

---

## Checklist à faire avant le RDV

1. Ouvrir https://salam-stock.vercel.app sur ton iPhone Safari
2. Logger comme Ahmed → vérifier que le dashboard charge avec les 4 KPI et le graphique
3. Aller dans Réception, ouvrir le BL Maamora « BC-2026-0142 », appuyer sur **Scanner code-barres** : autoriser la caméra (la première fois Safari demande)
4. Faire un test rapide d'inventaire : ouvrir Stock → bouton hamburger « Inventaire » (depuis Compte ou taper /inventaire) — cocher 5 produits
5. Ouvrir Catalogue → bouton + → tester « Créer par photo IA » pour voir l'effet
6. Ouvrir Alertes → cliquer une alerte critique → voir la sheet
7. Ouvrir Assistant → cliquer chacune des 3 questions rapides
8. Ajouter à l'écran d'accueil pour la démo en mode app
9. Si tu veux remettre l'état initial : `localStorage.clear()` dans la console Safari, ou utiliser un mode privé Safari pour la démo

---

## Scénario de démo en 5 minutes

**Ouverture (30s)** — Tu ouvres l'app PWA depuis l'écran d'accueil iPhone.
> « C'est une démo locale, à terme c'est connecté à votre Odoo. »

**Login (15s)** — Tu te connectes en tant qu'Otmane.

**Dashboard (45s)** — Tu fais défiler les 4 KPI :
> « Conformité réceptions, écarts détectés, réceptions traitées, valeur du stock. Tout en temps réel. Le graphique compare la semaine en cours à la semaine dernière. »

**Réception (90s)** — Cœur de la démo.
- Aller dans Commandes → ouvrir BC-2026-0142 Maamora
- Appuyer **Scanner**, montrer la caméra et le cadre gold
- Compter +12 sur Olives, +24 sur Couscous, mettre 18 au lieu de 20 sur quelque chose pour déclencher l'écart, prendre une photo
> « L'écart se calcule en temps réel, à partir de 5% on ne peut plus valider sans justification. »
- Justifier, valider, voir le toast « Ahmed a été notifié »
- Montrer l'historique : la nouvelle réception est dedans avec ses photos

**Inventaire (45s)** — Aller dans `/inventaire` (depuis Compte ou raccourci).
- Compter les 5 produits, photo si écart, valider
- Modale conformité

**Création produit IA (30s)** — Catalogue → bouton + → « Créer par photo IA »
> « Demain, en V2, l'employé pose le produit devant l'iPhone, l'IA lit l'étiquette et pré-remplit. Aujourd'hui c'est simulé pour montrer le flow. »

**Alertes + Assistant (45s)** — Centre d'alertes (3 critiques visibles), cliquer la suspicion sur Mehdi → puis Assistant → cliquer « Quels écarts cette semaine » pour montrer la réponse riche.

**Closing (15s)** — Retour dashboard.
> « Tout est local pour la démo, l'étape suivante c'est le branchement Odoo et la mise en prod sur l'iPhone du chef de rayon. »

---

## Pour redéployer plus tard

```sh
cd /Users/mac/salam-stock
vercel --prod --yes
```

L'alias `salam-stock.vercel.app` se met à jour automatiquement.

---

Bonne démo dimanche !
