-- ════════════════════════════════════════════════════════════════
-- 0017 — Fix sync drive orders : ajoute 'confirmed' au mapping
--
-- Bug constaté 12/05/2026 : la PWA Drive insère les commandes payées
-- avec orders.status='confirmed' (Stripe webhook). Le trigger
-- sync_drive_orders_to_stock ne mappait QUE paid/preparing/ready/
-- completed/canceled → les commandes confirmed étaient skippées
-- silencieusement (v_statut = null → return NEW).
--
-- Résultat : 5+ commandes orders.status='confirmed' jamais répliquées
-- vers commandes_drive → invisibles dans /v2/preparation.
--
-- Fix : ajout de 'confirmed' → 'en_preparation' dans le case mapping.
-- Puis rejeu du trigger sur les orders existantes via UPDATE no-op.
-- ════════════════════════════════════════════════════════════════

create or replace function public.sync_drive_order_to_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
  v_default_depot_id uuid;
  v_item jsonb;
  v_produit_stock_id uuid;
  v_zone zone_preparation_drive;
  v_est_traiteur boolean;
  v_numero_commande text;
begin
  -- Map status Drive → statut Stock (AJOUT 'confirmed')
  v_statut := case
    when NEW.status in ('paid','preparing','confirmed') then 'en_preparation'
    when NEW.status = 'ready'               then 'pret'
    when NEW.status = 'completed'           then 'retire'
    when NEW.status = 'canceled'            then 'annule'
    else null
  end;

  if v_statut is null then
    return NEW;
  end if;

  if TG_OP = 'UPDATE'
     and OLD.status = NEW.status
     and OLD.total_cents = NEW.total_cents
     and OLD.pickup_slot_id is not distinct from NEW.pickup_slot_id then
    return NEW;
  end if;

  v_numero_commande := coalesce(
    NEW.numero_commande,
    'DRV-' || to_char(NEW.created_at, 'YYYY') || '-' || lpad(
      (extract(epoch from NEW.created_at)::bigint % 100000)::text,
      5, '0'
    )
  );

  v_default_depot_id := (
    select id from public.depots where nom = 'Particulier' limit 1
  );

  -- Upsert commande_drive miroir
  insert into public.commandes_drive (
    id, numero_commande, client_nom, client_telephone, client_email,
    creneau_retrait, statut, total_ttc, mode_paiement, created_at
  )
  values (
    NEW.id,
    v_numero_commande,
    coalesce(NEW.customer_name, 'Client drive'),
    NEW.customer_phone,
    NEW.customer_email,
    coalesce(NEW.pickup_at, NEW.created_at + interval '2 hours'),
    v_statut::commande_drive_status,
    NEW.total_cents::numeric / 100,
    case
      when NEW.payment_method = 'card' then 'stripe'
      when NEW.payment_method = 'in_store' then 'en_magasin'
      else 'stripe'
    end::mode_paiement,
    NEW.created_at
  )
  on conflict (id) do update set
    statut = excluded.statut,
    total_ttc = excluded.total_ttc,
    creneau_retrait = excluded.creneau_retrait;

  -- Insert lignes (idempotent — on supprime puis recrée)
  delete from public.commandes_drive_lignes where commande_id = NEW.id;

  if NEW.items is not null and jsonb_array_length(NEW.items) > 0 then
    for v_item in select * from jsonb_array_elements(NEW.items) loop
      -- Recherche produit dans stock par EAN drive
      select p.id, coalesce(p.est_traiteur, false)
        into v_produit_stock_id, v_est_traiteur
        from public.produits p
       where p.ean = (v_item->>'ean')
       limit 1;

      if v_produit_stock_id is null then
        -- Pas de produit matché → on skip cette ligne (audit warning)
        raise warning 'sync_drive: produit EAN % introuvable, ligne skipée', v_item->>'ean';
        continue;
      end if;

      v_zone := case
        when v_est_traiteur then 'traiteur'::zone_preparation_drive
        else 'particulier'::zone_preparation_drive
      end;

      insert into public.commandes_drive_lignes (
        commande_id, produit_id, depot_id,
        zone_preparation, quantite, prix_unitaire,
        statut_preparation
      ) values (
        NEW.id,
        v_produit_stock_id,
        v_default_depot_id,
        v_zone,
        coalesce((v_item->>'quantity')::int, 1),
        coalesce((v_item->>'unit_price_cents')::numeric / 100, 0),
        'en_attente'
      );
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists sync_drive_orders_to_stock on public.orders;
create trigger sync_drive_orders_to_stock
  after insert or update on public.orders
  for each row
  execute function public.sync_drive_order_to_stock();

-- Rejeu sur les orders existantes : UPDATE no-op pour fire le trigger
update public.orders
   set updated_at = coalesce(updated_at, now())
 where status in ('confirmed','paid','preparing','ready','completed');

notify pgrst, 'reload schema';
