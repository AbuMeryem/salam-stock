-- ════════════════════════════════════════════════════════════════
-- 0020 — Ajoute le statut "a_preparer" sur commandes_drive
--
-- Workflow Salam Drive après cette migration :
--   1. Client paie sur Drive          → 'a_preparer'  (NEW, défaut)
--   2. Employé accepte la commande    → 'en_preparation'
--   3. Employé termine la préparation → 'pret'
--   4. Client retire en magasin       → 'retire'
--   ( ou 'annule' à tout moment )
--
-- Migration non-destructive :
--   - Élargit le check pour accepter le nouveau statut
--   - Change le default à 'a_preparer'
--   - NE TOUCHE PAS au trigger sync_drive_to_stock (la migration 0009
--     gère déjà le mapping. Si le drive insère explicitement
--     'en_preparation' on garde le comportement actuel ; sinon le
--     DEFAULT s'applique).
--   - NE TOUCHE PAS aux lignes existantes (les commandes déjà
--     'en_preparation' restent là).
-- ════════════════════════════════════════════════════════════════

alter table public.commandes_drive
  drop constraint if exists commandes_drive_statut_check;

alter table public.commandes_drive
  add constraint commandes_drive_statut_check
  check (statut in ('a_preparer','en_preparation','pret','retire','annule'));

alter table public.commandes_drive
  alter column statut set default 'a_preparer';

notify pgrst, 'reload schema';
