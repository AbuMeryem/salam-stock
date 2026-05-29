/**
 * POST /api/stripe/create-payment-intent
 *
 * STRIPE_SECRET_KEY=sk_test_PLACEHOLDER  (cf. .env.local.example)
 *
 * Crée un PaymentIntent en `capture_method=manual` (pré-autorisation
 * sans débit immédiat). Le montant autorisé = estimé × 1.20, marge de
 * 20 % qui couvre le Drive au poids variable (cas client qui pèse plus
 * que prévu).
 *
 * Flux côté Drive :
 *   1. Front pose la commande → commandes_drive.statut_paiement = null
 *   2. Cette route crée le PI et UPDATE commandes_drive avec :
 *        - stripe_payment_intent_id
 *        - montant_autorise_ttc
 *        - statut_paiement = 'autorise'
 *        - autorisation_expire_at = now() + 7 jours
 *   3. Front confirme le PI avec le clientSecret retourné
 *   4. À la pesée, on appelle /api/stripe/capture-payment
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase-server";
import { computeMontantAutorise } from "@/lib/drive-pesee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  commande_id: z.string().uuid("commande_id doit être un UUID"),
  // Optionnel : surcharger le montant estimé (sinon = somme des lignes)
  montant_estime_ttc: z.number().positive().optional(),
});

interface LigneRow {
  montant_estime_ttc: number | string | null;
  quantite: number | string | null;
  prix_unitaire: number | string | null;
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) : v;
}

export async function POST(req: Request) {
  // 1. Parse + validation
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { commande_id, montant_estime_ttc: estimeFromBody } = parsed.data;

  const sb = supabaseServer();

  // 2. Charge la commande + lignes
  // FIX 2026-05-16 : on lit montant_autorise_ttc stocké par l'Edge
  // Function create-checkout-session (source unique de vérité). On
  // garde le fallback compute legacy si la colonne est null (commandes
  // créées avant ce fix).
  const { data: commande, error: errCmd } = await sb
    .from("commandes_drive")
    .select(
      "id, statut_paiement, stripe_payment_intent_id, total_ttc, montant_autorise_ttc, " +
        "commandes_drive_lignes (montant_estime_ttc, quantite, prix_unitaire)",
    )
    .eq("id", commande_id)
    .single();

  if (errCmd || !commande) {
    return NextResponse.json(
      { error: "commande_introuvable", detail: errCmd?.message },
      { status: 404 },
    );
  }

  const cmd = commande as unknown as {
    id: string;
    statut_paiement: string | null;
    stripe_payment_intent_id: string | null;
    total_ttc: number | string | null;
    montant_autorise_ttc: number | string | null;
    commandes_drive_lignes: LigneRow[] | null;
  };

  // Idempotence : si déjà autorisé, on renvoie l'existant plutôt que
  // de re-créer un PI (sinon double pré-auto sur la même commande).
  if (cmd.stripe_payment_intent_id && cmd.statut_paiement === "autorise") {
    try {
      const pi = await stripe().paymentIntents.retrieve(
        cmd.stripe_payment_intent_id,
      );
      return NextResponse.json({
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        montantAutoriseTtc: (pi.amount ?? 0) / 100,
        reused: true,
      });
    } catch (e) {
      // Si Stripe ne retrouve pas le PI (test mode reset, etc.), on
      // continue pour en re-créer un.
      console.warn("[stripe/create-pi] retrieve a échoué, on recrée :", e);
    }
  }

  // 3. Calcule le montant estimé
  let estimeTtc = estimeFromBody ?? 0;
  if (estimeTtc <= 0) {
    const lignes = cmd.commandes_drive_lignes ?? [];
    estimeTtc = lignes.reduce((acc, l) => {
      const ligneEstime = toNumber(l.montant_estime_ttc);
      if (ligneEstime > 0) return acc + ligneEstime;
      // Fallback : qté × PU (cas commande hors poids variable)
      return acc + toNumber(l.quantite) * toNumber(l.prix_unitaire);
    }, 0);
    if (estimeTtc <= 0) {
      // Dernier recours : total_ttc de la commande
      estimeTtc = toNumber(cmd.total_ttc);
    }
  }

  if (estimeTtc <= 0) {
    return NextResponse.json(
      { error: "montant_estime_invalide", detail: "Aucun montant estimable" },
      { status: 422 },
    );
  }

  // FIX 2026-05-16 : préfère le montant_autorise_ttc stocké en DB par
  // l'Edge Function create-checkout-session (source unique de vérité,
  // marge appliquée SEULEMENT sur lignes weight). Fallback sur
  // computeMontantAutorise (estimé × 1.20 sur tout) uniquement pour les
  // commandes pré-fix (créées avant 2026-05-16) qui n'ont pas la
  // colonne renseignée.
  const storedAutorise = toNumber(cmd.montant_autorise_ttc);
  const montantAutoriseTtc =
    storedAutorise > 0 ? storedAutorise : computeMontantAutorise(estimeTtc);
  const montantAutoriseCentimes = Math.round(montantAutoriseTtc * 100);

  // 4. Crée le PaymentIntent côté Stripe
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe().paymentIntents.create({
      amount: montantAutoriseCentimes,
      currency: "eur",
      capture_method: "manual",
      metadata: {
        commande_id,
        estime_ttc: estimeTtc.toFixed(2),
        marge_pct: "20",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Stripe inconnue";
    console.error("[stripe/create-pi] échec Stripe :", e);
    return NextResponse.json(
      { error: "stripe_create_failed", detail: msg },
      { status: 500 },
    );
  }

  // 5. UPDATE commande
  const expireAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { error: errUpd } = await sb
    .from("commandes_drive")
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      montant_autorise_ttc: montantAutoriseTtc,
      statut_paiement: "autorise",
      autorisation_expire_at: expireAt,
    })
    .eq("id", commande_id);

  if (errUpd) {
    // On a un PI Stripe orphelin si l'UPDATE échoue. On le cancel pour
    // ne pas laisser de pré-auto fantôme.
    console.error("[stripe/create-pi] UPDATE Supabase échouée :", errUpd);
    try {
      await stripe().paymentIntents.cancel(paymentIntent.id);
    } catch (e) {
      console.error("[stripe/create-pi] cancel rollback échoué :", e);
    }
    return NextResponse.json(
      { error: "db_update_failed", detail: errUpd.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    montantAutoriseCents: montantAutoriseCentimes,
  });
}
