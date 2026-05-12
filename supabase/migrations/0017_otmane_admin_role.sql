-- ════════════════════════════════════════════════════════════════
-- 0017 — Otmane Jamal passe admin (comme Ahmed Nasri)
--
-- Rationale : Otmane est le manager du magasin Salam mais il pilote
-- aussi tout le dashboard admin, les alertes, le récap fiscal et
-- l'assistant IA. Le rôle 'manager' bridait son accès aux pages
-- /v2/admin/*. Un autre employé prendra le rôle 'manager' plus tard.
-- ════════════════════════════════════════════════════════════════

update public.employes
   set role = 'admin'
 where prenom = 'Otmane' and nom = 'Jamal';

notify pgrst, 'reload schema';
