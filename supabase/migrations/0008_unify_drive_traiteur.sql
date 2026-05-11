-- ════════════════════════════════════════════════════════════════
-- 0008 — Aligne le schéma drive avec ce que le code V2 attend.
-- - produits.est_traiteur : flag pour la zone "Traiteur" du drive
-- - produits.sous_categorie : optionnel, utilisé par la reco IA
-- ════════════════════════════════════════════════════════════════

alter table public.produits
  add column if not exists est_traiteur boolean not null default false;

alter table public.produits
  add column if not exists sous_categorie text;

create index if not exists idx_produits_traiteur on public.produits(est_traiteur) where est_traiteur = true;
