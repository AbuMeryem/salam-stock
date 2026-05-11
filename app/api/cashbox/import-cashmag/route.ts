import { NextResponse } from "next/server";
import { parseCashmagCsv } from "@/lib/cashbox/cashmag-parse";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const sb = supabase();
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }
  let body: { csv?: string; importedBy?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "csv manquant" }, { status: 400 });
  }

  const result = parseCashmagCsv(body.csv);
  if (result.rows.length === 0) {
    return NextResponse.json({
      ok: false, meta: result.meta,
      errors: result.errors.slice(0, 50), inserted: 0,
    });
  }

  let inserted = 0;
  const dbErrors: string[] = [];
  for (let i = 0; i < result.rows.length; i += 200) {
    const chunk = result.rows.slice(i, i + 200).map((r) => ({
      date_vente: r.date_vente, heure_vente: r.heure_vente,
      numero_ticket: r.numero_ticket, code_barre: r.code_barre,
      designation: r.designation, quantite: r.quantite,
      prix_ttc: r.prix_ttc, prix_ht: r.prix_ht,
      tva_taux: r.tva_taux, mode_paiement: r.mode_paiement,
      raw_line: r.raw_line, imported_by: body.importedBy ?? "manual",
    }));
    const { error, count } = await sb
      .from("ventes_cashmag_import")
      .upsert(chunk, {
        onConflict: "numero_ticket,code_barre,designation,quantite",
        count: "exact", ignoreDuplicates: false,
      });
    if (error) dbErrors.push(error.message);
    else inserted += count ?? chunk.length;
  }

  return NextResponse.json({
    ok: dbErrors.length === 0, inserted, parsed: result.rows.length,
    parseErrors: result.errors.slice(0, 50), dbErrors, meta: result.meta,
  });
}
