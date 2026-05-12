-- Seed FALLBACK : active 20 produits visible_drive sans filtre image_url
-- A utiliser si 0012 a retourne 0 produits (filtre image_url trop strict)

update public.produits as p
   set visible_drive = true,
       prix_drive_cents = round(
         coalesce(
           (select s.prix_vente from public.stock_par_depot as s
             where s.produit_id = p.id
             order by s.updated_at desc limit 1),
           5
         ) * 110
       )::int,
       drive_unit = case
         when p.categorie = 'Boucherie' then 'kg'
         when p.categorie = 'Boissons' then 'piece'
         else 'pack'
       end,
       drive_category = case
         when p.categorie = 'Boucherie' then 'boucherie'
         when p.categorie = 'Charcuterie' then 'charcuterie'
         when p.categorie = 'Frais' then 'frais'
         when p.categorie = 'Surgelés' then 'surgele'
         when p.categorie = 'Boissons' then 'boissons'
         when p.categorie = 'Hygiène' then 'bazar'
         else 'epicerie'
       end,
       image_drive_url = coalesce(
         p.image_url,
         'https://placehold.co/400x400/0F4C3A/D4A574/png?text=' ||
           replace(p.nom, ' ', '+')
       )
 where p.visible_drive = false
   and (p.ean is null or p.ean not like '0000%')
   and p.id in (
     select id from public.produits
     where visible_drive = false
       and (ean is null or ean not like '0000%')
     order by random() limit 20
   );

-- Verification
select
  (select count(*) from public.produits where visible_drive = true) as drive_products_actifs,
  (select count(*) from public.produits) as total_produits;
