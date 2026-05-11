/**
 * Récap fiscal journalier Salam Market Drive.
 *
 * Document NON-FISCAL au sens NF525 — Salam Drive n'est pas une caisse
 * certifiée et n'a pas à l'être (paiements 100% Stripe online).
 * Néanmoins, on génère un document qui mime le format Z d'une caisse
 * pour que le comptable retrouve ses repères dans son flux mensuel.
 */

import { supabase } from "@/lib/supabase";
import {
  decomposeTTC,
  estimateStripeFee,
  tvaRateForCategory,
  type TvaRate,
} from "./tva";

export interface DailyZLigne {
  numero_commande: string;
  client_nom: string | null;
  client_email: string | null;
  produit_id: string;
  produit_nom: string;
  produit_categorie: string | null;
  produit_ean: string | null;
  quantite: number;
  prix_unitaire_ttc: number;
  total_ligne_ttc: number;
  total_ligne_ht: number;
  total_ligne_tva: number;
  tva_taux: TvaRate;
  mode_paiement: string;
  created_at: string;
  reference_paiement: string | null;
}

export interface DailyZSummary {
  /** YYYY-MM-DD */
  date: string;
  generated_at: string;
  /** Statut humain : ok, no_data, error */
  status: "ok" | "no_data";
  nb_commandes: number;
  premiere_commande_at: string | null;
  derniere_commande_at: string | null;
  ca_ttc: number;
  ca_ht: number;
  tva_totale: number;
  /** Ventilation par taux de TVA. Clé = taux (5.5, 10, 20) → {base, tva} */
  tva_par_taux: Record<string, { base_ht: number; tva: number; ttc: number }>;
  frais_stripe: number;
  net_encaisse: number;
  panier_moyen: number;
  modes_paiement: Record<string, number>;
  lignes: DailyZLigne[];
}

/**
 * Calcule le récap fiscal journalier pour une date donnée.
 *
 * @param dateIso YYYY-MM-DD (Europe/Paris)
 */
export async function computeDailyZ(dateIso: string): Promise<DailyZSummary> {
  const sb = supabase();
  const startParis = `${dateIso}T00:00:00+02:00`;
  const endParis = `${dateIso}T23:59:59.999+02:00`;

  const generatedAt = new Date().toISOString();

  if (!sb) {
    // Mode local démo : retourne vide proprement.
    return {
      date: dateIso,
      generated_at: generatedAt,
      status: "no_data",
      nb_commandes: 0,
      premiere_commande_at: null,
      derniere_commande_at: null,
      ca_ttc: 0,
      ca_ht: 0,
      tva_totale: 0,
      tva_par_taux: {},
      frais_stripe: 0,
      net_encaisse: 0,
      panier_moyen: 0,
      modes_paiement: {},
      lignes: [],
    };
  }

  // Fetch commandes du jour, statut ≠ annule (= toutes les ventes
  // effectivement encaissées, qu'elles soient en cours de prep ou déjà
  // retirées).
  const { data: cmds, error } = await sb
    .from("commandes_drive")
    .select(
      "id, numero_commande, client_nom, client_email, total_ttc, " +
        "mode_paiement, statut, created_at, " +
        "commandes_drive_lignes(produit_id, quantite, prix_unitaire)"
    )
    .gte("created_at", startParis)
    .lte("created_at", endParis)
    .neq("statut", "annule")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const commandes = (cmds ?? []) as unknown as Array<{
    id: string;
    numero_commande: string;
    client_nom: string | null;
    client_email: string | null;
    total_ttc: number | string;
    mode_paiement: string;
    statut: string;
    created_at: string;
    commandes_drive_lignes: Array<{
      produit_id: string;
      quantite: number | string;
      prix_unitaire: number | string;
    }>;
  }>;

  if (commandes.length === 0) {
    return {
      date: dateIso,
      generated_at: generatedAt,
      status: "no_data",
      nb_commandes: 0,
      premiere_commande_at: null,
      derniere_commande_at: null,
      ca_ttc: 0,
      ca_ht: 0,
      tva_totale: 0,
      tva_par_taux: {},
      frais_stripe: 0,
      net_encaisse: 0,
      panier_moyen: 0,
      modes_paiement: {},
      lignes: [],
    };
  }

  // Récupère le détail des produits pour avoir catégorie + ean + nom
  const produitIds = Array.from(
    new Set(commandes.flatMap((c) => c.commandes_drive_lignes.map((l) => l.produit_id)))
  );
  const { data: produits } = await sb
    .from("produits")
    .select("id, nom, ean, categorie")
    .in("id", produitIds);

  const produitById = new Map<
    string,
    { nom: string; ean: string | null; categorie: string | null }
  >();
  for (const p of (produits ?? []) as Array<{
    id: string;
    nom: string;
    ean: string | null;
    categorie: string | null;
  }>) {
    produitById.set(p.id, { nom: p.nom, ean: p.ean, categorie: p.categorie });
  }

  const lignes: DailyZLigne[] = [];
  const tvaParTaux: Record<string, { base_ht: number; tva: number; ttc: number }> = {};
  const modes: Record<string, number> = {};
  let caTtc = 0;

  for (const c of commandes) {
    modes[c.mode_paiement] = (modes[c.mode_paiement] ?? 0) + Number(c.total_ttc);
    caTtc += Number(c.total_ttc);

    for (const l of c.commandes_drive_lignes) {
      const p = produitById.get(l.produit_id);
      const qty = Number(l.quantite);
      const prixUnit = Number(l.prix_unitaire);
      const totalLigne = prixUnit * qty;
      const rate = tvaRateForCategory(p?.categorie);
      const { ht, tva } = decomposeTTC(totalLigne, rate);

      const key = rate.toFixed(1);
      if (!tvaParTaux[key]) tvaParTaux[key] = { base_ht: 0, tva: 0, ttc: 0 };
      tvaParTaux[key].base_ht += ht;
      tvaParTaux[key].tva += tva;
      tvaParTaux[key].ttc += totalLigne;

      lignes.push({
        numero_commande: c.numero_commande,
        client_nom: c.client_nom,
        client_email: c.client_email,
        produit_id: l.produit_id,
        produit_nom: p?.nom ?? `Produit ${l.produit_id.slice(0, 8)}`,
        produit_categorie: p?.categorie ?? null,
        produit_ean: p?.ean ?? null,
        quantite: qty,
        prix_unitaire_ttc: prixUnit,
        total_ligne_ttc: totalLigne,
        total_ligne_ht: ht,
        total_ligne_tva: tva,
        tva_taux: rate,
        mode_paiement: c.mode_paiement,
        created_at: c.created_at,
        reference_paiement: null,
      });
    }
  }

  const caHt = Object.values(tvaParTaux).reduce((s, v) => s + v.base_ht, 0);
  const tvaTotale = Object.values(tvaParTaux).reduce((s, v) => s + v.tva, 0);
  const fraisStripe = commandes
    .filter((c) => c.mode_paiement === "stripe")
    .reduce((s, c) => s + estimateStripeFee(Number(c.total_ttc)), 0);
  const netEncaisse = caTtc - fraisStripe;
  const panierMoyen = caTtc / commandes.length;

  return {
    date: dateIso,
    generated_at: generatedAt,
    status: "ok",
    nb_commandes: commandes.length,
    premiere_commande_at: commandes[0]?.created_at ?? null,
    derniere_commande_at: commandes[commandes.length - 1]?.created_at ?? null,
    ca_ttc: caTtc,
    ca_ht: caHt,
    tva_totale: tvaTotale,
    tva_par_taux: tvaParTaux,
    frais_stripe: fraisStripe,
    net_encaisse: netEncaisse,
    panier_moyen: panierMoyen,
    modes_paiement: modes,
    lignes,
  };
}

/** Date YYYY-MM-DD pour "hier" en heure de Paris */
export function yesterdayIsoParis(): string {
  const now = new Date();
  const paris = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  paris.setDate(paris.getDate() - 1);
  return paris.toISOString().slice(0, 10);
}

export function todayIsoParis(): string {
  const now = new Date();
  const paris = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  return paris.toISOString().slice(0, 10);
}
