-- ════════════════════════════════════════════════════════════════
-- 0009 — Sync bidirectionnel Drive (orders) ⇄ Stock (commandes_drive)
--
-- CONTEXTE
-- Les deux apps Salamarket Drive (Vite client) et Salam Stock (Next
-- back-office) partagent le MÊME projet Supabase (tltmermqodelorthtbre)
-- mais utilisent des tables différentes :
--   • Drive  → orders + pickup_slots + products (items en JSONB inline)
--   • Stock  → commandes_drive + commandes_drive_lignes + produits
--
-- Du coup une commande créée sur le Drive client n'apparaissait pas
-- dans /v2/preparation côté Stock. Cette migration installe deux
-- triggers Postgres qui synchronisent les deux mondes automatiquement,
-- sans changer le code des apps.
--
-- TRIGGERS
-- 1. sync_drive_order_to_stock (AFTER INSERT OR UPDATE ON orders)
--    Upsert dans commandes_drive avec mapping :
--      orders.status         → commandes_drive.statut
--        ['paid','preparing']  → 'en_preparation'
--        'ready'               → 'pret'
--        'completed'           → 'retire'
--        'canceled'            → 'annule'
--        else                  → skip
--      orders.payment_method → commandes_drive.mode_paiement
--        'online'              → 'stripe'
--        'in_store'            → 'en_magasin'
--      orders.total_cents    → commandes_drive.total_ttc (÷ 100)
--      orders.id             → commandes_drive.id (réutilisé pour FK clear)
--      pickup_slots.slot_start → commandes_drive.creneau_retrait
--    Puis flatten orders.items (JSONB) → commandes_drive_lignes
--    avec lookup du produit Stock par nom (case-insensitive ilike).
--    Si le produit n'est pas trouvé, la ligne est skippée (silently)
--    pour ne pas bloquer la sync de l'order header.
--
-- 2. sync_stock_statut_to_drive (AFTER UPDATE OF statut ON commandes_drive)
--    Reverse : quand un préparateur Stock marque une commande comme
--    'pret' ou 'retire', on écrit le status correspondant dans orders
--    pour que le client Drive voie la mise à jour temps réel.
--    Guard contre les boucles : on ne re-déclenche pas le forward
--    trigger si le statut destination == statut courant.
--
-- BACKFILL
-- À la fin de la migration, on rejoue le forward trigger sur tous
-- les orders existants pour rattraper l'historique.
--
-- IDEMPOTENT — la migration peut être rejouée sans risque.
-- ════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- Prérequis self-contained (au cas où 0004/0005 pas appliquées)
-- ───────────────────────────────────────────────────────────────

-- enum zone_preparation_drive
do $$
begin
  create type zone_preparation_drive as enum (
    'particulier', 'professionnel', 'traiteur'
  );
exception when duplicate_object then null;
end$$;

-- colonne zone_preparation sur commandes_drive_lignes
alter table public.commandes_drive_lignes
  add column if not exists zone_preparation zone_preparation_drive
  not null default 'particulier';

-- colonne est_traiteur sur produits
alter table public.produits
  add column if not exists est_traiteur boolean not null default false;

-- Drop existing triggers/functions to allow re-run
drop trigger if exists sync_drive_orders_to_stock on public.orders;
drop trigger if exists sync_stock_statut_to_drive on public.commandes_drive;
drop function if exists public.sync_drive_order_to_stock();
drop function if exists public.sync_stock_statut_to_drive();

-- ───────────────────────────────────────────────────────────────
-- Forward: Drive orders → Stock commandes_drive
-- ───────────────────────────────────────────────────────────────
create or replace function public.sync_drive_order_to_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
  v_mode_paiement text;
  v_numero_commande text;
  v_creneau_retrait timestamptz;
  v_client_nom text;
  v_client_phone text;
  v_default_depot_id uuid;
  v_item jsonb;
  v_produit_stock_id uuid;
  v_zone zone_preparation_drive;
  v_est_traiteur boolean;
begin
  -- Map status Drive → statut Stock
  v_statut := case
    when NEW.status in ('paid','preparing') then 'en_preparation'
    when NEW.status = 'ready'               then 'pret'
    when NEW.status = 'completed'           then 'retire'
    when NEW.status = 'canceled'            then 'annule'
    else null
  end;

  -- Skip si statut non mappable (pending, draft, etc.)
  if v_statut is null then
    return NEW;
  end if;

  -- Skip si UPDATE et rien d'utile n'a changé
  if TG_OP = 'UPDATE'
     and OLD.status = NEW.status
     and OLD.total_cents = NEW.total_cents
     and OLD.pickup_slot_id is not distinct from NEW.pickup_slot_id then
    return NEW;
  end if;

  -- Mode paiement
  v_mode_paiement := case
    when NEW.payment_method = 'online' then 'stripe'
    else 'en_magasin'
  end;

  -- Numéro commande lisible : DRV-YYYYMMDD-XXXX
  v_numero_commande := 'DRV-' ||
    to_char(NEW.created_at at time zone 'Europe/Paris', 'YYYYMMDD') ||
    '-' || upper(substring(NEW.id::text from 1 for 4));

  -- Créneau retrait
  select slot_start into v_creneau_retrait
  from public.pickup_slots
  where id = NEW.pickup_slot_id;

  if v_creneau_retrait is null then
    v_creneau_retrait := NEW.created_at;
  end if;

  -- Client nom + téléphone (depuis profile, sinon depuis order)
  begin
    select coalesce(nullif(full_name, ''), NEW.customer_email),
           coalesce(nullif(phone, ''), NEW.customer_phone)
      into v_client_nom, v_client_phone
      from public.profiles
     where id = NEW.user_id;
  exception when others then
    v_client_nom := NEW.customer_email;
    v_client_phone := NEW.customer_phone;
  end;

  if v_client_nom is null then v_client_nom := coalesce(NEW.customer_email, 'Client'); end if;

  -- Dépôt par défaut (Particulier)
  select id into v_default_depot_id
    from public.depots
   where nom = 'Particulier'
   order by created_at limit 1;

  if v_default_depot_id is null then
    -- Aucun dépôt Particulier ? Prend le premier dispo, sinon abort silencieusement
    select id into v_default_depot_id from public.depots order by created_at limit 1;
    if v_default_depot_id is null then
      return NEW;
    end if;
  end if;

  -- Upsert commande_drive (id = order id pour relation 1-1 traçable)
  insert into public.commandes_drive (
    id,
    numero_commande,
    client_nom,
    client_telephone,
    client_email,
    creneau_retrait,
    statut,
    total_ttc,
    mode_paiement,
    created_at
  ) values (
    NEW.id,
    v_numero_commande,
    v_client_nom,
    v_client_phone,
    NEW.customer_email,
    v_creneau_retrait,
    v_statut,
    NEW.total_cents::numeric / 100.0,
    v_mode_paiement,
    NEW.created_at
  )
  on conflict (id) do update set
    statut            = excluded.statut,
    total_ttc         = excluded.total_ttc,
    creneau_retrait   = excluded.creneau_retrait,
    client_nom        = excluded.client_nom,
    client_telephone  = excluded.client_telephone,
    client_email      = excluded.client_email,
    mode_paiement     = excluded.mode_paiement;

  -- Sync lignes : on flatten les items JSONB et on les met en lignes
  -- On supprime d'abord les anciennes lignes (idempotent), sauf si la
  -- commande est déjà en préparation effective (statut pret/retire)
  -- pour ne pas détruire les statuts_preparation de chaque ligne.
  if v_statut = 'en_preparation' then
    delete from public.commandes_drive_lignes
     where commande_id = NEW.id
       and statut_preparation = 'en_attente';
  end if;

  -- Iterate les items
  if NEW.items is not null and jsonb_typeof(NEW.items) = 'array' then
    for v_item in select * from jsonb_array_elements(NEW.items) loop
      -- Match produit Stock par nom (ilike)
      select id, est_traiteur
        into v_produit_stock_id, v_est_traiteur
        from public.produits
       where lower(nom) = lower(v_item->>'name')
       limit 1;

      -- Fallback : match par début de nom
      if v_produit_stock_id is null then
        select id, est_traiteur
          into v_produit_stock_id, v_est_traiteur
          from public.produits
         where lower(nom) like lower(v_item->>'name') || '%'
         limit 1;
      end if;

      -- Si toujours pas trouvé, on skip cette ligne (mais l'order
      -- header est déjà inséré, le manager le verra avec une ligne en
      -- moins — meilleur que rien n'apparaisse du tout).
      if v_produit_stock_id is null then
        continue;
      end if;

      -- Zone : produit traiteur → zone traiteur, sinon particulier par défaut
      v_zone := case
        when v_est_traiteur then 'traiteur'::zone_preparation_drive
        else 'particulier'::zone_preparation_drive
      end;

      -- Insère la ligne (skip si elle existe déjà avec ce produit_id pour cette commande
      -- ET qu'elle n'est plus 'en_attente' — on respecte le travail du préparateur)
      insert into public.commandes_drive_lignes (
        commande_id,
        produit_id,
        depot_id,
        zone_preparation,
        quantite,
        prix_unitaire,
        statut_preparation
      ) values (
        NEW.id,
        v_produit_stock_id,
        v_default_depot_id,
        v_zone,
        (v_item->>'quantity')::numeric,
        ((v_item->>'unit_price_cents')::numeric) / 100.0,
        'en_attente'
      )
      on conflict do nothing;
    end loop;
  end if;

  return NEW;
end;
$$;

create trigger sync_drive_orders_to_stock
  after insert or update on public.orders
  for each row
  execute function public.sync_drive_order_to_stock();

-- ───────────────────────────────────────────────────────────────
-- Reverse: Stock commandes_drive.statut → Drive orders.status
-- ───────────────────────────────────────────────────────────────
create or replace function public.sync_stock_statut_to_drive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drive_status text;
begin
  -- Ne réagit qu'aux changements de statut
  if NEW.statut = OLD.statut then
    return NEW;
  end if;

  v_drive_status := case
    when NEW.statut = 'en_preparation' then 'preparing'
    when NEW.statut = 'pret'           then 'ready'
    when NEW.statut = 'retire'         then 'completed'
    when NEW.statut = 'annule'         then 'canceled'
    else null
  end;

  if v_drive_status is null then
    return NEW;
  end if;

  -- Update seulement si la commande Drive existe avec un statut différent
  update public.orders
     set status = v_drive_status,
         updated_at = now()
   where id = NEW.id
     and status is distinct from v_drive_status;

  return NEW;
end;
$$;

create trigger sync_stock_statut_to_drive
  after update of statut on public.commandes_drive
  for each row
  execute function public.sync_stock_statut_to_drive();

-- ───────────────────────────────────────────────────────────────
-- Backfill : rejoue le forward trigger sur tous les orders existants
-- pour rattraper l'historique (commandes créées avant la migration).
-- ───────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select id from public.orders
     where status in ('paid','preparing','ready','completed','canceled')
       and not exists (
         select 1 from public.commandes_drive cd where cd.id = orders.id
       )
     order by created_at asc
  loop
    -- Simulate un UPDATE no-op pour déclencher le trigger
    update public.orders set updated_at = now() where id = r.id;
  end loop;
end$$;

-- Réveille PostgREST pour qu'il voie les nouveaux triggers
notify pgrst, 'reload schema';
