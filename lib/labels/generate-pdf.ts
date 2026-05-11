"use client";

/**
 * Brother QL-820 label PDF generator (62mm × 29mm continuous-roll style).
 * One label per page. Uses bwip-js to draw EAN-13 barcodes.
 */

import jsPDF from "jspdf";
import bwipjs from "bwip-js/browser";

interface LabelInput {
  produitNom: string;
  marque?: string | null;
  ean: string;
}

const LABEL_W_MM = 62;
const LABEL_H_MM = 29;

export async function buildLabelsPdf(
  items: LabelInput[],
  copiesPerProduct: number
): Promise<Blob> {
  if (items.length === 0) throw new Error("Aucune étiquette à générer.");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [LABEL_W_MM, LABEL_H_MM],
  });

  let pageIdx = 0;
  for (const item of items) {
    for (let copy = 0; copy < copiesPerProduct; copy++) {
      if (pageIdx > 0) pdf.addPage([LABEL_W_MM, LABEL_H_MM], "landscape");
      // Title — wrap on 2 lines if needed
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      const title = pdf.splitTextToSize(item.produitNom, LABEL_W_MM - 6);
      const titleLines = title.slice(0, 2);
      pdf.text(titleLines, 3, 5);

      // Marque
      if (item.marque) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.text(item.marque, 3, 5 + titleLines.length * 3);
      }

      // Barcode (drawn into a canvas then imported as PNG)
      const canvas = document.createElement("canvas");
      try {
        bwipjs.toCanvas(canvas, {
          bcid: "ean13",
          text: item.ean,
          scale: 2,
          height: 12,
          includetext: true,
          textxalign: "center",
          textsize: 7,
        });
        const dataUrl = canvas.toDataURL("image/png");
        // Place barcode 33mm wide centered horizontally, near bottom.
        const bcW = 38;
        const bcH = 14;
        pdf.addImage(
          dataUrl,
          "PNG",
          (LABEL_W_MM - bcW) / 2,
          LABEL_H_MM - bcH - 1,
          bcW,
          bcH
        );
      } catch (e) {
        console.error("barcode draw error", e);
        pdf.setFontSize(8);
        pdf.text(`EAN: ${item.ean}`, 3, LABEL_H_MM - 4);
      }

      pageIdx++;
    }
  }
  return pdf.output("blob");
}
