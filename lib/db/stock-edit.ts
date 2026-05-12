import { supabase } from "@/lib/supabase";

export interface StockEditWindow {
  id: string;
  depot_id: string;
  is_open: boolean;
  opened_by: string | null;
  opened_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  raison: string | null;
  updated_at: string;
}

export interface StockEditLogEntry {
  id: string;
  depot_id: string;
  produit_id: string;
  quantite_avant: number;
  quantite_apres: number;
  delta: number;
  raison: string | null;
  modifie_par: string;
  modifie_le: string;
  during_inventaire: boolean;
}

/** Liste l'état actuel des fenêtres d'édition par dépôt. */
export async function listStockEditWindows(): Promise<StockEditWindow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("stock_edit_window")
    .select("*")
    .order("depot_id");
  if (error) {
    console.error("[stock-edit] listWindows error:", error);
    return [];
  }
  return (data ?? []) as StockEditWindow[];
}

/** Détermine si l'employé peut modifier le stock d'un dépôt :
 *  - admin → toujours autorisé
 *  - autres → uniquement si la fenêtre du dépôt est ouverte */
export function canEditStock(
  employeRole: string | undefined,
  depotId: string,
  windows: StockEditWindow[]
): boolean {
  if (employeRole === "admin") return true;
  const w = windows.find((x) => x.depot_id === depotId);
  return Boolean(w?.is_open);
}

/** Ouvre la fenêtre d'édition stock pour un dépôt (admin only). */
export async function openStockEditWindow(args: {
  depot_id: string;
  employe_id: string;
  raison?: string;
}): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb
    .from("stock_edit_window")
    .upsert(
      {
        depot_id: args.depot_id,
        is_open: true,
        opened_by: args.employe_id,
        opened_at: new Date().toISOString(),
        closed_by: null,
        closed_at: null,
        raison: args.raison ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "depot_id" }
    );
  if (error) throw new Error(error.message);
}

/** Ferme la fenêtre d'édition stock (admin only). */
export async function closeStockEditWindow(args: {
  depot_id: string;
  employe_id: string;
}): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb
    .from("stock_edit_window")
    .upsert(
      {
        depot_id: args.depot_id,
        is_open: false,
        closed_by: args.employe_id,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "depot_id" }
    );
  if (error) throw new Error(error.message);
}

/** Modifie la quantité d'un produit dans un dépôt + log d'audit.
 *  Le caller doit avoir validé canEditStock() avant. */
export async function adjustStockManual(args: {
  produit_id: string;
  depot_id: string;
  quantite_apres: number;
  raison: string;
  employe_id: string;
  during_inventaire?: boolean;
}): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Supabase non configuré");

  // 1. Lit la quantité actuelle
  const { data: stock, error: errSel } = await sb
    .from("stock_par_depot")
    .select("id, quantite")
    .eq("produit_id", args.produit_id)
    .eq("depot_id", args.depot_id)
    .maybeSingle();
  if (errSel) throw new Error(errSel.message);

  const qtyBefore = stock ? Number((stock as { quantite: number }).quantite) : 0;
  const qtyAfter = Math.max(0, args.quantite_apres);

  // 2. UPDATE ou INSERT
  if (stock) {
    const { error } = await sb
      .from("stock_par_depot")
      .update({
        quantite: qtyAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (stock as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("stock_par_depot").insert({
      produit_id: args.produit_id,
      depot_id: args.depot_id,
      quantite: qtyAfter,
      is_visible: true,
    });
    if (error) throw new Error(error.message);
  }

  // 3. Log d'audit (non-bloquant — le stock est modifié coûte que coûte)
  try {
    await sb.from("stock_edit_log").insert({
      depot_id: args.depot_id,
      produit_id: args.produit_id,
      quantite_avant: qtyBefore,
      quantite_apres: qtyAfter,
      raison: args.raison,
      modifie_par: args.employe_id,
      during_inventaire: args.during_inventaire ?? false,
    });
  } catch (e) {
    console.error("[stock-edit] log error (non-bloquant):", e);
  }
}

/** Liste les N derniers logs (pour audit). */
export async function listStockEditLog(opts?: {
  depot_id?: string;
  limit?: number;
}): Promise<StockEditLogEntry[]> {
  const sb = supabase();
  if (!sb) return [];
  let q = sb
    .from("stock_edit_log")
    .select("*")
    .order("modifie_le", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.depot_id) q = q.eq("depot_id", opts.depot_id);
  const { data, error } = await q;
  if (error) {
    console.error("[stock-edit] listLog error:", error);
    return [];
  }
  return (data ?? []) as StockEditLogEntry[];
}
