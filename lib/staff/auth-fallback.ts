/**
 * lib/staff/auth-fallback.ts — Hack temporaire avant Mission 4.
 *
 * Supabase Auth côté salam-stock n'est PAS encore câblée côté serveur
 * (zustand-local seulement, `useStore.currentUser` / `useV2.currentEmploye`
 * stockent des IDs locaux type "u-otmane" ou "emp_…"). Or les routes
 * API Stripe (capture-payment notamment) ainsi que les FK
 * profiles(id) sur la migration 0029 exigent un VRAI UUID Supabase.
 *
 * En attendant Mission 4 (câblage @supabase/ssr + middleware Next.js),
 * on hardcode l'UUID admin pour permettre la capture E2E en démo.
 *
 * Tag de recherche pour le retrait : TODO_DEMO_10_JUIN.
 * Cf. BLOCKERS.md entrée B9.
 */

/**
 * UUID Supabase de `digitalwebmastertlse@gmail.com` (compte admin),
 * récupéré via Auth Admin REST API le 2026-05-16.
 */
export const HARDCODED_ADMIN_UUID = "5b58e718-d1e4-4e1d-8213-7d3792de1ff6";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Renvoie un UUID exploitable par les server actions / API routes.
 *
 * - Si `zustandId` EST déjà un vrai UUID (forward-compat Mission 4 où
 *   auth Supabase posera un UUID auth.users.id dans le store) → on
 *   l'utilise tel quel.
 * - Sinon (string locale type "u-otmane" ou "emp_admin" ou null) →
 *   fallback sur l'UUID admin hardcodé.
 *
 * @example
 *   const userId = getUserUuid(currentUser?.id);
 *   await markLineWeighed({ ..., user_id: userId });
 */
export function getUserUuid(zustandId: string | null | undefined): string {
  if (zustandId && UUID_RE.test(zustandId)) return zustandId;
  return HARDCODED_ADMIN_UUID;
}
