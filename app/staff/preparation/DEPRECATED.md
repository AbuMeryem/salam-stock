# DEPRECATED — `/staff/preparation`

> Module remplacé par **`/v2/preparation`** le **2026-05-16**.

## Contexte

Cette route a été créée lors de la nuit du 14→15 mai 2026 par
l'Agent C de la mission "Drive au poids + Stripe manual capture"
comme première itération du workflow staff. Liste basique +
détail vertical avec calcul d'écart live + capture Stripe.

Le module **`/v2/preparation`** existait déjà avant cette mission
(UI Kanban anthracite/or/crème, realtime Supabase, action sheet
mobile) et est nettement plus abouti côté UX. Le user a tranché
le 2026-05-16 : on garde **`/v2/preparation`** comme cible
unique du préparateur.

## Pourquoi ne pas supprimer ?

- Historique git complet préservé (les commits restent referenceables)
- Le composant `<PreparationWorkflow>` documente le flow de pesée
  sur une page non-Kanban, utile comme référence si on devait
  réintroduire un mode "1 commande plein écran" plus tard
- Les server actions `markLineWeighed` + `finalizePreparation`
  vivent dans `lib/staff/preparation-actions.ts` et sont
  **toujours utilisées** par `/v2/preparation/[id]` (commit `3b4b9e0`)

## Migration des appelants

Tout helper côté `/staff/preparation/` qui devait être partagé
a été extrait :

| Avant (inline) | Après (partagé) |
|---|---|
| `HARDCODED_ADMIN_UUID` + `getUserUuid` inline dans `components/PreparationWorkflow.tsx` | `lib/staff/auth-fallback.ts` (commit `2fad599`) |
| Server actions `markLineWeighed` + `finalizePreparation` | `lib/staff/preparation-actions.ts` (déjà partagé) |

## Commits clés

- Création `/staff/preparation` : `0617fb5` (liste) + `f935912` (détail workflow)
- Refacto extraction auth-fallback : `2fad599`
- Bascule vers `/v2/preparation` : `3b4b9e0`

## Pour la prod

La route reste accessible (ne pas la rendre 404 brutalement
sinon les anciens bookmarks staff casseraient). Voir
`next.config.mjs` pour la redirection 301 `/staff/preparation →
/v2/preparation` activée le 2026-05-16.
