-- ════════════════════════════════════════════════════════════════
-- 0014 — Aligne push_subscriptions sur le schéma attendu par le code
--
-- Contexte : 0013 a été appliquée manuellement avec un naming sans
-- préfixe (p256dh / auth) et sans `enabled`. Le code TS attend
-- keys_p256dh / keys_auth / enabled. Cette migration rebalance, est
-- IDEMPOTENTE (rejouable sans risque). Aucune donnée perdue.
-- ════════════════════════════════════════════════════════════════

-- 1. Rename p256dh → keys_p256dh si nécessaire
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='push_subscriptions'
       and column_name='p256dh'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='push_subscriptions'
       and column_name='keys_p256dh'
  ) then
    alter table public.push_subscriptions rename column p256dh to keys_p256dh;
  end if;
end$$;

-- 2. Rename auth → keys_auth si nécessaire
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='push_subscriptions'
       and column_name='auth'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='push_subscriptions'
       and column_name='keys_auth'
  ) then
    alter table public.push_subscriptions rename column auth to keys_auth;
  end if;
end$$;

-- 3. Garantit les 4 colonnes attendues
alter table public.push_subscriptions
  add column if not exists keys_p256dh text,
  add column if not exists keys_auth text,
  add column if not exists enabled boolean not null default true,
  add column if not exists last_used_at timestamptz not null default now();

notify pgrst, 'reload schema';
