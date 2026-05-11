-- ════════════════════════════════════════════════════════════════
-- 0010 — Active Realtime sur commandes_drive + commandes_drive_lignes
--
-- Pour que le dashboard /v2/admin (Vue Drive) se mette à jour
-- AUTOMATIQUEMENT quand une commande arrive depuis le Drive client,
-- on doit ajouter ces 2 tables à la publication supabase_realtime.
-- Sans ça, le chart CA + KPI restent figés tant qu'on ne refresh pas
-- manuellement la page.
--
-- orders est déjà sur la publication (cf. enable_orders_realtime.sql
-- du repo salamarket-drive). On complète avec commandes_drive (la
-- table que Stock lit, alimentée par le trigger 0009 sync).
-- Idempotent.
-- ════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'commandes_drive'
  ) then
    alter publication supabase_realtime add table public.commandes_drive;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'commandes_drive_lignes'
  ) then
    alter publication supabase_realtime add table public.commandes_drive_lignes;
  end if;
end$$;

-- Vérif (commande Supabase Studio affiche les 2 tables)
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and tablename in ('commandes_drive', 'commandes_drive_lignes', 'orders')
 order by tablename;
