# SALAM STOCK — TODO post-démo

Améliorations à intégrer après le rendez-vous de dimanche.

## Backend / intégration Odoo
- [ ] Créer client API Odoo (XML-RPC ou Odoo.sh REST), remplacer Zustand par fetch + revalidation
- [ ] Mapper les modèles `purchase.order`, `stock.move`, `product.product`, `res.users`
- [ ] Synchroniser les réceptions validées (créer `stock.picking` + `stock.move`)
- [ ] Pousser les inventaires (`stock.quant.inventory`)
- [ ] Récupérer la liste des fournisseurs et des employés depuis Odoo

## Permissions
- [ ] Hard-block les routes Dashboard / Compte → Réglages pour le rôle "employe" via middleware
- [ ] Ajouter une page d'erreur `403`
- [ ] Implémenter la séparation Otmane vs Ahmed sur le paramétrage primes

## IA réelle
- [ ] Brancher un appel Claude pour la création produit par photo (vision)
- [ ] Brancher l'assistant chat sur Claude avec context window des données réelles
- [ ] Générer les alertes IA via une routine planifiée (cron Vercel) plutôt qu'un JSON statique

## PWA / mobile
- [ ] Ajouter `next-pwa` pour cache offline (lecture catalogue sans réseau)
- [ ] Push notifications pour les alertes critiques
- [ ] Splash screens iOS

## UX
- [ ] Pull-to-refresh sur les listes
- [ ] Skeletons sur le premier chargement (à la place du spinner pleine page)
- [ ] Animation confettis sur conformité 100%
- [ ] Mode sombre (variants des tokens déjà en place)

## Production
- [ ] Connecter le domaine custom (`stock.salammarket.fr` ?)
- [ ] Activer Vercel Analytics
- [ ] Mettre en place Sentry pour les erreurs caméra/scan
- [ ] Tests Playwright sur le tunnel réception
