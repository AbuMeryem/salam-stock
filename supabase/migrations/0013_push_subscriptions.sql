-- ════════════════════════════════════════════════════════════════
-- 0013 — Web Push subscriptions (iOS 16.4+ PWA standalone)
-- Stocke endpoint + keys par employé. Le serveur lit pour envoyer.
--
-- Idempotent : si une version partielle existe déjà (créée par une
-- tentative précédente), on AJOUTE les colonnes manquantes au lieu
-- de planter sur le CREATE INDEX.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  employe_id    uuid references public.employes(id) on delete cascade,
  endpoint      text not null unique,
  keys_p256dh   text not null,
  keys_auth     text not null,
  user_agent    text,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

-- Garantit que toutes les colonnes existent même si la table avait
-- été créée par une version antérieure du fichier.
alter table public.push_subscriptions
  add column if not exists employe_id uuid references public.employes(id) on delete cascade;
alter table public.push_subscriptions
  add column if not exists endpoint text;
alter table public.push_subscriptions
  add column if not exists keys_p256dh text;
alter table public.push_subscriptions
  add column if not exists keys_auth text;
alter table public.push_subscriptions
  add column if not exists user_agent text;
alter table public.push_subscriptions
  add column if not exists enabled boolean not null default true;
alter table public.push_subscriptions
  add column if not exists created_at timestamptz not null default now();
alter table public.push_subscriptions
  add column if not exists last_used_at timestamptz not null default now();

-- Index uniquement si la colonne existe (toujours le cas après ALTER ci-dessus)
create index if not exists idx_push_subs_employe
  on public.push_subscriptions(employe_id) where enabled = true;

-- Endpoint unique
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and indexname = 'push_subscriptions_endpoint_key'
  ) then
    begin
      alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key unique (endpoint);
    exception when duplicate_table then null;
    end;
  end if;
end$$;

alter table public.push_subscriptions enable row level security;

-- Démo : anon peut tout faire (upsert + lecture). À durcir en V2.1 avec
-- auth employé signée.
drop policy if exists "anon all push_subs" on public.push_subscriptions;
create policy "anon all push_subs" on public.push_subscriptions
  for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
