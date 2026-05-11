-- ════════════════════════════════════════════════════════════════
-- 0007 — POC write policies (anon role can INSERT/UPDATE/DELETE)
-- Sans ça les transferts, sorties, inventaires, codes_barres_cartons,
-- réceptions et stock_par_depot échouent côté client.
-- À durcir en V2.1 avec un vrai auth (employé.id signé).
-- ════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  for t in select unnest(array[
    'depots','produits','stock_par_depot','codes_barres_cartons','employes',
    'receptions','receptions_lignes','sorties_stock','transferts_inter_depots',
    'inventaires_tournants','commandes_drive','commandes_drive_lignes'
  ])
  loop
    -- INSERT
    execute format('drop policy if exists "anon_insert" on public.%I', t);
    execute format('create policy "anon_insert" on public.%I for insert with check (true)', t);
    -- UPDATE
    execute format('drop policy if exists "anon_update" on public.%I', t);
    execute format('create policy "anon_update" on public.%I for update using (true) with check (true)', t);
    -- DELETE (rare mais utile pour clear-cart, etc.)
    execute format('drop policy if exists "anon_delete" on public.%I', t);
    execute format('create policy "anon_delete" on public.%I for delete using (true)', t);
  end loop;
end$$;
