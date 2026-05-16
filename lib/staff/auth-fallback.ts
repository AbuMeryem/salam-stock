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
 * dans la table `profiles`. Récupéré via Auth Admin REST API le
 * 2026-05-16.
 */
export const HARDCODED_ADMIN_UUID = "5b58e718-d1e4-4e1d-8213-7d3792de1ff6";

/**
 * UUID dans la table `employes` pour "Nasri Ahmed" (rôle admin staff).
 * Distinct de `HARDCODED_ADMIN_UUID` car `profiles` et `employes` sont
 * 2 tables différentes (FK distinctes : pese_par→profiles vs
 * prepare_par_employe_id→employes).
 *
 * TODO_DEMO_10_JUIN : à remplacer par lookup dynamique en Mission 4
 * (SELECT employes.id WHERE auth_user_id = current_uid).
 */
export const HARDCODED_EMPLOYE_UUID = "b16789c3-daf6-41fe-916d-83bfa395ac3f";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Renvoie un UUID `profiles.id` exploitable par les server actions /
 * API routes Stripe (pour pese_par, decision_par sur drive_ecarts_poids).
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

/**
 * Renvoie un UUID `employes.id` exploitable pour les colonnes qui
 * référencent la table staff interne — `prepare_par_employe_id` sur
 * `commandes_drive_lignes`, `responsable_id` sur réceptions, etc.
 *
 * V1 démo : tout retourne Ahmed Nasri. À remplacer par lookup
 * dynamique en Mission 4 (`SELECT employes.id WHERE auth_user_id =
 * current_uid` ou autre mapping selon stratégie).
 *
 * @example
 *   const employeId = getEmployeUuid(currentEmploye?.id ?? null);
 *   await sb.from("commandes_drive_lignes").update({
 *     prepare_par_employe_id: employeId, ...
 *   });
 */
export function getEmployeUuid(
  zustandId: string | null | undefined,
): string {
  if (zustandId && UUID_RE.test(zustandId)) return zustandId;
  return HARDCODED_EMPLOYE_UUID;
}
