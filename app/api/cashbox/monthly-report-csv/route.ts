import { NextResponse } from "next/server";
import { computeMonthlyReport, currentMonthYYYYMM } from "@/lib/cashbox/monthly-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mois = url.searchParams.get("mois") || currentMonthYYYYMM();
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    return NextResponse.json({ error: "mois invalide" }, { status: 400 });
  }
  try {
    const r = await computeMonthlyReport(mois);
    const lines: string[] = [];
    const fr = (n: number) => n.toFixed(2).replace(".", ",");

    lines.push("### SYNTHÈSE ###");
    lines.push("Libellé;Montant");
    lines.push(`CA Magasin TTC;${fr(r.magasin.ca_ttc)}`);
    lines.push(`CA Drive TTC;${fr(r.drive.ca_ttc)}`);
    lines.push(`CA Total TTC;${fr(r.consolidation.ca_ttc_total)}`);
    lines.push(`Tickets Magasin;${r.magasin.nb_tickets}`);
    lines.push(`Commandes Drive;${r.drive.nb_tickets}`);
    lines.push(`Panier moyen Magasin;${fr(r.magasin.panier_moyen)}`);
    lines.push(`Panier moyen Drive;${fr(r.drive.panier_moyen)}`);
    lines.push(`Frais Stripe Drive;${fr(r.drive.frais_stripe)}`);
    lines.push(`Net Drive après frais;${fr(r.drive.net)}`);
    if (r.consolidation.evolution_vs_mois_precedent !== null) {
      lines.push(`Évolution vs mois précédent (%);${fr(r.consolidation.evolution_vs_mois_precedent)}`);
    }
    lines.push("");
    lines.push("### VENTILATION TVA ###");
    lines.push("Taux;Base HT;TVA;TTC");
    for (const [rate, v] of Object.entries(r.consolidation.tva_par_taux).sort(
      (a, b) => parseFloat(a[0]) - parseFloat(b[0])
    )) {
      lines.push(`${rate.replace(".", ",")}%;${fr(v.base_ht)};${fr(v.tva)};${fr(v.ttc)}`);
    }
    lines.push("");
    lines.push("### TOP MAGASIN ###");
    lines.push("Rang;Désignation;Quantité;CA");
    r.magasin.top_produits.forEach((p, i) =>
      lines.push(`${i + 1};${p.designation};${fr(p.quantite)};${fr(p.ca)}`));
    lines.push("");
    lines.push("### TOP DRIVE ###");
    lines.push("Rang;Désignation;Quantité;CA");
    r.drive.top_produits.forEach((p, i) =>
      lines.push(`${i + 1};${p.designation};${fr(p.quantite)};${fr(p.ca)}`));

    return new NextResponse("﻿" + lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="salam-rapport-mensuel-${mois}.csv"`,
      },
    });
  } catch (err) {
    console.error("[monthly-report-csv]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
