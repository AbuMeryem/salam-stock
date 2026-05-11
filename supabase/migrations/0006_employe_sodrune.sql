-- ─────────────────────────────────────────────────────────────────────────
-- 0006_employe_sodrune.sql
-- Sodrune n'avait aucun employé rattaché. Le cron inventaire tournant
-- tirait au sort des produits Sodrune mais ne trouvait personne à qui
-- les assigner. Reda Hamidou est ajouté avec le PIN 4321, role reception,
-- dépôt principal = Sodrune.
-- ─────────────────────────────────────────────────────────────────────────

begin;

insert into public.employes (nom, prenom, role, depot_principal_id, pin_code, is_active)
select 'Hamidou', 'Reda', 'reception', d.id, '4321', true
from public.depots d
where d.nom = 'Sodrune'
  and not exists (
    select 1 from public.employes e where e.pin_code = '4321'
  );

commit;
