-- ─────────────────────────────────────────────────────────────────────────
-- 0002_remove_vol_identifie.sql
-- Bug client (RDV Otmane 12/05) : retirer le motif "Vol identifié" qui
-- n'est jamais utilisé en pratique (un employé honnête ne déclare pas un
-- vol, un employé malhonnête encore moins) et le remplacer par
-- "demarque_inconnue" qui matche la terminologie comptable retail
-- standard (écart constaté sans cause identifiée).
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. Drop la contrainte CHECK existante.
alter table public.sorties_stock
  drop constraint if exists sorties_stock_type_check;

-- 2. Re-map les lignes existantes (s'il y en a) vers le nouveau code.
update public.sorties_stock
   set type = 'demarque_inconnue'
 where type = 'vol_identifie';

-- 3. Re-créer la contrainte avec le nouveau jeu de valeurs.
alter table public.sorties_stock
  add constraint sorties_stock_type_check
  check (type in (
    'casse_manipulation',
    'casse_client',
    'perime_dlc',
    'perime_ddm',
    'defaut_fournisseur',
    'demarque_inconnue',
    'autre'
  ));

commit;
