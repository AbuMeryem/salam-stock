-- ════════════════════════════════════════════════════════════════
-- 0018 — Type client par produit (Particulier / Pro / Traiteur)
--
-- Règle métier Salam Market :
--   - Un produit est "Particulier" (vente individuelle classique)
--   - OU "Pro" (gros conditionnement, vente B2B aux restaurateurs)
--   - OU "Traiteur" (service traiteur sur commande)
--
-- Sur les commandes Drive, on agrège les types présents : badge unique
-- si toutes les lignes sont du même type, sinon 2 ou 3 badges côte à
-- côte.
-- ════════════════════════════════════════════════════════════════

alter table public.produits
  add column if not exists client_type text
    check (client_type in ('particulier','pro','traiteur'))
    default 'particulier';

-- Backfill heuristique :
--   1. est_traiteur=true → 'traiteur'
--   2. Conditionnement gros volume (10L, 5L, 5kg, 10kg, 20kg) → 'pro'
--   3. Sinon → 'particulier' (default)

update public.produits
   set client_type = 'traiteur'
 where est_traiteur = true;

update public.produits
   set client_type = 'pro'
 where (
     nom ~* '\m(10\s*L|5\s*L|10\s*kg|5\s*kg|20\s*kg|25\s*kg|3\s*kg|2\s*kg)\M'
     or nom ~* '\m(seau|carton|caisse)\M'
   )
   and client_type = 'particulier';

create index if not exists idx_produits_client_type
  on public.produits(client_type);

notify pgrst, 'reload schema';
