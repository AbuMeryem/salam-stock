-- ════════════════════════════════════════════════════════════════
-- 0015 — push_subscriptions.user_id nullable
--
-- Contexte : la table prod a `user_id NOT NULL` (auth.users.id) hérité
-- du flow Drive. Mais Stock V2 utilise un login PIN sans Supabase Auth
-- → pas d'user_id à fournir → l'INSERT plante avec 23502.
-- Solution : rendre user_id nullable. employe_id (V2) reste optionnel.
-- ════════════════════════════════════════════════════════════════

alter table public.push_subscriptions
  alter column user_id drop not null;

notify pgrst, 'reload schema';
