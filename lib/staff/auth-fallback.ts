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
 * ⚠ V1 démo (tant que Mission 4 / Supabase Auth pas câblée) :
 * **TOUJOURS** retourne `HARDCODED_ADMIN_UUID`. Le store zustand
 * contient en V1 des UUIDs `employes.id` (Ahmed, Mehdi, Jamal). Ces
 * UUIDs sont valides pour `prepare_par_employe_id` mais PAS pour
 * `pese_par` qui référence `profiles.id`. Un forward-compat naïf
 * (`if zustandId est un UUID → l'utiliser tel quel`) faisait planter
 * la FK `pese_par_fkey` car UUID employes ≠ UUID profiles.
 *
 * Mission 4 réintroduira un vrai check : `auth.uid()` du JWT Supabase
 * et lookup dans `profiles` côté server.
 *
 * @example
 *   const userId = getUserUuid(currentUser?.id);
 *   await markLineWeighed({ ..., user_id: userId });
 */
export function getUserUuid(_zustandId: string | null | undefined): string {
  // TODO_DEMO_10_JUIN : forward-compat désactivé. Cf. BLOCKERS.md B9.
  // À retirer + remettre la branche `if UUID_RE.test → return tel quel`
  // une fois que le store contient l'UUID `profiles.id` (Mission 4).
  return HARDCODED_ADMIN_UUID;
}

/**
 * Renvoie un UUID `employes.id` exploitable pour les colonnes qui
 * référencent la table staff interne — `prepare_par_employe_id` sur
 * `commandes_drive_lignes`, `responsable_id` sur réceptions, etc.
 *
 * ⚠ V1 démo (cohérent avec getUserUuid ci-dessus) : **TOUJOURS**
 * retourne `HARDCODED_EMPLOYE_UUID` (Ahmed Nasri). Si on faisait
 * confiance au zustand, un user connecté en tant qu'admin profile
 * (UUID `5b58e718-…`) renverrait cet UUID admin pour
 * `prepare_par_employe_id` → FK violation employes (l'admin n'est
 * PAS dans la table `employes`).
 *
 * Mission 4 fera le mapping propre : `SELECT employes.id WHERE
 * auth_user_id = current_uid` (probablement via une vue / fonction
 * SQL dédiée pour éviter les round-trips).
 *
 * @example
 *   const employeId = getEmployeUuid(currentEmploye?.id ?? null);
 *   await sb.from("commandes_drive_lignes").update({
 *     prepare_par_employe_id: employeId, ...
 *   });
 */
export function getEmployeUuid(
  _zustandId: string | null | undefined,
): string {
  // TODO_DEMO_10_JUIN : forward-compat désactivé (cf. getUserUuid).
  return HARDCODED_EMPLOYE_UUID;
}
