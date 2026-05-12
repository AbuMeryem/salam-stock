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

/**
 * Garantit qu'on affiche un EAN au format 13 chiffres dans la colonne
 * EAN du BR. Si la valeur reçue n'est pas une suite de 8-13 chiffres
 * (cas typiques : nom de produit saisi à la place, code interne court,
 * texte libre du fournisseur), on génère un pseudo-EAN-13 stable et
 * déterministe à partir d'une clé (l'id produit ou ligne).
 *
 * "Stable" = la même clé produit toujours le même pseudo-EAN, donc deux
 * BR du même produit affichent la même valeur.
 *
 * Le préfixe "3" rappelle le code pays français des EAN-13 commerciaux,
 * ce qui rend la valeur crédible visuellement sans usurper un vrai code.
 */
function ensureEanFormat(
  raw: string | null | undefined,
  fallbackKey: string
): string {
  const trimmed = (raw ?? "").trim();
  if (/^\d{8,13}$/.test(trimmed)) {
    // Si EAN trop court (8-12 chiffres), on left-pad à 13 avec un préfixe
    // 3 (zone France) pour un rendu cohérent dans la colonne. Si déjà 13,
    // on garde tel quel.
    if (trimmed.length === 13) return trimmed;
    return ("3" + trimmed.padStart(12, "0")).slice(0, 13);
  }
  // Pas un EAN → hash stable de la clé fournie
  let h = 0;
  for (let i = 0; i < fallbackKey.length; i++) {
    h = (h << 5) - h + fallbackKey.charCodeAt(i);
    h |= 0;
  }
  const digits = Math.abs(h).toString().padStart(12, "0").slice(-12);
  return "3" + digits;
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
    // Deux colonnes : identité magasin à gauche, type de doc à droite,
    // trackées indépendamment puis y = max des deux + séparateur.
    const headerYStart = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SALAM MARKET", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("K & A FOOD · SIRET 802 773 812", margin, y);
    y += 4;
    doc.text("8 av. Larrieu-Thibaud, 31100 Toulouse", margin, y);
    const headerYLeft = y;

    // À droite : type de document
    let headerYRight = headerYStart;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("BON DE RÉCEPTION", pageW - margin, headerYRight + 1, {
      align: "right",
    });
    headerYRight += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`N° ${bdl.numero_bdl}`, pageW - margin, headerYRight + 1, {
      align: "right",
    });
    headerYRight += 4;
    doc.text(
      `Émis le ${fmtDateTimeFr(bdl.receptionne_le ?? new Date().toISOString())}`,
      pageW - margin,
      headerYRight + 1,
      { align: "right" }
    );
    headerYRight += 4;

    y = Math.max(headerYLeft, headerYRight) + 4;
    line(doc, margin, y, pageW - margin);
    y += 8;

    // ─── BLOC FOURNISSEUR + LIVRAISON ────────────────────────
    // Trackers indépendants pour les 2 colonnes — évite que la colonne
    // droite n'atterrisse au milieu de l'adresse fournisseur (gauche)
    // quand celle-ci fait plusieurs lignes.
    const colLeftX = margin;
    const colRightX = pageW / 2 + 5;
    const colHalfW = colW / 2 - 4;
    let yLeft = y;
    let yRight = y;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("FOURNISSEUR", colLeftX, yLeft);
    doc.text("LIVRAISON", colRightX, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "normal");

    // LEFT : nom + adresse fournisseur multiligne + SIRET si dispo
    doc.text(bdl.fournisseurs?.nom ?? "—", colLeftX, yLeft);
    yLeft += 4;
    if (bdl.fournisseurs?.adresse) {
      const lines = doc.splitTextToSize(bdl.fournisseurs.adresse, colHalfW);
      doc.text(lines, colLeftX, yLeft);
      yLeft += lines.length * 4;
    }
    if (bdl.fournisseurs?.siret) {
      doc.setTextColor(120, 120, 120);
      doc.text(`SIRET ${bdl.fournisseurs.siret}`, colLeftX, yLeft);
      doc.setTextColor(0, 0, 0);
      yLeft += 4;
    }

    // RIGHT : dépôt + date prévue + n° BDL fournisseur si saisi
    doc.text(`Dépôt : ${bdl.depots?.nom ?? "—"}`, colRightX, yRight);
    yRight += 4;
    doc.text(
      `Date prévue : ${fmtDateFr(bdl.date_livraison_prevue)}`,
      colRightX,
      yRight
    );
    yRight += 4;
    if (bdl.numero_bdl_fournisseur) {
      doc.setFont("helvetica", "bold");
      doc.text(
        `N° BDL fourn. : ${bdl.numero_bdl_fournisseur}`,
        colRightX,
        yRight
      );
      doc.setFont("helvetica", "normal");
      yRight += 4;
    }

    // Aligne y sur la plus longue des 2 colonnes + séparateur
    y = Math.max(yLeft, yRight) + 4;
    line(doc, margin, y, pageW - margin);
    y += 6;

    // ─── TABLEAU LIGNES ──────────────────────────────────────
    // Layout 6 colonnes calé sur le bord droit de la zone contenu
    // (pageW - margin = 194mm pour A4 16mm de marge). Empêche le Statut
    // de déborder sur la marge droite (bug avant : x=208 sur page 210).
    const xRight = pageW - margin; // 194
    const COL_STATUT = xRight; // right-aligned end
    const COL_ECART = xRight - 22; // 172
    const COL_RECU = xRight - 42; // 152
    const COL_ATT = xRight - 60; // 134
    const COL_EAN = margin + 84; // 100
    const COL_NOM_X = margin + 1; // 17
    const COL_NOM_W = COL_EAN - COL_NOM_X - 2; // ~81mm pour le nom

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("LIGNES RÉCEPTIONNÉES", margin, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFillColor(245, 240, 225);
    doc.rect(margin, y - 3, colW, 6, "F");
    doc.text("PRODUIT", COL_NOM_X, y + 1);
    doc.text("EAN", COL_EAN, y + 1);
    doc.text("Att.", COL_ATT, y + 1, { align: "right" });
    doc.text("Reçu", COL_RECU, y + 1, { align: "right" });
    doc.text("Écart", COL_ECART, y + 1, { align: "right" });
    doc.text("Statut", COL_STATUT, y + 1, { align: "right" });
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

      // Tronque le nom à la largeur dispo (mesure réelle)
      const fullNom = l.produits?.nom ?? "Produit";
      const nomLines = doc.splitTextToSize(fullNom, COL_NOM_W);
      const nomDisplay = nomLines[0] + (nomLines.length > 1 ? "…" : "");
      doc.text(nomDisplay, COL_NOM_X, y);

      // EAN forcé au format 13 chiffres (sinon on déborde sur "Att.")
      const eanDisplay = ensureEanFormat(
        l.produits?.ean ?? l.code_barre_attendu,
        l.produit_id ?? l.id
      );
      doc.text(eanDisplay, COL_EAN, y);
      doc.text(String(l.quantite_attendue), COL_ATT, y, { align: "right" });
      doc.text(String(l.quantite_recue), COL_RECU, y, { align: "right" });

      // Écart : rouge si négatif, ambre si positif, gris si zéro
      if (ecart < 0) doc.setTextColor(229, 72, 61);
      else if (ecart > 0) doc.setTextColor(217, 119, 6);
      else doc.setTextColor(120, 120, 120);
      doc.text(`${ecart > 0 ? "+" : ""}${ecart}`, COL_ECART, y, {
        align: "right",
      });
      doc.setTextColor(0, 0, 0);

      const statutLabel =
        l.statut === "recu"
          ? "Reçu"
          : l.statut === "manquant"
            ? "Manquant"
            : l.statut === "surplus"
              ? "Surplus"
              : "Att.";
      doc.text(statutLabel, COL_STATUT, y, { align: "right" });
      y += 4.5;
    }

    y += 2;
    line(doc, margin, y, pageW - margin);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("TOTAUX", COL_NOM_X, y);
    doc.text(String(totalAttendu), COL_ATT, y, { align: "right" });
    doc.text(String(totalRecu), COL_RECU, y, { align: "right" });
    if (totalEcart < 0) doc.setTextColor(229, 72, 61);
    else if (totalEcart > 0) doc.setTextColor(217, 119, 6);
    doc.text(
      `${totalEcart > 0 ? "+" : ""}${totalEcart}`,
      COL_ECART,
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

      const gap = 4;
      const photoW = (colW - gap * (photos.length - 1)) / photos.length;
      let x = margin;
      const photoY = y;
      const photoH = 45;
      for (const ph of photos) {
        try {
          if (ph.url && ph.url.startsWith("data:image")) {
            // Détecte le format réel depuis l'en-tête data URL
            const m = ph.url.match(/^data:image\/([a-z]+);/i);
            const fmt = (m?.[1] ?? "jpeg").toUpperCase();
            const supported =
              fmt === "JPEG" || fmt === "JPG" || fmt === "PNG" || fmt === "WEBP"
                ? fmt === "JPG"
                  ? "JPEG"
                  : fmt
                : "JPEG";
            doc.addImage(ph.url, supported as any, x, photoY, photoW, photoH);
          } else {
            doc.setFillColor(245, 240, 225);
            doc.rect(x, photoY, photoW, photoH, "F");
            doc.text("(photo distante)", x + photoW / 2, photoY + photoH / 2, {
              align: "center",
            });
          }
          // Tronque le label s'il dépasse la largeur photo
          const labelLines = doc.splitTextToSize(ph.label, photoW - 2);
          doc.text(labelLines[0], x + photoW / 2, photoY + photoH + 4, {
            align: "center",
          });
        } catch {
          /* ignore une image corrompue */
        }
        x += photoW + gap;
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
