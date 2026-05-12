import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@18?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

interface CartItem {
  product_id: string;
  quantity: number;
}

interface Payload {
  items: CartItem[];
  pickup_slot_id: string;
  payment_method: "online" | "in_store";
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-11-20.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let reservedSlotId: string | null = null;
  let createdOrderId: string | null = null;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Auth user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // 2. Validate payload
    const body = (await req.json()) as Payload;
    if (!Array.isArray(body.items) || body.items.length === 0)
      return json({ error: "Panier vide" }, 400);
    if (!body.pickup_slot_id) return json({ error: "Créneau manquant" }, 400);
    if (!["online", "in_store"].includes(body.payment_method))
      return json({ error: "Mode de paiement invalide" }, 400);

    // 3. Re-vérifie les prix produits côté serveur
    const productIds = body.items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cents, in_stock")
      .in("id", productIds);
    if (prodErr) throw prodErr;

    const productMap = new Map(products!.map((p) => [p.id, p]));
    let subtotal = 0;
    const trustedItems = body.items.map((item) => {
      const p = productMap.get(item.product_id);
      if (!p) throw new Error(`Produit introuvable: ${item.product_id}`);
      if (!p.in_stock) throw new Error(`Produit indisponible: ${p.name}`);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50)
        throw new Error("Quantité invalide");
      const line = p.price_cents * item.quantity;
      subtotal += line;
      return {
        product_id: p.id,
        name: p.name,
        unit_price_cents: p.price_cents,
        quantity: item.quantity,
        line_total_cents: line,
      };
    });

    if (subtotal <= 0) return json({ error: "Montant invalide" }, 400);

    // 4. Vérifie le créneau (existe + ≥1h dans le futur)
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from("pickup_slots")
      .select("id, slot_start, slot_end, capacity, reserved_count")
      .eq("id", body.pickup_slot_id)
      .single();
    if (slotErr || !slot) return json({ error: "Créneau introuvable" }, 400);

    const slotStartMs = new Date(slot.slot_start).getTime();
    if (slotStartMs - Date.now() < 60 * 60 * 1000)
      return json({ error: "Ce créneau n'est plus réservable (délai 1h)" }, 400);

    // 5. RÉSERVATION ATOMIQUE du créneau (optimistic lock)
    const { data: reserved, error: reserveErr } = await supabaseAdmin
      .from("pickup_slots")
      .update({ reserved_count: slot.reserved_count + 1 })
      .eq("id", body.pickup_slot_id)
      .eq("reserved_count", slot.reserved_count)
      .lt("reserved_count", slot.capacity)
      .select("id")
      .maybeSingle();

    if (reserveErr) throw reserveErr;
    if (!reserved) {
      return json({ error: "Créneau complet ou déjà réservé, choisissez-en un autre" }, 409);
    }
    reservedSlotId = body.pickup_slot_id;

    // 6. Récupère phone depuis profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .single();

    // 7. Crée la commande pending
    const { data: order, error: insertErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        pickup_slot_id: body.pickup_slot_id,
        status: "pending",
        payment_method: body.payment_method,
        payment_status: "unpaid",
        items: trustedItems,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        customer_email: user.email,
        customer_phone: profile?.phone,
        notes: body.notes ?? null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    createdOrderId = order.id;

    // 8a. Paiement magasin → on laisse l'order en "pending"
    if (body.payment_method === "in_store") {
      // L'order reste en "pending" jusqu'à ce que le client arrive
      // sur /commande/confirmee, qui appellera confirm-order.
      // confirm-order fera l'UPDATE atomique et déclenchera le push.
      return json({
        order_id: order.id,
        redirect_url: `${SITE_URL}/commande/confirmee/${order.id}`,
      });
    }

    // 8b. Paiement en ligne → Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: trustedItems.map((it) => ({
        price_data: {
          currency: "eur",
          product_data: { name: it.name },
          unit_amount: it.unit_price_cents,
        },
        quantity: it.quantity,
      })),
      success_url: `${SITE_URL}/commande/confirmee/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/paiement?cancelled=1&order_id=${order.id}`,
      metadata: {
        order_id: order.id,
        user_id: user.id,
      },
      locale: "fr",
    });

    const { error: sessionUpdErr } = await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);
    if (sessionUpdErr) throw sessionUpdErr;

    return json({
      order_id: order.id,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (err) {
    console.error("[create-checkout-session]", err);

    // Rollback
    if (createdOrderId) {
      await supabaseAdmin.from("orders").delete().eq("id", createdOrderId);
    }
    if (reservedSlotId) {
      const { data: cur } = await supabaseAdmin
        .from("pickup_slots")
        .select("reserved_count")
        .eq("id", reservedSlotId)
        .single();
      if (cur && cur.reserved_count > 0) {
        await supabaseAdmin
          .from("pickup_slots")
          .update({ reserved_count: cur.reserved_count - 1 })
          .eq("id", reservedSlotId);
      }
    }

    return json({ error: (err as Error).message ?? "Erreur serveur" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
