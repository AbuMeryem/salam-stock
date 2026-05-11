-- ─────────────────────────────────────────────────────────────────────────
-- 0004_zones_drive.sql
-- Le drive Salam Market couvre 3 zones distinctes du dépôt de stock :
--   • particulier   → produits B2C en magasin
--   • professionnel → produits B2B en magasin
--   • traiteur      → plats préparés maison (zone labo/cuisine)
-- Sodrune est un entrepôt back-office Pro : son stock alimente le dépôt
-- Professionnel via transfert, mais ne fait JAMAIS partie d'une commande
-- drive. Cette migration ajoute la dimension "zone_preparation" aux
-- lignes de commandes pour rendre cette logique explicite.
-- ─────────────────────────────────────────────────────────────────────────

begin;

do $$ begin
  create type zone_preparation_drive as enum (
    'particulier',
    'professionnel',
    'traiteur'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.commandes_drive_lignes
  add column if not exists zone_preparation zone_preparation_drive;

-- Backfill via le dépôt courant. Sodrune (entrepôt) tombe sur
-- "particulier" par défaut — aucun cas en pratique car Sodrune ne devrait
-- jamais avoir de ligne drive, mais on évite un null pour la contrainte.
update public.commandes_drive_lignes l
   set zone_preparation = case
     when l.depot_id = (select id from public.depots where nom = 'Particulier')
       then 'particulier'::zone_preparation_drive
     when l.depot_id = (select id from public.depots where nom = 'Professionnel')
       then 'professionnel'::zone_preparation_drive
     else 'particulier'::zone_preparation_drive
   end
 where l.zone_preparation is null;

alter table public.commandes_drive_lignes
  alter column zone_preparation set not null;

create index if not exists idx_drive_lignes_zone
  on public.commandes_drive_lignes(zone_preparation);

commit;
