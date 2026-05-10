# SALAM STOCK — DÉPLOIEMENT

## URL de production

# https://salam-stock.vercel.app

(alias automatique du déploiement `salam-stock-g5ujm99ec-abumeryems-projects.vercel.app`)

## Inspection Vercel
https://vercel.com/abumeryems-projects/salam-stock/CyztJLueL99zEpEwdV4CHdmuimo7

## Comptes de test

Sur l'écran de login, choisir un profil :

- Ahmed Nasri (directeur) — accès complet
- Otmane Belkacem (manager) — accès complet sauf paramétrage primes
- Mehdi Tazi (employé) — Réception + Inventaire uniquement

## Pour redéployer

```sh
cd /Users/mac/salam-stock
vercel --prod --yes
```

## Installation PWA (iPhone)

1. Ouvrir https://salam-stock.vercel.app dans Safari
2. Bouton « Partager » → « Sur l'écran d'accueil »
3. L'icône Salam Stock apparaît, l'app s'ouvre en standalone (sans la barre Safari)
