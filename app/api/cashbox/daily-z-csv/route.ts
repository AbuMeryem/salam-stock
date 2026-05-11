import { NextResponse } from "next/server";
import { computeDailyZ, yesterdayIsoParis } from "@/lib/cashbox/daily-z";

export const dynamic = "force-dynamic";

/**
 * CSV détaillé ligne par ligne pour le comptable, format français
 * (séparateur ;, virgule décimale, BOM UTF-8 pour Excel FR).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || yesterdayIsoParis();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date invalide" }, { status: 400 });
  }

  try {
    const summary = await computeDailyZ(date);
    const header = [
      "Date",
      "Heure",
      "Numero_Commande",
      "Client_Nom",
      "Client_Email",
      "Code_Barre",
      "Designation",
      "Categorie",
      "Quantite",
      "Prix_Unitaire_TTC",
      "Total_Ligne_HT",
      "Total_Ligne_TTC",
      "TVA_Taux",
      "Total_Ligne_TVA",
      "Mode_Paiement",
      "Reference_Paiement",
    ];

    const rows = summary.lignes.map((l) => {
      const d = new Date(l.created_at);
      const dateStr = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
      const heureStr = d
        .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })
        .slice(0, 5);
      return [
        dateStr,
        heureStr,
        l.numero_commande,
        l.client_nom ?? "",
        l.client_email ?? "",
        l.produit_ean ?? "",
        l.produit_nom,
        l.produit_categorie ?? "",
        formatFr(l.quantite),
        formatFr(l.prix_unitaire_ttc),
        formatFr(l.total_ligne_ht),
        formatFr(l.total_ligne_ttc),
        l.tva_taux.toString().replace(".", ","),
        formatFr(l.total_ligne_tva),
        l.mode_paiement,
        l.reference_paiement ?? "",
      ].map(escapeCsv).join(";");
    });

    const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="salam-drive-Z-${date}.csv"`,
      },
    });
  } catch (err) {
    console.error("[daily-z-csv] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}

function formatFr(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function escapeCsv(s: string): string {
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
