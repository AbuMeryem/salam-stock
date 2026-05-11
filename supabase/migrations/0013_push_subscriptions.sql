-- ════════════════════════════════════════════════════════════════
-- 0013 — Web Push subscriptions (iOS 16.4+ PWA standalone)
-- Stocke endpoint + keys par employé. Le serveur lit pour envoyer.
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

create index if not exists idx_push_subs_employe
  on public.push_subscriptions(employe_id) where enabled = true;

alter table public.push_subscriptions enable row level security;

-- Démo : anon peut tout faire (upsert + lecture). À durcir en V2.1 avec
-- auth employé signée.
drop policy if exists "anon all push_subs" on public.push_subscriptions;
create policy "anon all push_subs" on public.push_subscriptions
  for all to anon using (true) with check (true);
