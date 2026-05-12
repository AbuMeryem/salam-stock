import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@18?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[confirm-order] invoked, method:", req.method);

  try {
    // 1. Auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // 2. Parse body
    const { order_id, session_id } = (await req.json()) as {
      order_id?: string;
      session_id?: string;
    };
    if (!order_id) return json({ error: "Missing order_id" }, 400);

    console.log(`[confirm-order] user=${user.id} order=${order_id} session=${session_id ?? "n/a"}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Fetch order + check ownership
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) {
      console.error("[confirm-order] order not found or not owned:", orderErr);
      return json({ error: "Order not found" }, 404);
    }

    // 4. Idempotent — already confirmed
    if (order.status === "confirmed") {
      console.log("[confirm-order] already confirmed, returning idempotent OK");
      return json({ confirmed: true, order, already: true });
    }

    // 5. For online payments: verify Stripe session
    if (order.payment_method === "online") {
      if (!session_id) {
        return json({ error: "Missing session_id for online payment" }, 400);
      }

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2024-11-20.acacia",
        httpClient: Stripe.createFetchHttpClient(),
      });

      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        console.log(`[confirm-order] stripe session payment_status=${session.payment_status}`);

        if (session.payment_status !== "paid") {
          return json(
            { error: "Payment not completed", stripe_status: session.payment_status },
            402
          );
        }

        if (session.metadata?.order_id !== order_id) {
          console.error("[confirm-order] session metadata mismatch");
          return json({ error: "Session/order mismatch" }, 400);
        }
      } catch (err) {
        console.error("[confirm-order] stripe retrieve failed:", err);
        return json({ error: "Stripe verification failed" }, 500);
      }
    }

    // 6. Atomic UPDATE — only if still pending (idempotent lock)
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "confirmed",
        payment_status: "paid",
      })
      .eq("id", order_id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error("[confirm-order] update failed:", updateErr);
      return json({ error: updateErr.message }, 500);
    }

    if (!updated) {
      // Race : confirmed entre SELECT et UPDATE
      console.log("[confirm-order] race detected, re-fetching");
      const { data: refreshed } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single();
      return json({ confirmed: true, order: refreshed, already: true });
    }

    console.log("[confirm-order] confirmed, triggering push notification");

    // 7. Trigger notify-new-order (EdgeRuntime.waitUntil pattern)
    const NOTIFY_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-new-order`;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const notifyTask = fetch(NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        type: "INSERT",
        table: "orders",
        record: updated,
      }),
    })
      .then(async (res) => {
        const text = await res.text().catch(() => "");
        console.log(`[confirm-order] notify responded ${res.status}: ${text.slice(0, 200)}`);
      })
      .catch((err) => {
        console.error("[confirm-order] notify failed:", err);
      });

    // @ts-ignore - EdgeRuntime is available on Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(notifyTask);
    } else {
      await notifyTask;
    }

    return json({ confirmed: true, order: updated });
  } catch (err) {
    console.error("[confirm-order]", err);
    return json({ error: (err as Error).message ?? "Server error" }, 500);
  }
});
