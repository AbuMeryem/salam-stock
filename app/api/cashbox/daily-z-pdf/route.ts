import { NextResponse } from "next/server";
import { computeDailyZ, yesterdayIsoParis } from "@/lib/cashbox/daily-z";
import { formatDateFr, formatEurFr, formatHeureFr } from "@/lib/cashbox/tva";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Génère le PDF du Z journalier via jspdf côté serveur (Node.js
 * runtime — jspdf marche en Node). Format A4, monospace pour rappeler
 * un ticket de caisse imprimé.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || yesterdayIsoParis();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date invalide" }, { status: 400 });
  }

  try {
    const summary = await computeDailyZ(date);
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 20;
    const colW = pageW - margin * 2;
    let y = margin;

    // Police mono pour effet ticket
    doc.setFont("courier", "normal");

    // Header
    doc.setFontSize(14);
    doc.setFont("courier", "bold");
    doc.text("SALAM MARKET DRIVE", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("courier", "normal");
    doc.text("K & A FOOD — SIRET 802 773 812", pageW / 2, y, {
      align: "center",
    });
    y += 4;
    doc.text("8 av. Larrieu-Thibaud, 31100 Toulouse", pageW / 2, y, {
      align: "center",
    });
    y += 8;

    line(doc, margin, y, pageW - margin);
    y += 6;

    doc.setFontSize(12);
    doc.setFont("courier", "bold");
    doc.text("RÉCAP FISCAL JOURNALIER", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(10);
    doc.setFont("courier", "normal");
    doc.text(`Date : ${formatDateFr(date)}`, pageW / 2, y, { align: "center" });
    y += 4;
    doc.setFontSize(8);
    doc.text(
      `Émis le ${new Date(summary.generated_at).toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
      })}`,
      pageW / 2,
      y,
      { align: "center" }
    );
    y += 8;

    line(doc, margin, y, pageW - margin);
    y += 6;

    if (summary.status === "no_data") {
      doc.setFontSize(11);
      doc.text("Aucune vente Drive sur cette date.", pageW / 2, y, {
        align: "center",
      });
      y += 10;
    } else {
      // Compteurs
      doc.setFontSize(10);
      kv(doc, "Nombre de commandes", summary.nb_commandes.toString(), margin, y, colW);
      y += 5;
      kv(
        doc,
        "1ère commande",
        formatHeureFr(summary.premiere_commande_at ?? ""),
        margin,
        y,
        colW
      );
      y += 5;
      kv(
        doc,
        "Dernière commande",
        formatHeureFr(summary.derniere_commande_at ?? ""),
        margin,
        y,
        colW
      );
      y += 8;

      line(doc, margin, y, pageW - margin);
      y += 6;

      // CA
      doc.setFont("courier", "bold");
      kv(doc, "CA TTC", formatEurFr(summary.ca_ttc), margin, y, colW);
      y += 5;
      doc.setFont("courier", "normal");
      kv(doc, "CA HT", formatEurFr(summary.ca_ht), margin, y, colW);
      y += 8;

      line(doc, margin, y, pageW - margin);
      y += 6;

      // TVA
      doc.setFont("courier", "bold");
      doc.text("TVA COLLECTÉE", margin, y);
      y += 6;
      doc.setFont("courier", "normal");
      for (const [rate, v] of Object.entries(summary.tva_par_taux).sort(
        (a, b) => parseFloat(a[0]) - parseFloat(b[0])
      )) {
        doc.text(`TVA ${rate}%`, margin, y);
        doc.text(formatEurFr(v.tva), pageW - margin, y, { align: "right" });
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `(base ${formatEurFr(v.base_ht)})`,
          pageW - margin - 35,
          y,
          { align: "right" }
        );
        doc.setTextColor(0);
        doc.setFontSize(10);
        y += 5;
      }
      doc.setFont("courier", "bold");
      kv(doc, "Total TVA", formatEurFr(summary.tva_totale), margin, y, colW);
      y += 8;
      doc.setFont("courier", "normal");

      line(doc, margin, y, pageW - margin);
      y += 6;

      // Paiement
      doc.setFont("courier", "bold");
      doc.text("MODE DE PAIEMENT", margin, y);
      y += 6;
      doc.setFont("courier", "normal");
      for (const [mode, ttc] of Object.entries(summary.modes_paiement)) {
        kv(
          doc,
          mode === "stripe" ? "Stripe (CB online)" : mode,
          formatEurFr(ttc),
          margin,
          y,
          colW
        );
        y += 5;
      }
      y += 3;

      line(doc, margin, y, pageW - margin);
      y += 6;

      // Net
      kv(
        doc,
        "Frais Stripe",
        `− ${formatEurFr(summary.frais_stripe)}`,
        margin,
        y,
        colW
      );
      y += 5;
      doc.setFont("courier", "bold");
      doc.setFillColor(14, 59, 46);
      doc.rect(margin - 2, y - 4, colW + 4, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.text("NET ENCAISSÉ", margin, y);
      doc.text(formatEurFr(summary.net_encaisse), pageW - margin, y, {
        align: "right",
      });
      doc.setTextColor(0);
      doc.setFont("courier", "normal");
      y += 8;
      kv(
        doc,
        "Panier moyen",
        formatEurFr(summary.panier_moyen),
        margin,
        y,
        colW
      );
      y += 10;
    }

    line(doc, margin, y, pageW - margin);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Document non fiscal au sens NF525. À conserver pour la comptabilité.",
      pageW / 2,
      y,
      { align: "center" }
    );

    const buf = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="salam-drive-Z-${date}.pdf"`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("[daily-z-pdf] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function line(doc: any, x1: number, y: number, x2: number) {
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function kv(doc: any, k: string, v: string, x: number, y: number, w: number) {
  doc.text(k, x, y);
  doc.text(v, x + w, y, { align: "right" });
}
