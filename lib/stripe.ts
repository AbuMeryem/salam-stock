/**
 * lib/stripe.ts — Singleton client Stripe serveur (TEST MODE).
 *
 * Phase actuelle : Drive au poids (Stripe manual capture).
 * Clé attendue : sk_test_… uniquement. Le runtime jette si on
 * branche une clé live, pour éviter tout incident avant la démo.
 *
 * Voir `.env.local.example` pour les placeholders à remplir :
 *   STRIPE_SECRET_KEY=sk_test_PLACEHOLDER
 *   STRIPE_PUBLISHABLE_KEY=pk_test_PLACEHOLDER
 *   STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquante (cf. .env.local.example)");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error(
      "STRIPE_SECRET_KEY doit commencer par sk_test_ (TEST mode obligatoire pour cette phase)",
    );
  }
  _stripe = new Stripe(key, {
    // Version pinned sur celle livrée par stripe-node v22 installé en
    // dépendance. Si on remonte le package, ajuster ici (LatestApiVersion).
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return _stripe;
}
