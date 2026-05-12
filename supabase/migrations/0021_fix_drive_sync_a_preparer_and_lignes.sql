-- ════════════════════════════════════════════════════════════════
-- 0021 — Fix sync Drive ↔ Stock : mapping 'paid' → 'a_preparer'
--                                  + création des lignes même si
--                                    le produit Stock n'est pas
--                                    trouvé par nom (placeholder)
--
-- Bugs corrigés depuis l'application de 0020 :
--
--   1. Le trigger 0009 mappe orders.status='paid' → 'en_preparation'
--      donc les nouvelles commandes apparaissaient direct en colonne
--      "En préparation" du Kanban, sans passer par "À préparer" (la
--      file d'attente d'acceptation par l'employé).
--      → Le DEFAULT 'a_preparer' de 0020 ne se déclenchait jamais car
--        le trigger insérait explicitement la valeur 'en_preparation'.
--
--   2. Le trigger matche les produits par lower(nom) exact ou prefix,
--      sinon `continue` → la ligne est silencieusement skippée.
--      Symptôme côté Kanban : commande avec un total_ttc mais 0 lignes.
--      → Fix : si pas de match, on crée la ligne pointant vers un
--        produit "placeholder Drive non synchronisé" créé à la volée.
--        L'employé verra qu'une ligne manque et pourra investiguer.
-- ════════════════════════════════════════════════════════════════

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
begin
  -- Map status Drive → statut Stock
  --   paid (NEW)         → 'a_preparer'      (file d'attente employé)
  --   preparing (legacy) → 'en_preparation'  (déjà accepté côté drive)
  --   ready              → 'pret'
  --   completed          → 'retire'
  --   canceled           → 'annule'
  v_statut := case
    when NEW.status = 'paid'       then 'a_preparer'
    when NEW.status = 'preparing'  then 'en_preparation'
    when NEW.status = 'ready'      then 'pret'
    when NEW.status = 'completed'  then 'retire'
    when NEW.status = 'canceled'   then 'annule'
    else null
  end;

  if v_statut is null then return NEW; end if;

  -- Dépôt par défaut : Particulier (vente B2C classique)
  select id into v_default_depot_id
    from public.depots
   where nom = 'Particulier'
   limit 1;

  -- Placeholder produit "Drive non synchronisé" — créé à la volée si
  -- nécessaire pour ne JAMAIS perdre une ligne de commande
  select id into v_placeholder_id
    from public.produits
   where ean = '0000000000000'
   limit 1;
  if v_placeholder_id is null then
    insert into public.produits (
      ean, nom, marque, categorie, requires_barcode_print, est_traiteur
    )
    values (
      '0000000000000',
      'Produit Drive non synchronisé',
      'SALAM',
      'Épicerie',
      false,
      false
    )
    returning id into v_placeholder_id;
  end if;

  -- Upsert header commande (sans toucher au statut si déjà en
  -- préparation/prêt — on respecte le travail de l'employé)
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
  )
  values (
    NEW.id,
    coalesce(NEW.id::text, gen_random_uuid()::text),
    coalesce(NEW.customer_name, '—'),
    NEW.customer_phone,
    NEW.customer_email,
    coalesce(NEW.pickup_slot_at, now() + interval '2 hours'),
    v_statut,
    NEW.total_ttc,
    coalesce(NEW.payment_method, 'stripe'),
    coalesce(NEW.created_at, now())
  )
  on conflict (id) do update set
    -- Le statut ne redescend pas (on ne passe pas de 'pret' à 'a_preparer')
    statut = case
      when commandes_drive.statut in ('pret','retire') then commandes_drive.statut
      else excluded.statut
    end,
    creneau_retrait = excluded.creneau_retrait,
    client_nom = excluded.client_nom,
    client_telephone = excluded.client_telephone,
    client_email = excluded.client_email,
    mode_paiement = excluded.mode_paiement;

  -- Sync lignes uniquement si on est à 'a_preparer' (création initiale)
  -- ou 'en_preparation' (recreation après accept Drive)
  if v_statut not in ('a_preparer','en_preparation') then
    return NEW;
  end if;

  -- Supprime les lignes en_attente pour les recréer (idempotent).
  -- On ne touche pas aux lignes déjà préparées ou manquantes (respect
  -- du travail de l'employé).
  delete from public.commandes_drive_lignes
   where commande_id = NEW.id
     and statut_preparation = 'en_attente';

  if NEW.items is not null and jsonb_typeof(NEW.items) = 'array' then
    for v_item in select * from jsonb_array_elements(NEW.items) loop
      -- 1. Match exact par nom (case-insensitive)
      select id, est_traiteur
        into v_produit_stock_id, v_est_traiteur
        from public.produits
       where lower(nom) = lower(v_item->>'name')
       limit 1;

      -- 2. Fallback : match par début de nom
      if v_produit_stock_id is null then
        select id, est_traiteur
          into v_produit_stock_id, v_est_traiteur
          from public.produits
         where lower(nom) like lower(v_item->>'name') || '%'
         limit 1;
      end if;

      -- 3. Fallback ultime : produit placeholder (ne JAMAIS perdre la ligne)
      if v_produit_stock_id is null then
        v_produit_stock_id := v_placeholder_id;
        v_est_traiteur := false;
      end if;

      v_zone := case
        when v_est_traiteur then 'traiteur'::zone_preparation_drive
        else 'particulier'::zone_preparation_drive
      end;

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

-- Backfill : commandes_drive déjà créées par l'ancien trigger restent
-- comme elles sont. Pour la démo, le user peut manuellement les passer
-- en 'a_preparer' s'il le souhaite via :
--   update commandes_drive set statut = 'a_preparer'
--    where statut = 'en_preparation' and created_at > now() - interval '1 hour';

notify pgrst, 'reload schema';
