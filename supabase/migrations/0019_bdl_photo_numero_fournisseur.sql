-- ════════════════════════════════════════════════════════════════
-- 0019 — Photo papier BDL + numéro BDL fournisseur
--
-- Rationale : on garde l'usage interne de bons_de_livraison.numero_bdl
-- comme identifiant Salam Market. Le numéro imprimé sur le BDL papier
-- du fournisseur (BL-2026-..., FACT-...) est différent et doit être
-- archivé séparément pour les litiges/réconciliations factures.
--
-- photo_bdl_url : data URL ou URL Storage du scan/photo du BDL papier
-- (preuve archivée si litige avec le fournisseur).
-- ════════════════════════════════════════════════════════════════

alter table public.bons_de_livraison
  add column if not exists numero_bdl_fournisseur text,
  add column if not exists photo_bdl_url text;

notify pgrst, 'reload schema';
