/**
 * lib/drive-pesee.ts — Helpers compute pour le Drive au poids variable.
 *
 * Trois calculs centralisés ici pour qu'API routes et UI partagent la
 * MÊME logique :
 *   1. Pré-autorisation Stripe (estimé × 1.20, arrondi au centime sup)
 *   2. Écart en % entre estimé et réel
 *   3. Action à appliquer selon le seuil de l'écart (cf. migration 0029,
 *      table drive_ecarts_poids)
 */

/** Pré-autorisation = estimé × 1.20, arrondi au centime supérieur. */
export function computeMontantAutorise(estimeTtc: number): number {
  return Math.ceil(estimeTtc * 1.2 * 100) / 100;
}

/** Écart en % entre estimé et réel. Renvoie 0 si pas encore pesé. */
export function computeEcartPct(estime: number, reel: number | null): number {
  if (reel == null || estime === 0) return 0;
  return ((reel - estime) / estime) * 100;
}

/**
 * Détermine l'action sur écart :
 * - < 10 % : auto_accept
 * - 10-20 % en valeur absolue ET < 5 € : preparator_decision
 * - 10-20 % en valeur absolue ET >= 5 € : client_notify
 * - > 20 % : client_validation_required
 */
export type EcartAction =
  | "auto_accept"
  | "preparator_decision"
  | "client_notify"
  | "client_validation_required";

export function determineEcartAction(
  ecartPct: number,
  ecartEur: number,
): EcartAction {
  const abs = Math.abs(ecartPct);
  if (abs < 10) return "auto_accept";
  if (abs > 20) return "client_validation_required";
  // entre 10 et 20 inclus
  return Math.abs(ecartEur) >= 5 ? "client_notify" : "preparator_decision";
}
