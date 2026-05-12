// ─────────────────────────────────────────────────────────────────────
// verify-checkout-session — READ-ONLY
// ─────────────────────────────────────────────────────────────────────
// Cette function est désormais READ-ONLY : elle ne fait plus aucun
// .update() / .upsert() sur la table orders.
//
// Pourquoi : verify-checkout-session et confirm-order tournaient en
// parallèle au mount de /commande/confirmee, et tous deux écrivaient
// sur la même row. Race condition ⇒ confirm-order pouvait voir
// status != 'pending' et sauter le push notification (~50% miss).
//
// Désormais : confirm-order est le seul writer. Cette function se
// contente de fetch l'order + retourner ses infos pour affichage UI
// (avec un Stripe.retrieve diagnostique pour les paiements online
// pas encore confirmés en base).
//
// Future : quand le webhook Stripe officiel (checkout.session.completed,
// Bloc 2.4) sera en place, lui aussi appellera confirm-order. Single
// writer preserved.
// ─────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@18?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[verify-checkout-session] invoked");

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-11-20.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const { order_id, session_id } = await req.json();
    if (!order_id) return json({ error: "order_id requis" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*, pickup_slot:pickup_slots(id, slot_start, slot_end)")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();
    if (error || !order) return json({ error: "Commande introuvable" }, 404);

    // Pour les paiements online encore unpaid en base : on fait un retrieve
    // Stripe à titre informatif (diagnostic / future UI), mais on n'écrit
    // RIEN. confirm-order s'occupe de l'UPDATE atomique.
    if (
      order.payment_method === "online" &&
      order.payment_status !== "paid" &&
      session_id &&
      order.stripe_session_id === session_id
    ) {
      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        console.log(
          `[verify-checkout-session] returning session data, payment_status=${session.payment_status} (db=${order.payment_status})`
        );
      } catch (stripeErr) {
        console.error("[verify-checkout-session] stripe retrieve failed:", stripeErr);
      }
      return json({ order });
    }

    console.log(
      `[verify-checkout-session] returning session data, payment_status=${order.payment_status}`
    );
    return json({ order });
  } catch (err) {
    console.error("[verify-checkout-session]", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
