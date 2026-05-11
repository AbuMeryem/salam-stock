/**
 * Rapport mensuel consolidé Drive + Magasin (Cashmag).
 */
import { supabase } from "@/lib/supabase";
import { decomposeTTC, estimateStripeFee, tvaRateForCategory } from "./tva";

export interface MonthlySection {
  ca_ttc: number;
  ca_ht: number;
  tva_totale: number;
  nb_tickets: number;
  panier_moyen: number;
  top_produits: Array<{ designation: string; quantite: number; ca: number }>;
}

export interface MonthlyReport {
  mois: string;
  date_debut: string;
  date_fin: string;
  generated_at: string;
  magasin: MonthlySection & { last_import_at: string | null; partial: boolean };
  drive: MonthlySection & { frais_stripe: number; net: number };
  consolidation: {
    ca_ttc_total: number;
    tva_par_taux: Record<string, { base_ht: number; tva: number; ttc: number }>;
    repartition: { magasin_pct: number; drive_pct: number };
    evolution_vs_mois_precedent: number | null;
  };
}

export async function computeMonthlyReport(moisYYYYMM: string): Promise<MonthlyReport> {
  if (!/^\d{4}-\d{2}$/.test(moisYYYYMM)) throw new Error("mois must be YYYY-MM");
  const [yr, mo] = moisYYYYMM.split("-").map(Number);
  const start = new Date(Date.UTC(yr, mo - 1, 1));
  const end = new Date(Date.UTC(yr, mo, 1));
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  const sb = supabase();
  const empty: MonthlySection = {
    ca_ttc: 0, ca_ht: 0, tva_totale: 0, nb_tickets: 0, panier_moyen: 0, top_produits: [],
  };

  if (!sb) {
    return {
      mois: moisYYYYMM, date_debut: startDate, date_fin: endDate,
      generated_at: new Date().toISOString(),
      magasin: { ...empty, last_import_at: null, partial: true },
      drive: { ...empty, frais_stripe: 0, net: 0 },
      consolidation: {
        ca_ttc_total: 0, tva_par_taux: {},
        repartition: { magasin_pct: 0, drive_pct: 0 },
        evolution_vs_mois_precedent: null,
      },
    };
  }

  // MAGASIN (Cashmag import) — la table peut ne pas exister si 0011 pas appliquée
  let cashmag: Array<{
    numero_ticket: string;
    designation: string;
    quantite: number | string;
    prix_ttc: number | string;
    prix_ht: number | string | null;
    tva_taux: number | string | null;
    imported_at: string;
    date_vente: string;
  }> = [];
  try {
    const { data } = await sb
      .from("ventes_cashmag_import")
      .select("*")
      .gte("date_vente", startDate)
      .lt("date_vente", endDate);
    cashmag = (data ?? []) as typeof cashmag;
  } catch {
    cashmag = [];
  }

  const ticketsMag = new Set<string>();
  const topProdMag = new Map<string, { quantite: number; ca: number }>();
  let magCaTtc = 0, magCaHt = 0, magTva = 0;
  for (const row of cashmag) {
    const qty = Number(row.quantite);
    const ttc = Number(row.prix_ttc) * qty;
    const ht = row.prix_ht !== null
      ? Number(row.prix_ht) * qty
      : row.tva_taux !== null
        ? decomposeTTC(ttc, Number(row.tva_taux) as 5.5).ht
        : ttc / 1.055;
    const tva = ttc - ht;
    magCaTtc += ttc; magCaHt += ht; magTva += tva;
    ticketsMag.add(row.numero_ticket);
    const tp = topProdMag.get(row.designation) ?? { quantite: 0, ca: 0 };
    tp.quantite += qty; tp.ca += ttc;
    topProdMag.set(row.designation, tp);
  }
  const magPM = ticketsMag.size > 0 ? magCaTtc / ticketsMag.size : 0;
  const lastImportAt = cashmag.reduce<string | null>(
    (l, r) => (!l || r.imported_at > l ? r.imported_at : l), null);
  const distinctDays = new Set(cashmag.map((r) => r.date_vente));
  const expectedDays = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
  const partial = lastImportAt === null || distinctDays.size < expectedDays * 0.5;

  // DRIVE
  const { data: cmdsDrive } = await sb
    .from("commandes_drive")
    .select("id, total_ttc, mode_paiement, created_at, commandes_drive_lignes(produit_id, quantite, prix_unitaire)")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .neq("statut", "annule");

  const drive = (cmdsDrive ?? []) as unknown as Array<{
    id: string;
    total_ttc: number | string;
    mode_paiement: string;
    created_at: string;
    commandes_drive_lignes: Array<{ produit_id: string; quantite: number | string; prix_unitaire: number | string }>;
  }>;

  const produitIds = Array.from(new Set(drive.flatMap((c) => c.commandes_drive_lignes.map((l) => l.produit_id))));
  const { data: produits } = produitIds.length
    ? await sb.from("produits").select("id, nom, categorie").in("id", produitIds)
    : { data: [] };
  const produitById = new Map(
    ((produits ?? []) as Array<{ id: string; nom: string; categorie: string | null }>).map((p) => [p.id, p])
  );

  let driveCaTtc = 0, driveCaHt = 0, driveTva = 0, driveFrais = 0;
  const topProdDrive = new Map<string, { quantite: number; ca: number }>();
  for (const c of drive) {
    const ttc = Number(c.total_ttc);
    driveCaTtc += ttc;
    if (c.mode_paiement === "stripe") driveFrais += estimateStripeFee(ttc);
    for (const l of c.commandes_drive_lignes) {
      const qty = Number(l.quantite);
      const totalLigne = Number(l.prix_unitaire) * qty;
      const p = produitById.get(l.produit_id);
      const rate = tvaRateForCategory(p?.categorie);
      const { ht, tva } = decomposeTTC(totalLigne, rate);
      driveCaHt += ht; driveTva += tva;
      const name = p?.nom ?? `Produit ${l.produit_id.slice(0, 8)}`;
      const tp = topProdDrive.get(name) ?? { quantite: 0, ca: 0 };
      tp.quantite += qty; tp.ca += totalLigne;
      topProdDrive.set(name, tp);
    }
  }
  const drivePM = drive.length > 0 ? driveCaTtc / drive.length : 0;

  // CONSOLIDATION TVA
  const caTotal = magCaTtc + driveCaTtc;
  const tvaParTaux: Record<string, { base_ht: number; tva: number; ttc: number }> = {};
  for (const c of drive) {
    for (const l of c.commandes_drive_lignes) {
      const p = produitById.get(l.produit_id);
      const rate = tvaRateForCategory(p?.categorie);
      const totalLigne = Number(l.prix_unitaire) * Number(l.quantite);
      const { ht, tva } = decomposeTTC(totalLigne, rate);
      const key = rate.toFixed(1);
      if (!tvaParTaux[key]) tvaParTaux[key] = { base_ht: 0, tva: 0, ttc: 0 };
      tvaParTaux[key].base_ht += ht;
      tvaParTaux[key].tva += tva;
      tvaParTaux[key].ttc += totalLigne;
    }
  }
  for (const row of cashmag) {
    const qty = Number(row.quantite);
    const ttc = Number(row.prix_ttc) * qty;
    const rate = row.tva_taux !== null ? Number(row.tva_taux) : 5.5;
    const ht = row.prix_ht !== null ? Number(row.prix_ht) * qty : decomposeTTC(ttc, rate as 5.5).ht;
    const tva = ttc - ht;
    const key = rate.toFixed(1);
    if (!tvaParTaux[key]) tvaParTaux[key] = { base_ht: 0, tva: 0, ttc: 0 };
    tvaParTaux[key].base_ht += ht;
    tvaParTaux[key].tva += tva;
    tvaParTaux[key].ttc += ttc;
  }

  // Évolution
  const prevMo = new Date(Date.UTC(yr, mo - 2, 1));
  const prevMoStart = prevMo.toISOString();
  const prevMoEnd = new Date(Date.UTC(yr, mo - 1, 1)).toISOString();
  let prevTotal = 0;
  try {
    const { data: prevDrive } = await sb.from("commandes_drive").select("total_ttc")
      .gte("created_at", prevMoStart).lt("created_at", prevMoEnd).neq("statut", "annule");
    if (prevDrive) {
      for (const c of prevDrive as Array<{ total_ttc: number | string }>) prevTotal += Number(c.total_ttc);
    }
    const { data: prevMag } = await sb.from("ventes_cashmag_import").select("prix_ttc, quantite")
      .gte("date_vente", prevMo.toISOString().slice(0, 10))
      .lt("date_vente", new Date(Date.UTC(yr, mo - 1, 1)).toISOString().slice(0, 10));
    if (prevMag) {
      for (const r of prevMag as Array<{ prix_ttc: number | string; quantite: number | string }>) {
        prevTotal += Number(r.prix_ttc) * Number(r.quantite);
      }
    }
  } catch { /* table optional */ }

  const evolution = prevTotal > 0 ? ((caTotal - prevTotal) / prevTotal) * 100 : null;

  return {
    mois: moisYYYYMM, date_debut: startDate, date_fin: endDate,
    generated_at: new Date().toISOString(),
    magasin: {
      ca_ttc: magCaTtc, ca_ht: magCaHt, tva_totale: magTva,
      nb_tickets: ticketsMag.size, panier_moyen: magPM,
      top_produits: Array.from(topProdMag.entries())
        .map(([designation, v]) => ({ designation, ...v }))
        .sort((a, b) => b.ca - a.ca).slice(0, 10),
      last_import_at: lastImportAt, partial,
    },
    drive: {
      ca_ttc: driveCaTtc, ca_ht: driveCaHt, tva_totale: driveTva,
      nb_tickets: drive.length, panier_moyen: drivePM,
      top_produits: Array.from(topProdDrive.entries())
        .map(([designation, v]) => ({ designation, ...v }))
        .sort((a, b) => b.ca - a.ca).slice(0, 10),
      frais_stripe: driveFrais, net: driveCaTtc - driveFrais,
    },
    consolidation: {
      ca_ttc_total: caTotal, tva_par_taux: tvaParTaux,
      repartition: {
        magasin_pct: caTotal > 0 ? (magCaTtc / caTotal) * 100 : 0,
        drive_pct: caTotal > 0 ? (driveCaTtc / caTotal) * 100 : 0,
      },
      evolution_vs_mois_precedent: evolution,
    },
  };
}

export function currentMonthYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function previousMonthYYYYMM(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
