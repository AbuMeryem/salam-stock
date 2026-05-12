/**
 * GET /api/cron/inventaire-tournant
 *
 * Cron Vercel quotidien (`0 7 * * *` UTC = 9h Paris en été).
 * Pour chaque dépôt actif (hors entrepôt) :
 *   1. Tire au sort UN employé du dépôt
 *   2. Lui assigne 7 produits aléatoires
 *   3. Lui envoie une push notif iPhone "Inventaire tournant à faire"
 *
 * Auth : Bearer ${CRON_SECRET} si défini, sinon GET libre (démo).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface DepotRow {
  id: string;
  nom: string;
  type: string;
}
interface EmpRow {
  id: string;
  prenom: string | null;
  nom: string;
}
interface StockRow {
  produit_id: string;
  quantite: number;
}

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
      reason: "Supabase non configuré — cron noop.",
    });
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. Dépôts actifs (hors entrepôt — Sodrune n'a pas d'inventaire tournant)
  const { data: depotsRaw, error: e1 } = await sb
    .from("depots")
    .select("id, nom, type")
    .eq("is_active", true);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const depots = (depotsRaw ?? []).filter(
    (d) => (d as DepotRow).type !== "entrepot"
  ) as DepotRow[];

  const today = new Date().toISOString().slice(0, 10);
  const summary: Array<{
    depot: string;
    employe: string | null;
    products: number;
    pushSent: boolean;
    skipped?: string;
  }> = [];

  // URL absolue pour fetch interne (push send)
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    `https://${req.headers.get("host") ?? "salam-stock.vercel.app"}`;

  for (const d of depots) {
    // 2. Skip si batch du jour déjà créé
    const { data: existing } = await sb
      .from("inventaires_tournants")
      .select("id")
      .eq("depot_id", d.id)
      .eq("date_assignation", today)
      .limit(1);
    if (existing && existing.length > 0) {
      summary.push({
        depot: d.nom,
        employe: null,
        products: 0,
        pushSent: false,
        skipped: "batch déjà existant",
      });
      continue;
    }

    // 3. Employés du dépôt
    const { data: empsRaw } = await sb
      .from("employes")
      .select("id, prenom, nom")
      .eq("depot_principal_id", d.id)
      .eq("is_active", true);
    const emps = (empsRaw ?? []) as EmpRow[];
    if (emps.length === 0) {
      summary.push({
        depot: d.nom,
        employe: null,
        products: 0,
        pushSent: false,
        skipped: "aucun employé actif",
      });
      continue;
    }

    // 4. Tire UN seul employé random
    const chosen = emps[Math.floor(Math.random() * emps.length)];

    // 5. Stock visible avec qty > 0
    const { data: stockRaw } = await sb
      .from("stock_par_depot")
      .select("produit_id, quantite")
      .eq("depot_id", d.id)
      .eq("is_visible", true)
      .gt("quantite", 0);
    const stock = (stockRaw ?? []) as StockRow[];
    if (stock.length === 0) {
      summary.push({
        depot: d.nom,
        employe: `${chosen.prenom ?? ""} ${chosen.nom}`.trim(),
        products: 0,
        pushSent: false,
        skipped: "aucun produit en stock",
      });
      continue;
    }

    const sample = [...stock].sort(() => Math.random() - 0.5).slice(0, 7);
    const inserts = sample.map((s) => ({
      depot_id: d.id,
      produit_id: s.produit_id,
      employe_assigne_id: chosen.id,
      date_assignation: today,
      quantite_attendue: s.quantite,
      statut: "assigne" as const,
    }));
    const { error: insertErr } = await sb
      .from("inventaires_tournants")
      .insert(inserts);
    if (insertErr) {
      console.error("[cron] insert err", insertErr);
      summary.push({
        depot: d.nom,
        employe: `${chosen.prenom ?? ""} ${chosen.nom}`.trim(),
        products: 0,
        pushSent: false,
        skipped: insertErr.message,
      });
      continue;
    }

    // 6. Push notif iPhone à l'employé tiré
    let pushSent = false;
    try {
      const r = await fetch(`${origin}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `📋 Inventaire tournant · ${d.nom}`,
          body: `${chosen.prenom ?? "Bonjour"}, ${inserts.length} produits à compter ce matin sur ton dépôt.`,
          url: "/v2/inventaire",
          tag: `inventaire-${today}-${d.id}`,
          urgent: false,
          employe_ids: [chosen.id],
        }),
      });
      pushSent = r.ok;
    } catch (e) {
      console.warn("[cron] push fail (non-bloquant):", e);
    }

    summary.push({
      depot: d.nom,
      employe: `${chosen.prenom ?? ""} ${chosen.nom}`.trim(),
      products: inserts.length,
      pushSent,
    });
  }

  return NextResponse.json({
    ok: true,
    today,
    summary,
  });
}
