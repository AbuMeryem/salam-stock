/**
 * POST/GET /api/sync/drive-pull
 *
 * Sync les `orders` du projet Supabase Drive (rvdelylmyyyelgfatewy)
 * vers `commandes_drive` du projet Supabase Stock (tltmermqodelorthtbre).
 *
 * Pourquoi : les deux apps tournent sur DES PROJETS SUPABASE DIFFÉRENTS.
 * Un trigger SQL ne peut pas faire la sync (pas de cross-project foreign
 * data wrapper actif). Cette route fait le pont côté Stock en lisant le
 * Drive avec son anon key et en écrivant dans Stock avec la service role.
 *
 * Idempotent : `upsert` sur `commandes_drive.id` (= orders.id côté Drive).
 * Appelle au chargement de /v2/preparation pour avoir les dernières
 * commandes Drive payées avant d'afficher le Kanban.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DRIVE_SUPABASE_URL =
  process.env.DRIVE_SUPABASE_URL ?? "https://rvdelylmyyyelgfatewy.supabase.co";
const DRIVE_SUPABASE_ANON_KEY = process.env.DRIVE_SUPABASE_ANON_KEY ?? "";

// Mapping orders.status (Drive) → commandes_drive.statut (Stock)
function mapStatut(driveStatus: string): string | null {
  switch (driveStatus) {
    case "paid":
      return "a_preparer";
    case "preparing":
      return "en_preparation";
    case "ready":
      return "pret";
    case "completed":
      return "retire";
    case "canceled":
    case "refunded":
      return "annule";
    default:
      return null; // pending, draft, etc. → on ignore
  }
}

interface DriveOrderItem {
  name?: string;
  quantity?: number;
  unit_price_cents?: number;
}

interface DriveOrder {
  id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  pickup_slot_at: string | null;
  total_ttc: number;
  payment_method: string | null;
  items: DriveOrderItem[] | null;
  created_at: string;
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}

async function runSync() {
  if (!DRIVE_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      {
        error: "drive_credentials_missing",
        hint: "Définir DRIVE_SUPABASE_ANON_KEY en env Vercel.",
      },
      { status: 503 }
    );
  }

  const stockUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const stockKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stockUrl || !stockKey) {
    return NextResponse.json(
      { error: "stock_credentials_missing" },
      { status: 503 }
    );
  }

  const drive = createClient(DRIVE_SUPABASE_URL, DRIVE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const stock = createClient(stockUrl, stockKey, {
    auth: { persistSession: false },
  });

  // 1. Récupère les orders Drive payées/en cours dans les 7 derniers jours
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: orders, error: errOrders } = await drive
    .from("orders")
    .select(
      "id, status, customer_name, customer_phone, customer_email, pickup_slot_at, total_ttc, payment_method, items, created_at"
    )
    .gte("created_at", since)
    .in("status", ["paid", "preparing", "ready", "completed"])
    .order("created_at", { ascending: false });

  if (errOrders) {
    return NextResponse.json(
      { error: "drive_fetch_failed", detail: errOrders.message },
      { status: 502 }
    );
  }

  const rows = (orders ?? []) as unknown as DriveOrder[];
  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, message: "Aucune order Drive récente" });
  }

  // 2. Récupère le dépôt Particulier (destination par défaut)
  const { data: depot } = await stock
    .from("depots")
    .select("id")
    .eq("nom", "Particulier")
    .single();
  const depotId = (depot as { id: string } | null)?.id;
  if (!depotId) {
    return NextResponse.json(
      { error: "depot_particulier_introuvable" },
      { status: 500 }
    );
  }

  // 3. Récupère / crée le produit placeholder "Drive non synchronisé"
  let placeholderId: string | null = null;
  const { data: placeholder } = await stock
    .from("produits")
    .select("id")
    .eq("ean", "0000000000000")
    .maybeSingle();
  if (placeholder) {
    placeholderId = (placeholder as { id: string }).id;
  } else {
    const { data: created } = await stock
      .from("produits")
      .insert({
        ean: "0000000000000",
        nom: "Produit Drive non synchronisé",
        marque: "SALAM",
        categorie: "Épicerie",
        requires_barcode_print: false,
      })
      .select("id")
      .single();
    placeholderId = (created as { id: string } | null)?.id ?? null;
  }

  // 4. Upsert chaque order dans commandes_drive
  let synced = 0;
  for (const o of rows) {
    const statut = mapStatut(o.status);
    if (!statut) continue;

    // Upsert header
    const { error: errHeader } = await stock.from("commandes_drive").upsert(
      {
        id: o.id,
        numero_commande: o.id,
        client_nom: o.customer_name ?? "—",
        client_telephone: o.customer_phone,
        client_email: o.customer_email,
        creneau_retrait:
          o.pickup_slot_at ?? new Date(Date.now() + 2 * 3600_000).toISOString(),
        statut,
        total_ttc: o.total_ttc,
        mode_paiement: o.payment_method === "in_store" ? "en_magasin" : "stripe",
        created_at: o.created_at,
      },
      { onConflict: "id" }
    );
    if (errHeader) {
      console.error("[drive-pull] upsert header failed", o.id, errHeader.message);
      continue;
    }

    // Supprime les lignes en_attente pour les recréer
    await stock
      .from("commandes_drive_lignes")
      .delete()
      .eq("commande_id", o.id)
      .eq("statut_preparation", "en_attente");

    // Recrée les lignes depuis items JSON
    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        if (!item?.name || !item.quantity) continue;

        // Match par nom Stock
        let produitId: string | null = null;
        const { data: prodMatch } = await stock
          .from("produits")
          .select("id")
          .ilike("nom", item.name)
          .limit(1)
          .maybeSingle();
        if (prodMatch) {
          produitId = (prodMatch as { id: string }).id;
        } else {
          // Fallback prefix
          const { data: prefixMatch } = await stock
            .from("produits")
            .select("id")
            .ilike("nom", `${item.name}%`)
            .limit(1)
            .maybeSingle();
          if (prefixMatch) produitId = (prefixMatch as { id: string }).id;
        }
        if (!produitId) produitId = placeholderId;
        if (!produitId) continue;

        await stock.from("commandes_drive_lignes").insert({
          commande_id: o.id,
          produit_id: produitId,
          depot_id: depotId,
          zone_preparation: "particulier",
          quantite: item.quantity,
          prix_unitaire: (item.unit_price_cents ?? 0) / 100,
          statut_preparation: "en_attente",
        });
      }
    }

    synced++;
  }

  return NextResponse.json({
    synced,
    total: rows.length,
    message: `${synced} commande${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}`,
  });
}
