/**
 * GET /api/cron/inventaire-tournant
 * Called by Vercel Cron every day at 7am (Europe/Paris).
 * Picks 5-10 produits per dépôt actif and assigns them to a random employé.
 *
 * Auth: Vercel sends `authorization: Bearer ${CRON_SECRET}` if CRON_SECRET is set.
 * For demo, any GET succeeds; production should set CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({
      ok: true,
      mode: "noop",
      reason: "Supabase not configured — cron is a no-op until env vars are set.",
    });
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Active depots
  const { data: depots, error: e1 } = await sb
    .from("depots")
    .select("id, nom")
    .eq("is_active", true);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  let totalAssigned = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const d of depots ?? []) {
    // skip if today's batch already exists
    const { data: existing } = await sb
      .from("inventaires_tournants")
      .select("id")
      .eq("depot_id", (d as { id: string }).id)
      .eq("date_assignation", today)
      .limit(1);
    if (existing && existing.length > 0) continue;

    // employees of this depot
    const { data: employes } = await sb
      .from("employes")
      .select("id")
      .eq("depot_principal_id", (d as { id: string }).id)
      .eq("is_active", true);
    if (!employes || employes.length === 0) continue;

    // products with stock in this depot
    const { data: stock } = await sb
      .from("stock_par_depot")
      .select("produit_id, quantite")
      .eq("depot_id", (d as { id: string }).id)
      .eq("is_visible", true)
      .gt("quantite", 0);
    if (!stock || stock.length === 0) continue;

    const sample = [...stock].sort(() => Math.random() - 0.5).slice(0, 7);
    const inserts = sample.map((s, i) => ({
      depot_id: (d as { id: string }).id,
      produit_id: (s as { produit_id: string }).produit_id,
      employe_assigne_id: (employes[i % employes.length] as { id: string }).id,
      date_assignation: today,
      quantite_attendue: (s as { quantite: number }).quantite,
      statut: "assigne" as const,
    }));
    const { error: insertErr } = await sb
      .from("inventaires_tournants")
      .insert(inserts);
    if (insertErr) {
      console.error("cron insert err", insertErr);
      continue;
    }
    totalAssigned += inserts.length;
  }

  return NextResponse.json({ ok: true, totalAssigned, depots: (depots ?? []).length });
}
