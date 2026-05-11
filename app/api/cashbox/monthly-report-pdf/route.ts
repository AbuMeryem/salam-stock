import { NextResponse } from "next/server";
import { computeMonthlyReport, currentMonthYYYYMM } from "@/lib/cashbox/monthly-report";
import { formatEurFr } from "@/lib/cashbox/tva";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mois = url.searchParams.get("mois") || currentMonthYYYYMM();
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    return NextResponse.json({ error: "mois invalide" }, { status: 400 });
  }
  try {
    const report = await computeMonthlyReport(mois);
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 18;
    let y = margin;

    const monthLabel = new Date(parseInt(mois.slice(0, 4)), parseInt(mois.slice(5)) - 1, 1)
      .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    // Header sapin
    doc.setFillColor(14, 59, 46);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SALAM MARKET — Rapport mensuel", margin, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), margin, 19);
    doc.setFontSize(8);
    doc.text(`Émis le ${new Date(report.generated_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`, margin, 24);
    doc.setTextColor(0, 0, 0);
    y = 38;

    // KPI total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CA TOTAL CONSOLIDÉ", margin, y);
    y += 7;
    doc.setFontSize(22);
    doc.setTextColor(14, 59, 46);
    doc.text(formatEurFr(report.consolidation.ca_ttc_total), margin, y);
    doc.setTextColor(0, 0, 0);
    y += 9;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Magasin : ${formatEurFr(report.magasin.ca_ttc)} (${report.consolidation.repartition.magasin_pct.toFixed(1)}%)   Drive : ${formatEurFr(report.drive.ca_ttc)} (${report.consolidation.repartition.drive_pct.toFixed(1)}%)`,
      margin, y
    );
    y += 10;
    hr(doc, margin, y, pageW - margin); y += 6;

    // TVA
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("TVA COLLECTÉE", margin, y); y += 7;
    doc.setFont("helvetica", "normal").setFontSize(10);
    for (const [rate, v] of Object.entries(report.consolidation.tva_par_taux).sort(
      (a, b) => parseFloat(a[0]) - parseFloat(b[0])
    )) {
      doc.text(`TVA ${rate}%`, margin, y);
      doc.text(`Base : ${formatEurFr(v.base_ht)}`, margin + 30, y);
      doc.text(`TVA : ${formatEurFr(v.tva)}`, margin + 80, y);
      doc.text(`TTC : ${formatEurFr(v.ttc)}`, margin + 130, y);
      y += 6;
    }
    y += 4;
    hr(doc, margin, y, pageW - margin); y += 6;

    // Magasin
    sectionHeader(doc, margin, y, "VENTES MAGASIN (Cashmag)"); y += 8;
    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(`CA TTC : ${formatEurFr(report.magasin.ca_ttc)}`, margin, y);
    doc.text(`Tickets : ${report.magasin.nb_tickets}`, margin + 70, y);
    doc.text(`Panier : ${formatEurFr(report.magasin.panier_moyen)}`, margin + 130, y);
    y += 6;
    if (report.magasin.partial) {
      doc.setTextColor(217, 119, 6);
      doc.text("⚠ Données partielles : penser à importer le CSV Cashmag.", margin, y);
      doc.setTextColor(0, 0, 0);
      y += 6;
    }
    y += 2;
    topList(doc, margin, y, "Top 5 magasin", report.magasin.top_produits.slice(0, 5));
    y += 5 + report.magasin.top_produits.slice(0, 5).length * 5;
    hr(doc, margin, y, pageW - margin); y += 6;

    // Drive
    sectionHeader(doc, margin, y, "VENTES DRIVE"); y += 8;
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`CA TTC : ${formatEurFr(report.drive.ca_ttc)}`, margin, y);
    doc.text(`Commandes : ${report.drive.nb_tickets}`, margin + 70, y);
    doc.text(`Panier : ${formatEurFr(report.drive.panier_moyen)}`, margin + 130, y);
    y += 6;
    doc.text(`Frais Stripe : ${formatEurFr(report.drive.frais_stripe)}`, margin, y);
    doc.text(`Net : ${formatEurFr(report.drive.net)}`, margin + 70, y);
    y += 8;
    topList(doc, margin, y, "Top 5 drive", report.drive.top_produits.slice(0, 5));

    // Footer
    y = 280;
    hr(doc, margin, y, pageW - margin);
    doc.setFontSize(8).setTextColor(120, 120, 120);
    doc.text("Salam Market — K & A FOOD — SIRET 802 773 812 — 8 av. Larrieu-Thibaud, Toulouse",
      pageW / 2, y + 4, { align: "center" });
    doc.text("Document non fiscal au sens NF525. À transmettre à l'expert-comptable.",
      pageW / 2, y + 8, { align: "center" });

    const buf = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="salam-rapport-mensuel-${mois}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[monthly-report-pdf]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}

function hr(doc: any, x1: number, y: number, x2: number) {
  doc.setLineWidth(0.2).setDrawColor(180, 180, 180);
  doc.line(x1, y, x2, y);
}
function sectionHeader(doc: any, x: number, y: number, label: string) {
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(14, 59, 46);
  doc.text(label, x, y);
  doc.setTextColor(0, 0, 0);
}
function topList(doc: any, x: number, y: number, title: string,
  rows: Array<{ designation: string; quantite: number; ca: number }>) {
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    doc.text(`${i + 1}. ${r.designation.slice(0, 45)}`, x, y + 5 + i * 5);
    doc.text(`×${r.quantite}`, x + 100, y + 5 + i * 5);
    doc.text(formatEurFr(r.ca), x + 130, y + 5 + i * 5);
  }
}
