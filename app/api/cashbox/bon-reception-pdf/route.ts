/**
 * GET /api/cashbox/bon-reception-pdf?bdl_id=<uuid>
 *
 * Génère le Bon de Réception (BR) PDF à partir d'un bon de livraison
 * réceptionné. Le BR est le document OUTPUT signé par le magasin après
 * contrôle physique des marchandises livrées :
 *   - en-tête Salam Market K&A FOOD
 *   - identité fournisseur + n° BDL fournisseur
 *   - tableau Produit | Attendu | Reçu | Écart
 *   - photos palette intégrées (si présentes)
 *   - signature numérique : employé réceptionneur + horodatage Paris
 *
 * À distinguer de l'INPUT bon_de_livraison qui est le doc du fournisseur.
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BdlLigne {
  id: string;
  produit_id: string | null;
  code_barre_attendu: string | null;
  quantite_attendue: number;
  quantite_recue: number;
  statut: string;
  produits: { nom: string; ean: string | null } | null;
}

interface BdlFull {
  id: string;
  numero_bdl: string;
  numero_bdl_fournisseur: string | null;
  date_livraison_prevue: string;
  statut: string;
  photo_palette_url_1: string | null;
  photo_palette_url_2: string | null;
  photo_bdl_url: string | null;
  notes: string | null;
  receptionne_le: string | null;
  fournisseurs: { nom: string; adresse: string | null; siret: string | null } | null;
  depots: { nom: string; adresse: string | null } | null;
  employes_reception: { prenom: string | null; nom: string } | null;
  bons_de_livraison_lignes: BdlLigne[];
}

function fmtDateFr(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTimeFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function line(doc: any, x1: number, y: number, x2: number) {
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bdlId = url.searchParams.get("bdl_id");
  if (!bdlId) {
    return NextResponse.json({ error: "bdl_id requis" }, { status: 400 });
  }

  const sb = supabase();
  if (!sb) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { data, error } = await sb
    .from("bons_de_livraison")
    .select(
      `id, numero_bdl, numero_bdl_fournisseur, date_livraison_prevue, statut,
       photo_palette_url_1, photo_palette_url_2, photo_bdl_url, notes,
       receptionne_le,
       fournisseurs (nom, adresse, siret),
       depots (nom, adresse),
       employes_reception:employes!receptionne_par (prenom, nom),
       bons_de_livraison_lignes (
         id, produit_id, code_barre_attendu, quantite_attendue, quantite_recue, statut,
         produits (nom, ean)
       )`
    )
    .eq("id", bdlId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "bdl_introuvable", detail: error?.message },
      { status: 404 }
    );
  }
  const bdl = data as unknown as BdlFull;

  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 16;
    const colW = pageW - margin * 2;
    let y = margin;

    // ─── HEADER ──────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SALAM MARKET", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("K & A FOOD · SIRET 802 773 812", margin, y);
    y += 4;
    doc.text("8 av. Larrieu-Thibaud, 31100 Toulouse", margin, y);

    // À droite : type de document
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("BON DE RÉCEPTION", pageW - margin, margin + 1, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`N° ${bdl.numero_bdl}`, pageW - margin, margin + 6, { align: "right" });
    doc.text(
      `Émis le ${fmtDateTimeFr(bdl.receptionne_le ?? new Date().toISOString())}`,
      pageW - margin,
      margin + 10,
      { align: "right" }
    );

    y += 10;
    line(doc, margin, y, pageW - margin);
    y += 8;

    // ─── BLOC FOURNISSEUR + LIVRAISON ────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("FOURNISSEUR", margin, y);
    doc.text("LIVRAISON", pageW / 2 + 5, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(bdl.fournisseurs?.nom ?? "—", margin, y);
    doc.text(`Dépôt : ${bdl.depots?.nom ?? "—"}`, pageW / 2 + 5, y);
    y += 4;
    if (bdl.fournisseurs?.adresse) {
      const lines = doc.splitTextToSize(bdl.fournisseurs.adresse, colW / 2 - 4);
      doc.text(lines, margin, y);
      y += lines.length * 4;
    }
    doc.text(`Date prévue : ${fmtDateFr(bdl.date_livraison_prevue)}`, pageW / 2 + 5, y - 4);
    if (bdl.numero_bdl_fournisseur) {
      doc.setFont("helvetica", "bold");
      doc.text(
        `BDL fournisseur : ${bdl.numero_bdl_fournisseur}`,
        pageW / 2 + 5,
        y
      );
      doc.setFont("helvetica", "normal");
    }
    y += 6;
    line(doc, margin, y, pageW - margin);
    y += 6;

    // ─── TABLEAU LIGNES ──────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("LIGNES RÉCEPTIONNÉES", margin, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFillColor(245, 240, 225);
    doc.rect(margin, y - 3, colW, 6, "F");
    doc.text("PRODUIT", margin + 1, y + 1);
    doc.text("EAN", margin + 95, y + 1);
    doc.text("Att.", margin + 130, y + 1, { align: "right" });
    doc.text("Reçu", margin + 150, y + 1, { align: "right" });
    doc.text("Écart", margin + 170, y + 1, { align: "right" });
    doc.text("Statut", margin + 192, y + 1, { align: "right" });
    y += 6;

    doc.setFont("helvetica", "normal");
    let totalAttendu = 0;
    let totalRecu = 0;
    let totalEcart = 0;

    for (const l of bdl.bons_de_livraison_lignes) {
      const ecart = l.quantite_recue - l.quantite_attendue;
      totalAttendu += l.quantite_attendue;
      totalRecu += l.quantite_recue;
      totalEcart += ecart;

      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      const nom = (l.produits?.nom ?? "Produit").slice(0, 50);
      doc.text(nom, margin + 1, y);
      doc.text(l.produits?.ean ?? l.code_barre_attendu ?? "—", margin + 95, y);
      doc.text(String(l.quantite_attendue), margin + 130, y, { align: "right" });
      doc.text(String(l.quantite_recue), margin + 150, y, { align: "right" });

      // Écart : rouge si négatif, ambre si positif, gris si zéro
      if (ecart < 0) doc.setTextColor(229, 72, 61);
      else if (ecart > 0) doc.setTextColor(217, 119, 6);
      else doc.setTextColor(120, 120, 120);
      doc.text(`${ecart > 0 ? "+" : ""}${ecart}`, margin + 170, y, { align: "right" });
      doc.setTextColor(0, 0, 0);

      const statutLabel =
        l.statut === "recu"
          ? "Reçu"
          : l.statut === "manquant"
            ? "Manquant"
            : l.statut === "surplus"
              ? "Surplus"
              : "Att.";
      doc.text(statutLabel, margin + 192, y, { align: "right" });
      y += 4.5;
    }

    y += 2;
    line(doc, margin, y, pageW - margin);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("TOTAUX", margin + 1, y);
    doc.text(String(totalAttendu), margin + 130, y, { align: "right" });
    doc.text(String(totalRecu), margin + 150, y, { align: "right" });
    if (totalEcart < 0) doc.setTextColor(229, 72, 61);
    else if (totalEcart > 0) doc.setTextColor(217, 119, 6);
    doc.text(
      `${totalEcart > 0 ? "+" : ""}${totalEcart}`,
      margin + 170,
      y,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
    y += 8;

    // ─── PHOTOS PALETTE ──────────────────────────────────────
    const photos = [
      { label: "Palette côté 1", url: bdl.photo_palette_url_1 },
      { label: "Palette côté 2", url: bdl.photo_palette_url_2 },
      { label: "BDL papier fournisseur", url: bdl.photo_bdl_url },
    ].filter((p) => p.url);

    if (photos.length > 0) {
      if (y > 230) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("PIÈCES JOINTES", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      const photoW = (colW - 8) / photos.length;
      let x = margin;
      const photoY = y;
      const photoH = 45;
      for (const ph of photos) {
        try {
          // Skip si pas une data URL valide (Storage URL externe doit être fetched ailleurs)
          if (ph.url && ph.url.startsWith("data:image")) {
            doc.addImage(ph.url, "JPEG", x, photoY, photoW, photoH);
          } else {
            doc.setFillColor(245, 240, 225);
            doc.rect(x, photoY, photoW, photoH, "F");
            doc.text("(photo distante)", x + photoW / 2, photoY + photoH / 2, {
              align: "center",
            });
          }
          doc.text(ph.label, x + photoW / 2, photoY + photoH + 4, {
            align: "center",
          });
        } catch {
          /* ignore une image corrompue */
        }
        x += photoW + 4;
      }
      y = photoY + photoH + 10;
    }

    if (bdl.notes) {
      if (y > 250) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("NOTES", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const noteLines = doc.splitTextToSize(bdl.notes, colW);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 4 + 4;
    }

    // ─── SIGNATURE NUMÉRIQUE ─────────────────────────────────
    if (y > 250) {
      doc.addPage();
      y = margin;
    }
    line(doc, margin, y, pageW - margin);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("VALIDATION", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const employeNom =
      bdl.employes_reception
        ? `${bdl.employes_reception.prenom ?? ""} ${bdl.employes_reception.nom}`.trim()
        : "—";
    doc.text(`Réceptionné par : ${employeNom}`, margin, y);
    y += 4.5;
    doc.text(`Le ${fmtDateTimeFr(bdl.receptionne_le)}`, margin, y);
    y += 4.5;
    doc.text(`Statut : ${bdl.statut}`, margin, y);

    // Footer mention
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Document généré numériquement par Salam Stock. À archiver avec la facture fournisseur.",
      pageW / 2,
      287,
      { align: "center" }
    );

    const pdfBytes = doc.output("arraybuffer");
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="bon-reception-${bdl.numero_bdl}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[br-pdf] error", e);
    return NextResponse.json(
      { error: "pdf_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
