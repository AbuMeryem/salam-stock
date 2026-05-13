-- 0023 — Vue `products` qui mappe `produits` vers le format Drive attendu
--
-- Le frontend Drive interroge une table `products` (en anglais) avec
-- colonnes name, price_cents, image_url, unit, category, in_stock.
-- Notre Stock utilise `produits` (en français) avec un schéma étendu.
-- Cette vue fait le pont sans dupliquer les données.

create or replace view public.products as
select
  p.id,
  p.nom                                            as name,
  coalesce(p.description_drive, p.description, '') as description,
  coalesce(p.prix_drive_cents, 0)                  as price_cents,
  coalesce(p.drive_unit, 'piece')                  as unit,
  coalesce(p.drive_category, 'epicerie')           as category,
  coalesce(
    nullif(p.image_drive_url, ''),
    p.image_url,
    'https://placehold.co/400x400/0F4C3A/D4A574/png?text=' ||
      replace(coalesce(p.nom, 'Produit'), ' ', '+')
  )                                                as image_url,
  p.visible_drive                                  as in_stock,
  p.created_at,
  p.updated_at
from public.produits p
where p.visible_drive = true;

-- Permissions : lecture publique anonyme (catalogue Drive)
grant select on public.products to anon, authenticated;

notify pgrst, 'reload schema';
