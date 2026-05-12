import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

// Statuts gérés par le Kanban (pending est exclu, géré par confirm-order)
const KANBAN_STATUSES = ["confirmed", "preparing", "ready", "picked_up", "cancelled"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[update-order-status] invoked");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Check role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "employee"].includes(profile.role)) {
      console.warn(`[update-order-status] forbidden role: ${profile?.role}`);
      return json({ error: "Forbidden — admin or employee role required" }, 403);
    }

    const { order_id, new_status } = (await req.json()) as {
      order_id?: string;
      new_status?: string;
    };

    if (!order_id || !new_status) {
      return json({ error: "Missing order_id or new_status" }, 400);
    }

    if (!KANBAN_STATUSES.includes(new_status)) {
      return json({
        error: `Invalid status. Must be one of: ${KANBAN_STATUSES.join(", ")}`,
      }, 400);
    }

    // Fetch current to log + ensure not still pending
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", order_id)
      .single();

    if (fetchErr || !current) {
      return json({ error: "Order not found" }, 404);
    }

    if (current.status === "pending") {
      return json({
        error: "Cannot update pending order via Kanban — must be confirmed first",
      }, 409);
    }

    console.log(`[update-order-status] ${user.id} ${order_id} ${current.status} → ${new_status}`);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update({ status: new_status, updated_at: new Date().toISOString() })
      .eq("id", order_id)
      .select()
      .single();

    if (updateErr) {
      console.error("[update-order-status] update failed:", updateErr);
      return json({ error: updateErr.message }, 500);
    }

    return json({ success: true, order: updated });
  } catch (err) {
    console.error("[update-order-status]", err);
    return json({ error: (err as Error).message ?? "Server error" }, 500);
  }
});
