-- Seed: active 20 produits Stock comme produits Drive
-- + crée 14 créneaux de retrait sur les 7 prochains jours

-- 1. Active 20 produits aleatoires avec visible_drive = true
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
       end
 where p.image_url is not null
   and p.visible_drive = false
   and p.ean not like '0000%'
   and p.id in (
     select id from public.produits
     where image_url is not null and visible_drive = false and ean not like '0000%'
     order by random() limit 20
   );

-- 2. Cree 14 creneaux de retrait sur 7 jours (matin 10h-12h, apres-midi 16h-18h)
insert into public.pickup_slots (slot_start, slot_end, capacity)
select
  (current_date + offs * interval '1 day' + hour_start * interval '1 hour'),
  (current_date + offs * interval '1 day' + (hour_start + 2) * interval '1 hour'),
  5
from generate_series(1, 7) as offs
cross join (values (10), (16)) as h(hour_start)
on conflict (slot_start) do nothing;

-- 3. Verification
select
  (select count(*) from public.produits where visible_drive = true) as drive_products_actifs,
  (select count(*) from public.pickup_slots where slot_start > now()) as creneaux_futurs;
