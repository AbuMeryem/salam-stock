/**
 * POST /api/stripe/webhook
 *
 * STRIPE_SECRET_KEY=sk_test_PLACEHOLDER
 * STRIPE_WEBHOOK_SECRET=whsec_PLACEHOLDER  (cf. .env.local.example)
 *
 * Endpoint qui reçoit les events Stripe et réconcilie l'état du paiement
 * sur `commandes_drive`. La signature est OBLIGATOIRE (header
 * `stripe-signature`). On lit le body en RAW (pas .json()) pour que
 * la vérif HMAC fonctionne.
 *
 * Events gérés :
 *   - payment_intent.canceled            → statut_paiement = 'libere'
 *   - payment_intent.payment_failed      → statut_paiement = 'echec'
 *   - payment_intent.succeeded           → statut_paiement = 'capture' (si pas déjà)
 *
 * On répond 200 OK même sur events non gérés pour ne pas que Stripe
 * retry (cf. doc Stripe : 2xx = ack, tout le reste = retry).
 *
 * Configuration Stripe Dashboard :
 *   Webhook URL : https://<host>/api/stripe/webhook
 *   Events : payment_intent.succeeded, payment_intent.canceled,
 *            payment_intent.payment_failed
 *   Récupérer le `whsec_...` et le mettre dans STRIPE_WEBHOOK_SECRET.
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookResult =
  | { ok: true; updated: boolean }
  | { ok: false; reason: string };

async function handlePaymentIntent(
  pi: Stripe.PaymentIntent,
  newStatut: "capture" | "libere" | "echec",
  opts: { skipIfAlready?: "capture" } = {},
): Promise<WebhookResult> {
  // On retrouve la commande via metadata.commande_id (set côté
  // create-payment-intent) OU via stripe_payment_intent_id en fallback.
  const commandeId = pi.metadata?.commande_id;
  const sb = supabaseServer();

  let query = sb.from("commandes_drive").select("id, statut_paiement");
  query = commandeId
    ? query.eq("id", commandeId)
    : query.eq("stripe_payment_intent_id", pi.id);

  const { data: rows, error } = await query.limit(1);
  if (error) {
    console.error("[stripe/webhook] lookup commande échoué :", error);
    return { ok: false, reason: "lookup_failed" };
  }
  const row = (rows ?? [])[0] as
    | { id: string; statut_paiement: string | null }
    | undefined;
  if (!row) {
    console.warn(
      "[stripe/webhook] commande introuvable pour PI",
      pi.id,
      "metadata.commande_id =",
      commandeId,
    );
    return { ok: false, reason: "commande_introuvable" };
  }

  if (opts.skipIfAlready && row.statut_paiement === opts.skipIfAlready) {
    return { ok: true, updated: false };
  }

  const patch: Record<string, unknown> = { statut_paiement: newStatut };
  if (newStatut === "capture") {
    // Stripe expose amount_received (en centimes) une fois capturé
    patch.montant_capture_ttc = (pi.amount_received ?? pi.amount ?? 0) / 100;
  }

  const { error: errUpd } = await sb
    .from("commandes_drive")
    .update(patch)
    .eq("id", row.id);

  if (errUpd) {
    console.error("[stripe/webhook] UPDATE échouée :", errUpd);
    return { ok: false, reason: "update_failed" };
  }

  return { ok: true, updated: true };
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return NextResponse.json(
      { error: "missing_signature" },
      { status: 400 },
    );
  }
  if (!whSecret) {
    return NextResponse.json(
      { error: "webhook_secret_missing" },
      { status: 503 },
    );
  }

  // RAW body obligatoire pour la vérification HMAC
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "signature_invalide";
    console.error("[stripe/webhook] vérif signature échouée :", msg);
    return NextResponse.json(
      { error: "invalid_signature", detail: msg },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntent(pi, "libere");
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntent(pi, "echec");
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntent(pi, "capture", { skipIfAlready: "capture" });
        break;
      }
      default:
        // Event non géré : ack 200 quand même pour pas que Stripe retry
        console.log("[stripe/webhook] event non géré :", event.type);
    }
  } catch (e) {
    // On log mais on renvoie 200 pour éviter les retries en boucle sur
    // un bug applicatif. Les pannes transitoires sont rattrapées par
    // l'opérateur via le Dashboard Stripe.
    console.error("[stripe/webhook] handler a throw :", e);
  }

  return NextResponse.json({ received: true });
}
