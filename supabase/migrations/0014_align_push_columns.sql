-- ════════════════════════════════════════════════════════════════
-- 0014 — Aligne push_subscriptions sur le schéma attendu par le code
--
-- Contexte : migration 0013 a été appliquée manuellement avec un
-- naming différent (p256dh / auth sans préfixe + pas de colonne
-- `enabled`). Le code TypeScript consomme `keys_p256dh` /
-- `keys_auth` / `enabled`. Cette migration ré-aligne sans perdre les
-- données existantes (vide pour l'instant mais idempotent).
-- ════════════════════════════════════════════════════════════════

-- 1. Renomme p256dh → keys_p256dh si nécessaire
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'push_subscriptions'
       and column_name  = 'p256dh'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'push_subscriptions'
       and column_name  = 'keys_p256dh'
  ) then
    alter table public.push_subscriptions rename column p256dh to keys_p256dh;
  end if;
end$$;

-- 2. Renomme auth → keys_auth si nécessaire
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'push_subscriptions'
       and column_name  = 'auth'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'push_subscriptions'
       and column_name  = 'keys_auth'
  ) then
    alter table public.push_subscriptions rename column auth to keys_auth;
  end if;
end$$;

-- 3. Ajoute keys_p256dh si la table avait ni p256dh ni keys_p256dh
alter table public.push_subscriptions
  add column if not exists keys_p256dh text;
alter table public.push_subscriptions
  add column if not exists keys_auth text;

-- 4. Ajoute la colonne `enabled` (soft delete)
alter table public.push_subscriptions
  add column if not exists enabled boolean not null default true;

-- 5. Ajoute last_used_at si absent (pour le tracking d'envoi)
alter table public.push_subscriptions
  add column if not exists last_used_at timestamptz not null default now();
