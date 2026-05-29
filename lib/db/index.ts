"use client";

/**
 * Unified data layer.
 * - In production, talks to Supabase via @supabase/supabase-js
 * - In dev/demo (no env vars), uses the local seed in seed-local.ts
 *
 * Exposes one function per domain query, all returning Promises so the
 * caller code reads identically regardless of backend.
 */

import { hasSupabase, supabase } from "@/lib/supabase";
import {
  SEED_DEPOTS,
  SEED_EMPLOYES,
  SEED_PRODUITS,
  SEED_STOCK,
} from "./seed-local";
import type {
  Depot,
  Employe,
  Produit,
  ProduitInDepot,
  CodeBarreCarton,
  Reception,
  ReceptionLigne,
  SortieStock,
  TransfertInterDepot,
  InventaireTournant,
  CommandeDrive,
  CommandeDriveLigne,
  ProduitUnitType,
  SortieType,
  ReceptionStatus,
} from "@/lib/types/db";

/* ────────────────── Depots ────────────────── */

export async function listDepots(): Promise<Depot[]> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("depots")
      .select("*")
      .eq("is_active", true)
      .order("nom");
    if (error) throw error;
    return data as Depot[];
  }
  return SEED_DEPOTS.filter((d) => d.is_active);
}

/* ────────────────── Employés ────────────────── */

export async function listEmployes(depotId?: string): Promise<Employe[]> {
  const sb = supabase();
  if (sb) {
    let q = sb.from("employes").select("*").eq("is_active", true);
    if (depotId) q = q.eq("depot_principal_id", depotId);
    const { data, error } = await q.order("nom");
    if (error) throw error;
    return data as Employe[];
  }
  return SEED_EMPLOYES.filter(
    (e) => e.is_active && (!depotId || e.depot_principal_id === depotId)
  );
}

export async function loginByPin(pin: string): Promise<Employe | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("employes")
      .select("*")
      .eq("pin_code", pin)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return (data as Employe) ?? null;
  }
  return SEED_EMPLOYES.find((e) => e.pin_code === pin && e.is_active) ?? null;
}

/* ────────────────── Produits & Stock par dépôt ────────────────── */

export async function listProduitsInDepot(
  depotId: string
): Promise<ProduitInDepot[]> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("stock_par_depot")
      .select(
        "id, depot_id, quantite, prix_vente, is_visible, produit:produits(*)"
      )
      .eq("depot_id", depotId)
      .eq("is_visible", true);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const produit = r.produit as Produit;
      return {
        ...produit,
        stock_id: r.id as string,
        depot_id: r.depot_id as string,
        quantite: r.quantite as number,
        prix_vente: r.prix_vente as number | null,
        is_visible: r.is_visible as boolean,
      };
    });
  }
  // local fallback: join SEED_PRODUITS with SEED_STOCK
  const stock = SEED_STOCK.filter((s) => s.depot_id === depotId && s.is_visible);
  return stock
    .map((s) => {
      const p = SEED_PRODUITS.find((x) => x.id === s.produit_id);
      if (!p) return null;
      return {
        ...p,
        stock_id: s.id,
        depot_id: s.depot_id,
        quantite: s.quantite,
        prix_vente: s.prix_vente,
        is_visible: s.is_visible,
      } as ProduitInDepot;
    })
    .filter((x): x is ProduitInDepot => x !== null);
}

export async function findProduitByEan(ean: string): Promise<Produit | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("produits")
      .select("*")
      .eq("ean", ean)
      .maybeSingle();
    if (error) throw error;
    return (data as Produit) ?? null;
  }
  return SEED_PRODUITS.find((p) => p.ean === ean) ?? null;
}

export async function searchProduits(query: string): Promise<Produit[]> {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("produits")
      .select("*")
      .or(`nom.ilike.%${q}%,marque.ilike.%${q}%,ean.ilike.%${q}%`)
      .limit(20);
    if (error) throw error;
    return data as Produit[];
  }
  return SEED_PRODUITS.filter(
    (p) =>
      p.nom.toLowerCase().includes(q) ||
      (p.marque?.toLowerCase().includes(q) ?? false) ||
      (p.ean?.includes(q) ?? false)
  ).slice(0, 20);
}

/* ────────────────── Création produit (depuis IA ou form) ────────────────── */

export async function createProduit(input: {
  ean?: string | null;
  nom: string;
  marque?: string | null;
  categorie?: string | null;
  sous_categorie?: string | null;
  description?: string | null;
  requires_barcode_print?: boolean;
}): Promise<Produit> {
  const sb = supabase();
  const row = {
    ean: input.ean ?? null,
    nom: input.nom,
    marque: input.marque ?? null,
    categorie: input.categorie ?? null,
    sous_categorie: input.sous_categorie ?? null,
    image_url: null,
    description: input.description ?? null,
    requires_barcode_print: input.requires_barcode_print ?? false,
    est_traiteur: false,
  };
  if (sb) {
    const { data, error } = await sb
      .from("produits")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Produit;
  }
  // local
  const local: Produit = {
    id: "prd-local-" + Date.now(),
    ...row,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return local;
}

/* ────────────────── Carton EANs ────────────────── */

const localCartons: CodeBarreCarton[] = [];

export async function findCarton(ean: string): Promise<CodeBarreCarton | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("codes_barres_cartons")
      .select("*")
      .eq("ean_carton", ean)
      .maybeSingle();
    if (error) throw error;
    return (data as CodeBarreCarton) ?? null;
  }
  return localCartons.find((c) => c.ean_carton === ean) ?? null;
}

export async function learnCarton(input: {
  ean_carton: string;
  produit_id: string;
  quantite_par_carton: number;
  fournisseur?: string;
  learned_by?: string;
}): Promise<CodeBarreCarton> {
  const sb = supabase();
  const row: CodeBarreCarton = {
    id: "cart-" + Date.now(),
    ean_carton: input.ean_carton,
    produit_id: input.produit_id,
    quantite_par_carton: input.quantite_par_carton,
    fournisseur: input.fournisseur ?? null,
    created_at: new Date().toISOString(),
    learned_by: input.learned_by ?? null,
  };
  if (sb) {
    const { id: _localId, ...payload } = row;
    void _localId;
    const { data, error } = await sb
      .from("codes_barres_cartons")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CodeBarreCarton;
  }
  localCartons.push(row);
  return row;
}

/* ────────────────── Réceptions ────────────────── */

const localReceptions: Reception[] = [];
const localReceptionLignes: ReceptionLigne[] = [];

export async function createReception(input: {
  depot_id: string;
  employe_id: string;
  fournisseur?: string;
  numero_bl?: string;
  photo_url: string;
}): Promise<Reception> {
  const sb = supabase();
  const row: Reception = {
    id: "rec-" + Date.now(),
    depot_id: input.depot_id,
    employe_id: input.employe_id,
    fournisseur: input.fournisseur ?? null,
    numero_bl: input.numero_bl ?? null,
    photo_url: input.photo_url,
    statut: "en_cours",
    reception_vide: false,
    created_at: new Date().toISOString(),
  };
  if (sb) {
    const { id: _localId, ...payload } = row;
    void _localId;
    const { data, error } = await sb
      .from("receptions")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Reception;
  }
  localReceptions.push(row);
  return row;
}

export async function addReceptionLigne(input: {
  reception_id: string;
  produit_id: string;
  code_scanne: string;
  quantite_calculee: number;
}): Promise<ReceptionLigne> {
  const sb = supabase();
  const row: ReceptionLigne = {
    id: "rl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    reception_id: input.reception_id,
    produit_id: input.produit_id,
    code_scanne: input.code_scanne,
    quantite_scannee: 1,
    quantite_calculee: input.quantite_calculee,
  };
  if (sb) {
    const { id: _localId, ...payload } = row;
    void _localId;
    const { data, error } = await sb
      .from("receptions_lignes")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ReceptionLigne;
  }
  localReceptionLignes.push(row);
  return row;
}

export async function validateReception(
  receptionId: string,
  opts?: { vide?: boolean }
): Promise<void> {
  const vide = opts?.vide === true;
  const sb = supabase();
  if (sb) {
    // Compute aggregated additions per produit then bump stock_par_depot.
    const { data: lignes, error: e1 } = await sb
      .from("receptions_lignes")
      .select("produit_id, quantite_calculee")
      .eq("reception_id", receptionId);
    if (e1) throw new Error(e1.message);
    const { data: rec, error: e2 } = await sb
      .from("receptions")
      .select("depot_id")
      .eq("id", receptionId)
      .single();
    if (e2) throw e2;
    const depotId = (rec as { depot_id: string }).depot_id;

    const totals = new Map<string, number>();
    for (const l of (lignes ?? []) as Array<{
      produit_id: string;
      quantite_calculee: number;
    }>) {
      totals.set(l.produit_id, (totals.get(l.produit_id) ?? 0) + l.quantite_calculee);
    }
    for (const [produitId, qty] of totals) {
      // upsert stock row
      const { data: existing } = await sb
        .from("stock_par_depot")
        .select("id, quantite")
        .eq("produit_id", produitId)
        .eq("depot_id", depotId)
        .maybeSingle();
      if (existing) {
        await sb
          .from("stock_par_depot")
          .update({
            quantite:
              (existing as { quantite: number }).quantite + qty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (existing as { id: string }).id);
      } else {
        await sb.from("stock_par_depot").insert({
          produit_id: produitId,
          depot_id: depotId,
          quantite: qty,
          is_visible: true,
        });
      }
    }
    await sb
      .from("receptions")
      .update({ statut: "validee" as ReceptionStatus, reception_vide: vide })
      .eq("id", receptionId);
    return;
  }
  // Local fallback: bump SEED_STOCK in-memory.
  const rec = localReceptions.find((r) => r.id === receptionId);
  if (!rec) return;
  const lignes = localReceptionLignes.filter((l) => l.reception_id === receptionId);
  for (const l of lignes) {
    const stock = SEED_STOCK.find(
      (s) => s.produit_id === l.produit_id && s.depot_id === rec.depot_id
    );
    if (stock) {
      stock.quantite += l.quantite_calculee;
    } else {
      SEED_STOCK.push({
        id: "stock-" + Date.now(),
        produit_id: l.produit_id,
        depot_id: rec.depot_id,
        quantite: l.quantite_calculee,
        prix_vente: null,
        is_visible: true,
        updated_at: new Date().toISOString(),
      });
    }
  }
  rec.statut = "validee";
  rec.reception_vide = vide;
}

export async function listReceptions(opts?: {
  depotId?: string;
  limit?: number;
}): Promise<Reception[]> {
  const sb = supabase();
  const limit = opts?.limit ?? 50;
  if (sb) {
    let q = sb
      .from("receptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts?.depotId) q = q.eq("depot_id", opts.depotId);
    const { data, error } = await q;
    if (error) throw error;
    return data as Reception[];
  }
  let list = [...localReceptions];
  if (opts?.depotId) list = list.filter((r) => r.depot_id === opts.depotId);
  return list
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/* ────────────────── Sorties ────────────────── */

const localSorties: SortieStock[] = [];

export async function createSortie(input: {
  depot_id: string;
  employe_id: string;
  produit_id: string;
  type: SortieType;
  motif_libre?: string;
  quantite: number;
  photo_url: string;
  ia_coherence_score?: number | null;
  ia_coherence_notes?: string | null;
}): Promise<SortieStock> {
  const sb = supabase();
  const row: SortieStock = {
    id: "sor-" + Date.now(),
    depot_id: input.depot_id,
    employe_id: input.employe_id,
    produit_id: input.produit_id,
    type: input.type,
    motif_libre: input.motif_libre ?? null,
    quantite: input.quantite,
    photo_url: input.photo_url,
    ia_coherence_score: input.ia_coherence_score ?? null,
    ia_coherence_notes: input.ia_coherence_notes ?? null,
    created_at: new Date().toISOString(),
  };
  if (sb) {
    const { id: _localId, ...payload } = row;
    void _localId;
    const { data, error } = await sb
      .from("sorties_stock")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Decrement stock atomically — RPC would be safer; for the demo we read+update.
    const { data: stock } = await sb
      .from("stock_par_depot")
      .select("id, quantite")
      .eq("produit_id", input.produit_id)
      .eq("depot_id", input.depot_id)
      .maybeSingle();
    if (stock) {
      await sb
        .from("stock_par_depot")
        .update({
          quantite: Math.max(
            0,
            (stock as { quantite: number }).quantite - input.quantite
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", (stock as { id: string }).id);
    }
    return data as SortieStock;
  }
  localSorties.push(row);
  const stock = SEED_STOCK.find(
    (s) => s.produit_id === input.produit_id && s.depot_id === input.depot_id
  );
  if (stock) stock.quantite = Math.max(0, stock.quantite - input.quantite);
  return row;
}

export async function listSorties(opts?: {
  depotId?: string;
  limit?: number;
}): Promise<SortieStock[]> {
  const sb = supabase();
  const limit = opts?.limit ?? 50;
  if (sb) {
    let q = sb
      .from("sorties_stock")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts?.depotId) q = q.eq("depot_id", opts.depotId);
    const { data, error } = await q;
    if (error) throw error;
    return data as SortieStock[];
  }
  let list = [...localSorties];
  if (opts?.depotId) list = list.filter((r) => r.depot_id === opts.depotId);
  return list
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/* ────────────────── Transferts inter-dépôts ────────────────── */

const localTransferts: TransfertInterDepot[] = [];

export async function createTransfert(input: {
  depot_source_id: string;
  depot_destination_id: string;
  produit_id: string;
  quantite: number;
  employe_id: string;
  photo_url?: string;
}): Promise<TransfertInterDepot> {
  if (input.depot_source_id === input.depot_destination_id) {
    throw new Error("Source et destination doivent être différentes.");
  }
  const sb = supabase();
  const row: TransfertInterDepot = {
    id: "trf-" + Date.now(),
    depot_source_id: input.depot_source_id,
    depot_destination_id: input.depot_destination_id,
    produit_id: input.produit_id,
    quantite: input.quantite,
    employe_id: input.employe_id,
    photo_url: input.photo_url ?? null,
    created_at: new Date().toISOString(),
  };
  if (sb) {
    // On omet `id` + `created_at` (générés DB). Mauvaise pratique de
    // passer un id "trf-…" string non-UUID à une colonne uuid → Supabase
    // 22P02 invalid input syntax for type uuid. Idem created_at géré
    // par default now() côté DB.
    const { id: _localId, created_at: _createdAt, ...payload } = row;
    void _localId;
    void _createdAt;
    console.log("[createTransfert] INSERT payload:", payload);
    const { data, error } = await sb
      .from("transferts_inter_depots")
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error("[createTransfert] INSERT error:", error);
      throw new Error(
        `Transfert refusé par la base : ${error.message}${
          error.details ? ` (${error.details})` : ""
        }`
      );
    }
    console.log("[createTransfert] INSERT OK:", data);
    // Side-effects stock : NON BLOQUANTS. Si l'ajustement plante, le
    // transfert est déjà enregistré côté DB — l'utilisateur ne perd pas
    // sa saisie. On loggue pour audit + cron qui recalculera le stock.
    try {
      await adjustStock(
        input.produit_id,
        input.depot_source_id,
        -input.quantite
      );
      await adjustStock(
        input.produit_id,
        input.depot_destination_id,
        input.quantite
      );
    } catch (sideErr) {
      console.error("[createTransfert] adjustStock failed:", sideErr);
    }
    return data as TransfertInterDepot;
  }
  localTransferts.push(row);
  const sStock = SEED_STOCK.find(
    (s) => s.produit_id === input.produit_id && s.depot_id === input.depot_source_id
  );
  if (sStock) sStock.quantite = Math.max(0, sStock.quantite - input.quantite);
  let dStock = SEED_STOCK.find(
    (s) =>
      s.produit_id === input.produit_id &&
      s.depot_id === input.depot_destination_id
  );
  if (!dStock) {
    dStock = {
      id: "stock-" + Date.now(),
      produit_id: input.produit_id,
      depot_id: input.depot_destination_id,
      quantite: 0,
      prix_vente: sStock?.prix_vente ?? null,
      is_visible: true,
      updated_at: new Date().toISOString(),
    };
    SEED_STOCK.push(dStock);
  }
  dStock.quantite += input.quantite;
  return row;
}

async function adjustStock(produitId: string, depotId: string, delta: number) {
  const sb = supabase();
  if (!sb) return;
  const { data: stock } = await sb
    .from("stock_par_depot")
    .select("id, quantite")
    .eq("produit_id", produitId)
    .eq("depot_id", depotId)
    .maybeSingle();
  if (stock) {
    await sb
      .from("stock_par_depot")
      .update({
        quantite: Math.max(
          0,
          (stock as { quantite: number }).quantite + delta
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (stock as { id: string }).id);
  } else if (delta > 0) {
    await sb.from("stock_par_depot").insert({
      produit_id: produitId,
      depot_id: depotId,
      quantite: delta,
      is_visible: true,
    });
  }
}

export async function listTransferts(opts?: {
  limit?: number;
  depotId?: string;
}): Promise<TransfertInterDepot[]> {
  const sb = supabase();
  const limit = opts?.limit ?? 50;
  if (sb) {
    let q = sb
      .from("transferts_inter_depots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts?.depotId) {
      q = q.or(
        `depot_source_id.eq.${opts.depotId},depot_destination_id.eq.${opts.depotId}`
      );
    }
    const { data, error } = await q;
    if (error) throw error;
    return data as TransfertInterDepot[];
  }
  let list = [...localTransferts];
  if (opts?.depotId)
    list = list.filter(
      (t) =>
        t.depot_source_id === opts.depotId ||
        t.depot_destination_id === opts.depotId
    );
  return list
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/* ────────────────── Inventaires tournants ────────────────── */

const localInventaires: InventaireTournant[] = [];

export async function listInventairesDuJour(opts?: {
  depotId?: string;
  employeId?: string;
}): Promise<InventaireTournant[]> {
  const today = new Date().toISOString().slice(0, 10);
  const sb = supabase();
  if (sb) {
    let q = sb
      .from("inventaires_tournants")
      .select("*")
      .eq("date_assignation", today);
    if (opts?.depotId) q = q.eq("depot_id", opts.depotId);
    if (opts?.employeId) q = q.eq("employe_assigne_id", opts.employeId);
    const { data, error } = await q;
    if (error) throw error;
    return data as InventaireTournant[];
  }
  return localInventaires.filter(
    (i) =>
      i.date_assignation === today &&
      (!opts?.depotId || i.depot_id === opts.depotId) &&
      (!opts?.employeId || i.employe_assigne_id === opts.employeId)
  );
}

export async function assignInventairesPourDepot(
  depotId: string,
  count = 5
): Promise<InventaireTournant[]> {
  const today = new Date().toISOString().slice(0, 10);
  const employes = await listEmployes(depotId);
  if (employes.length === 0) return [];
  const stock = await listProduitsInDepot(depotId);
  if (stock.length === 0) return [];
  const sample = [...stock].sort(() => Math.random() - 0.5).slice(0, count);
  const created: InventaireTournant[] = [];
  for (let i = 0; i < sample.length; i++) {
    const p = sample[i];
    const employe = employes[i % employes.length];
    const row: InventaireTournant = {
      id: "inv-" + Date.now() + "-" + i,
      depot_id: depotId,
      produit_id: p.id,
      employe_assigne_id: employe.id,
      date_assignation: today,
      quantite_attendue: p.quantite,
      quantite_comptee: null,
      ecart: 0,
      statut: "assigne",
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    const sb = supabase();
    if (sb) {
      const { id: _localId, ...payload } = row;
      void _localId;
      const { data, error } = await sb
        .from("inventaires_tournants")
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      created.push(data as InventaireTournant);
    } else {
      localInventaires.push(row);
      created.push(row);
    }
  }
  return created;
}

export async function listInventairesHistorique(opts?: {
  depotId?: string;
  limit?: number;
}): Promise<InventaireTournant[]> {
  const limit = opts?.limit ?? 60;
  const sb = supabase();
  if (sb) {
    let q = sb
      .from("inventaires_tournants")
      .select("*")
      .order("date_assignation", { ascending: false })
      .limit(limit);
    if (opts?.depotId) q = q.eq("depot_id", opts.depotId);
    const { data, error } = await q;
    if (error) throw error;
    return data as InventaireTournant[];
  }
  return localInventaires
    .filter((i) => !opts?.depotId || i.depot_id === opts.depotId)
    .sort((a, b) => b.date_assignation.localeCompare(a.date_assignation))
    .slice(0, limit);
}

export async function completeInventaire(
  inventaireId: string,
  quantiteComptee: number
): Promise<InventaireTournant | null> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("inventaires_tournants")
      .update({
        quantite_comptee: quantiteComptee,
        statut: "compte",
        completed_at: new Date().toISOString(),
      })
      .eq("id", inventaireId)
      .select()
      .single();
    if (error) throw error;
    return data as InventaireTournant;
  }
  const row = localInventaires.find((i) => i.id === inventaireId);
  if (!row) return null;
  row.quantite_comptee = quantiteComptee;
  row.ecart = quantiteComptee - (row.quantite_attendue ?? 0);
  row.statut = "compte";
  row.completed_at = new Date().toISOString();
  return row;
}

/* ────────────────── Drive ────────────────── */

const SEED_COMMANDES: CommandeDrive[] = [
  {
    id: "cmd-001",
    numero_commande: "DRV-2026-0142",
    client_nom: "Yasmine Belkadi",
    client_telephone: "+33 6 12 34 56 78",
    client_email: null,
    creneau_retrait: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    statut: "en_preparation",
    total_ttc: 78.4,
    mode_paiement: "stripe",
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "cmd-002",
    numero_commande: "DRV-2026-0143",
    client_nom: "Karim Boumediene",
    client_telephone: "+33 6 87 65 43 21",
    client_email: null,
    creneau_retrait: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    statut: "en_preparation",
    total_ttc: 42.5,
    mode_paiement: "en_magasin",
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

const SEED_COMMANDE_LIGNES: CommandeDriveLigne[] = [
  // cmd-001 — Yasmine — démo multi-zones (Particulier + Pro + Traiteur)
  {
    id: "cl-001",
    commande_id: "cmd-001",
    produit_id: "prd-p-013",
    depot_id: "depot-particulier",
    zone_preparation: "particulier",
    quantite: 1,
    prix_unitaire: 8.4,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
  {
    id: "cl-002",
    commande_id: "cmd-001",
    produit_id: "prd-p-001",
    depot_id: "depot-particulier",
    zone_preparation: "particulier",
    quantite: 2,
    prix_unitaire: 6.9,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
  {
    id: "cl-003",
    commande_id: "cmd-001",
    produit_id: "prd-p-035",
    depot_id: "depot-professionnel",
    zone_preparation: "professionnel",
    quantite: 1,
    prix_unitaire: 10.5,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
  {
    id: "cl-004",
    commande_id: "cmd-001",
    produit_id: "prd-traiteur-pastilla",
    depot_id: "depot-particulier",
    zone_preparation: "traiteur",
    quantite: 1,
    prix_unitaire: 18.5,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
  {
    id: "cl-007",
    commande_id: "cmd-001",
    produit_id: "prd-traiteur-couscous",
    depot_id: "depot-particulier",
    zone_preparation: "traiteur",
    quantite: 1,
    prix_unitaire: 39.9,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
  // cmd-002 — Karim — Particulier + Pro (pas de traiteur)
  {
    id: "cl-005",
    commande_id: "cmd-002",
    produit_id: "prd-p-005",
    depot_id: "depot-particulier",
    zone_preparation: "particulier",
    quantite: 1,
    prix_unitaire: 11.5,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
  {
    id: "cl-006",
    commande_id: "cmd-002",
    produit_id: "prd-p-024",
    depot_id: "depot-professionnel",
    zone_preparation: "professionnel",
    quantite: 6,
    prix_unitaire: 1.8,
    statut_preparation: "en_attente",
    prepare_par_employe_id: null,
    prepare_at: null,
  },
];

export async function listCommandesDrive(
  statut?: CommandeDrive["statut"]
): Promise<CommandeDrive[]> {
  const sb = supabase();
  if (sb) {
    let q = sb
      .from("commandes_drive")
      .select("*")
      .order("creneau_retrait");
    if (statut) q = q.eq("statut", statut);
    const { data, error } = await q;
    if (error) throw error;
    return data as CommandeDrive[];
  }
  let list = [...SEED_COMMANDES];
  if (statut) list = list.filter((c) => c.statut === statut);
  return list;
}

export async function listLignesPourCommande(
  commandeId: string
): Promise<CommandeDriveLigne[]> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("commandes_drive_lignes")
      .select("*")
      .eq("commande_id", commandeId);
    if (error) throw error;
    return data as CommandeDriveLigne[];
  }
  return SEED_COMMANDE_LIGNES.filter((l) => l.commande_id === commandeId);
}

/**
 * Variante qui ramène en plus `unit_type` du produit (via embedded
 * select PostgREST sur la FK produit_id → produits). Sert au Kanban
 * pour compter les lignes à peser sans charger tout le catalogue.
 *
 * Retour : { ligne } + champ `produit_unit_type` aplati.
 */
export type CommandeDriveLigneWithUnitType = CommandeDriveLigne & {
  produit_unit_type?: ProduitUnitType | null;
  produit_nom?: string | null;
  produit_categorie?: string | null;
};

export async function listLignesPourCommandeAvecUnitType(
  commandeId: string,
): Promise<CommandeDriveLigneWithUnitType[]> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb
      .from("commandes_drive_lignes")
      .select("*, produits(unit_type, nom, categorie)")
      .eq("commande_id", commandeId);
    if (error) throw error;
    type Row = CommandeDriveLigne & {
      produits?: { unit_type?: ProduitUnitType | null; nom?: string | null; categorie?: string | null } | null;
    };
    return ((data ?? []) as Row[]).map((r) => ({
      ...r,
      produit_unit_type: r.produits?.unit_type ?? null,
      produit_nom: r.produits?.nom ?? null,
      produit_categorie: r.produits?.categorie ?? null,
    }));
  }
  // Mode local seed : pas de jointure, on devine via SEED_PRODUITS
  return SEED_COMMANDE_LIGNES.filter((l) => l.commande_id === commandeId).map(
    (l) => {
      const p = SEED_PRODUITS.find((x) => x.id === l.produit_id);
      return { ...l, produit_unit_type: null, produit_nom: p?.nom ?? null, produit_categorie: p?.categorie ?? null };
    },
  );
}

/**
 * CA par jour (Particulier vs Pro) sur les N derniers jours.
 * Particulier = lignes drive zone 'particulier' OU 'traiteur'.
 * Pro         = lignes drive zone 'professionnel'.
 * Synthétise des points pour les jours sans données pour avoir une
 * courbe continue (à zéro), ce qui rend les charts lisibles.
 */
export async function listRevenueByDay(opts?: {
  days?: number;
}): Promise<Array<{ date: string; particulier: number; pro: number }>> {
  const days = opts?.days ?? 90;
  const today = new Date();
  const start = new Date(today.getTime() - (days - 1) * 86400_000);
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const sb = supabase();
  const buckets = new Map<string, { particulier: number; pro: number }>();

  // Pré-remplir les buckets pour avoir une courbe continue
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { particulier: 0, pro: 0 });
  }

  if (sb) {
    // Fetch commandes_drive + lignes en parallèle pour la fenêtre
    const { data: cmds, error } = await sb
      .from("commandes_drive")
      .select(
        "id, created_at, statut, total_ttc, " +
          "commandes_drive_lignes(zone_preparation, quantite, prix_unitaire)"
      )
      .gte("created_at", startIso)
      .neq("statut", "annule");
    if (error) throw new Error(error.message);

    for (const c of (cmds ?? []) as unknown as Array<{
      created_at: string;
      commandes_drive_lignes: Array<{
        zone_preparation: string;
        quantite: number;
        prix_unitaire: number;
      }>;
    }>) {
      const key = c.created_at.slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      for (const l of c.commandes_drive_lignes ?? []) {
        const total = Number(l.prix_unitaire) * Number(l.quantite);
        if (l.zone_preparation === "professionnel") {
          b.pro += total;
        } else {
          // particulier + traiteur regroupés (le client final)
          b.particulier += total;
        }
      }
    }
  } else {
    // Mode démo local : génère une courbe plausible déterministe pour
    // que le chart soit beau sans données réelles.
    let seed = 7919;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed % 10_000) / 10_000;
    };
    let prevP = 320;
    let prevPro = 180;
    Array.from(buckets.entries()).forEach(([key, b], idx) => {
      // Walk + weekend boost
      const dayOfWeek = new Date(key + "T00:00:00").getDay();
      const weekendBoost = dayOfWeek === 6 || dayOfWeek === 0 ? 1.25 : 1;
      prevP = Math.max(
        80,
        prevP + (rand() - 0.4) * 90 + Math.sin(idx / 3) * 30
      );
      prevPro = Math.max(
        40,
        prevPro + (rand() - 0.5) * 55 + Math.cos(idx / 4) * 20
      );
      b.particulier = Math.round(prevP * weekendBoost);
      b.pro = Math.round(prevPro * weekendBoost);
    });
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    particulier: b.particulier,
    pro: b.pro,
  }));
}

/**
 * CA drive total par jour sur les N derniers jours (commandes_drive
 * sum total_ttc par date). Exclut les commandes annulées.
 * Génère une courbe synthétique en mode local pour que le chart soit
 * lisible sans données réelles.
 */
export async function listDriveRevenueByDay(opts?: {
  days?: number;
}): Promise<Array<{ date: string; ca: number; commandes: number }>> {
  const days = opts?.days ?? 90;
  const today = new Date();
  const start = new Date(today.getTime() - (days - 1) * 86400_000);
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const sb = supabase();
  const buckets = new Map<string, { ca: number; commandes: number }>();

  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400_000);
    buckets.set(d.toISOString().slice(0, 10), { ca: 0, commandes: 0 });
  }

  if (sb) {
    const { data: cmds, error } = await sb
      .from("commandes_drive")
      .select("created_at, statut, total_ttc")
      .gte("created_at", startIso)
      .neq("statut", "annule");
    if (error) throw new Error(error.message);

    for (const c of (cmds ?? []) as Array<{
      created_at: string;
      total_ttc: number | string;
    }>) {
      const key = c.created_at.slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.ca += Number(c.total_ttc);
      b.commandes += 1;
    }
  } else {
    // Synthétique : random walk + boost weekend
    let seed = 4231;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed % 10_000) / 10_000;
    };
    let prev = 240;
    Array.from(buckets.entries()).forEach(([key, b], idx) => {
      const dayOfWeek = new Date(key + "T00:00:00").getDay();
      const weekendBoost = dayOfWeek === 6 || dayOfWeek === 0 ? 1.35 : 1;
      prev = Math.max(
        60,
        prev + (rand() - 0.42) * 110 + Math.sin(idx / 2.5) * 40
      );
      b.ca = Math.round(prev * weekendBoost);
      b.commandes = Math.max(1, Math.round(prev / 25 * weekendBoost));
    });
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    ca: b.ca,
    commandes: b.commandes,
  }));
}

export async function updateLignePreparation(
  ligneId: string,
  patch: Partial<
    Pick<
      CommandeDriveLigne,
      "statut_preparation" | "prepare_par_employe_id" | "prepare_at"
    >
  >
): Promise<void> {
  const sb = supabase();
  if (sb) {
    await sb.from("commandes_drive_lignes").update(patch).eq("id", ligneId);
    return;
  }
  const row = SEED_COMMANDE_LIGNES.find((l) => l.id === ligneId);
  if (row) Object.assign(row, patch);
}

export async function setCommandeStatut(
  commandeId: string,
  statut: CommandeDrive["statut"]
): Promise<void> {
  const sb = supabase();
  if (sb) {
    await sb.from("commandes_drive").update({ statut }).eq("id", commandeId);
    return;
  }
  const row = SEED_COMMANDES.find((c) => c.id === commandeId);
  if (row) row.statut = statut;
}

/* ────────────────── Mode info (for UI badge) ────────────────── */

export function dataMode(): "supabase" | "local" {
  return hasSupabase() ? "supabase" : "local";
}
