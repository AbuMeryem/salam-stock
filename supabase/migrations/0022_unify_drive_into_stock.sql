-- ════════════════════════════════════════════════════════════════
-- 0022 — Unification : on rapatrie le schéma Drive dans la base Stock
--
-- Décision architecturale 2026-05-12 : on lâche le projet Supabase Drive
-- (rvdelylmyyyelgfatewy, dont nous n'avons pas le service-role) et on
-- héberge TOUT sur le projet Stock (tltmermqodelorthtbre). Une seule
-- base = une seule auth, un seul catalogue, vraie sync DB-level entre
-- les commandes Drive et le Kanban Stock via le trigger 0021.
--
-- Tables Drive recréées ici :
--   - profiles      (1-1 avec auth.users, role customer/employee/admin)
--   - pickup_slots  (créneaux de retrait drive)
--   - orders        (commandes client Drive, JSONB items)
--
-- Extension du catalogue produits unifié :
--   - visible_drive       (un produit Stock devient un produit Drive
--                          en flippant ce flag à true)
--   - prix_drive_cents    (prix B2C Drive, peut différer du prix magasin)
--   - image_drive_url     (image marketing dédiée Drive)
--   - description_drive   (description longue customer-facing)
--
-- RLS strict :
--   - profiles : owner read/write, role colonne protégée (anti-escalation)
--   - pickup_slots : lecture publique (catalog créneaux)
--   - orders : owner read + employee/admin read all
--
-- Le trigger sync_drive_order_to_stock de la migration 0021 va enfin
-- fonctionner — orders existe maintenant dans la même base que
-- commandes_drive, le Kanban Stock se met à jour en temps réel.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. EXTEND public.produits ──────────────────────────────────
alter table public.produits
  add column if not exists visible_drive boolean not null default false,
  add column if not exists prix_drive_cents integer
    check (prix_drive_cents is null or prix_drive_cents >= 0),
  add column if not exists image_drive_url text,
  add column if not exists description_drive text,
  add column if not exists drive_unit text
    check (drive_unit is null or drive_unit in ('kg','piece','pack')),
  add column if not exists drive_category text;

create index if not exists idx_produits_visible_drive
  on public.produits(visible_drive) where visible_drive = true;

-- ─── 2. profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  phone       text not null default '',
  role        text not null default 'customer'
    check (role in ('customer','employee','admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Update : owner peut tout sauf changer son rôle (protection escalation
-- privilege). Le rôle est modifiable uniquement par un admin via SQL
-- direct ou un edge function security definer.
drop policy if exists "profiles_update_own_safe" on public.profiles;
create policy "profiles_update_own_safe" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Helper function pour récupérer le rôle de l'user courant (utilisée
-- par les policies orders ci-dessous + realtime broadcast).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer');
$$;

revoke execute on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

-- ─── 3. Trigger handle_new_user ────────────────────────────────
-- Crée automatiquement une fiche profile à chaque signup auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatique sur profiles
create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();

-- ─── 4. pickup_slots ───────────────────────────────────────────
create table if not exists public.pickup_slots (
  id              uuid primary key default gen_random_uuid(),
  slot_start      timestamptz not null,
  slot_end        timestamptz not null,
  capacity        integer not null default 5 check (capacity > 0),
  reserved_count  integer not null default 0 check (reserved_count >= 0),
  created_at      timestamptz not null default now(),
  unique (slot_start)
);

create index if not exists idx_pickup_slots_start on public.pickup_slots(slot_start);

alter table public.pickup_slots enable row level security;

drop policy if exists "pickup_slots_public_read" on public.pickup_slots;
create policy "pickup_slots_public_read" on public.pickup_slots
  for select using (true);

-- ─── 5. orders ──────────────────────────────────────────────────
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete restrict,
  pickup_slot_id   uuid references public.pickup_slots(id) on delete restrict,
  status           text not null default 'pending'
    check (status in ('pending','confirmed','preparing','ready','picked_up','cancelled')),
  payment_method   text not null
    check (payment_method in ('online','in_store')),
  payment_status   text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded','failed')),
  items            jsonb not null,
  subtotal_cents   integer not null check (subtotal_cents >= 0),
  total_cents      integer not null check (total_cents >= 0),
  customer_email   text,
  customer_phone   text,
  notes            text,
  stripe_session_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status, created_at desc);
create index if not exists idx_orders_pickup_slot on public.orders(pickup_slot_id);

alter table public.orders enable row level security;

-- Owner peut voir/modifier ses propres orders
drop policy if exists "orders_select_own_or_staff" on public.orders;
create policy "orders_select_own_or_staff" on public.orders
  for select using (
    auth.uid() = user_id
    or public.current_user_role() in ('admin','employee')
  );

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "orders_update_staff_or_owner_cancel" on public.orders;
create policy "orders_update_staff_or_owner_cancel" on public.orders
  for update using (
    public.current_user_role() in ('admin','employee')
    or (auth.uid() = user_id and status = 'pending')
  );

-- updated_at automatique
create or replace function public.touch_orders_updated_at()
returns trigger
language plpgsql
as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_orders on public.orders;
create trigger trg_touch_orders
  before update on public.orders
  for each row execute function public.touch_orders_updated_at();

-- ─── 6. Réécrit le trigger sync_drive_order_to_stock ──────────
-- La migration 0021 avait défini le trigger avec un schéma orders
-- supposé (customer_name, total_ttc, pickup_slot_at) qui ne match pas
-- le schéma réel ci-dessus (FK user_id → profiles.full_name,
-- total_cents, pickup_slot_id → pickup_slots.slot_start). On réécrit
-- la fonction avec les bons mappings.
create or replace function public.sync_drive_order_to_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
  v_item jsonb;
  v_produit_stock_id uuid;
  v_est_traiteur boolean;
  v_default_depot_id uuid;
  v_placeholder_id uuid;
  v_zone zone_preparation_drive;
  v_client_nom text;
  v_creneau timestamptz;
begin
  -- Map status Drive → statut Stock Kanban
  --   confirmed / preparing → 'a_preparer' au début, puis 'en_preparation'
  --   ready                 → 'pret'
  --   picked_up             → 'retire'
  --   cancelled             → 'annule'
  v_statut := case
    when NEW.status = 'confirmed' then 'a_preparer'
    when NEW.status = 'preparing' then 'en_preparation'
    when NEW.status = 'ready'     then 'pret'
    when NEW.status = 'picked_up' then 'retire'
    when NEW.status = 'cancelled' then 'annule'
    else null
  end;

  -- 'pending' = order créée mais pas payée → on ignore (pas dans le Kanban)
  if v_statut is null then return NEW; end if;

  -- Nom client : full_name du profile, fallback email
  select coalesce(nullif(p.full_name, ''), NEW.customer_email, 'Client Drive')
    into v_client_nom
    from public.profiles p
   where p.id = NEW.user_id;
  if v_client_nom is null then v_client_nom := 'Client Drive'; end if;

  -- Créneau retrait : slot_start du pickup_slot
  select slot_start into v_creneau
    from public.pickup_slots
   where id = NEW.pickup_slot_id;
  if v_creneau is null then v_creneau := now() + interval '2 hours'; end if;

  -- Dépôt destination par défaut
  select id into v_default_depot_id
    from public.depots where nom = 'Particulier' limit 1;

  -- Produit placeholder pour les lignes orphelines (jamais perdre une ligne)
  select id into v_placeholder_id from public.produits
   where ean = '0000000000000' limit 1;
  if v_placeholder_id is null then
    insert into public.produits (ean, nom, marque, categorie, requires_barcode_print, est_traiteur)
    values ('0000000000000', 'Produit Drive non synchronisé', 'SALAM', 'Épicerie', false, false)
    returning id into v_placeholder_id;
  end if;

  -- Upsert commande_drive header (id partagé avec orders.id)
  insert into public.commandes_drive (
    id, numero_commande, client_nom, client_telephone, client_email,
    creneau_retrait, statut, total_ttc, mode_paiement, created_at
  ) values (
    NEW.id, NEW.id::text, v_client_nom, NEW.customer_phone, NEW.customer_email,
    v_creneau, v_statut, (NEW.total_cents::numeric / 100),
    case when NEW.payment_method = 'in_store' then 'en_magasin' else 'stripe' end,
    NEW.created_at
  )
  on conflict (id) do update set
    -- Ne fait pas redescendre 'pret' / 'retire' (préserve travail employé)
    statut = case
      when commandes_drive.statut in ('pret','retire') then commandes_drive.statut
      else excluded.statut
    end,
    creneau_retrait = excluded.creneau_retrait,
    client_nom = excluded.client_nom,
    client_telephone = excluded.client_telephone,
    client_email = excluded.client_email,
    total_ttc = excluded.total_ttc;

  -- Sync lignes uniquement aux états où la commande peut être modifiée
  if v_statut not in ('a_preparer','en_preparation') then return NEW; end if;

  -- Supprime les lignes en_attente pour recréation propre
  delete from public.commandes_drive_lignes
   where commande_id = NEW.id
     and statut_preparation = 'en_attente';

  -- Recrée depuis items JSONB
  if NEW.items is not null and jsonb_typeof(NEW.items) = 'array' then
    for v_item in select * from jsonb_array_elements(NEW.items) loop
      -- Match exact par nom (case-insensitive)
      select id, est_traiteur into v_produit_stock_id, v_est_traiteur
        from public.produits
       where lower(nom) = lower(v_item->>'name')
       limit 1;

      -- Fallback prefix
      if v_produit_stock_id is null then
        select id, est_traiteur into v_produit_stock_id, v_est_traiteur
          from public.produits
         where lower(nom) like lower(v_item->>'name') || '%'
         limit 1;
      end if;

      -- Fallback placeholder
      if v_produit_stock_id is null then
        v_produit_stock_id := v_placeholder_id;
        v_est_traiteur := false;
      end if;

      v_zone := case when v_est_traiteur
        then 'traiteur'::zone_preparation_drive
        else 'particulier'::zone_preparation_drive
      end;

      insert into public.commandes_drive_lignes (
        commande_id, produit_id, depot_id, zone_preparation,
        quantite, prix_unitaire, statut_preparation
      ) values (
        NEW.id, v_produit_stock_id, v_default_depot_id, v_zone,
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

drop trigger if exists sync_drive_order_to_stock_trigger on public.orders;
create trigger sync_drive_order_to_stock_trigger
  after insert or update on public.orders
  for each row
  execute function public.sync_drive_order_to_stock();

-- ─── 7. Realtime publications ──────────────────────────────────
-- orders en realtime pour que le Kanban Stock se mette à jour live
-- + le client suit son order
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end$$;

notify pgrst, 'reload schema';
