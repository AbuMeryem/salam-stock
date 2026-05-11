/**
 * Local seed data for the V2 schema, used when no Supabase env vars are set.
 * Same shape as the real DB rows — see lib/types/db.ts.
 * The data here is built from lib/data/products.json (v1 catalog).
 */

import productsRaw from "@/lib/data/products.json";
import type {
  Depot,
  Employe,
  Produit,
  StockParDepot,
} from "@/lib/types/db";

interface ProductV1 {
  id: string;
  name: string;
  brand: string;
  category: string;
  barcode: string;
  sale_price: number;
  image_url: string | null;
  description?: string;
}

const PRODUCTS_V1 = productsRaw as ProductV1[];

const DEPOT_IDS = {
  particulier: "depot-particulier",
  professionnel: "depot-professionnel",
  sodrune: "depot-sodrune",
};

export const SEED_DEPOTS: Depot[] = [
  {
    id: DEPOT_IDS.particulier,
    nom: "Particulier",
    type: "point_vente",
    adresse: "8 av. Larrieu-Thibaud, Toulouse",
    is_active: true,
    created_at: "2026-05-01T08:00:00Z",
  },
  {
    id: DEPOT_IDS.professionnel,
    nom: "Professionnel",
    type: "point_vente",
    adresse: "8 av. Larrieu-Thibaud, Toulouse",
    is_active: true,
    created_at: "2026-05-01T08:00:00Z",
  },
  {
    id: DEPOT_IDS.sodrune,
    nom: "Sodrune",
    type: "entrepot",
    adresse: "Entrepôt Sud Toulouse",
    is_active: true,
    created_at: "2026-05-01T08:00:00Z",
  },
];

export const SEED_EMPLOYES: Employe[] = [
  {
    id: "emp-otmane",
    nom: "Jamal",
    prenom: "Otmane",
    role: "manager",
    depot_principal_id: DEPOT_IDS.particulier,
    is_active: true,
    pin_code: "1234",
  },
  {
    id: "emp-ilyes",
    nom: "Mehdi",
    prenom: "Ilyes",
    role: "preparation",
    depot_principal_id: DEPOT_IDS.professionnel,
    is_active: true,
    pin_code: "5678",
  },
  {
    id: "emp-ahmed",
    nom: "Nasri",
    prenom: "Ahmed",
    role: "admin",
    depot_principal_id: DEPOT_IDS.particulier,
    is_active: true,
    pin_code: "9999",
  },
  {
    // Sodrune (entrepôt back-office) avait 0 employé — le cron inventaire
    // ne pouvait pas assigner. Reda Hamidou couvre l'entrepôt.
    id: "emp-reda",
    nom: "Hamidou",
    prenom: "Reda",
    role: "reception",
    depot_principal_id: DEPOT_IDS.sodrune,
    is_active: true,
    pin_code: "4321",
  },
];

/** Plats traiteur — préparés en cuisine au dépôt Particulier, mais
 *  routés vers la zone "traiteur" du drive. Synchro avec
 *  supabase/migrations/0005_traiteur_flag.sql. */
const TRAITEUR_PRODUITS: Produit[] = [
  {
    id: "prd-traiteur-couscous",
    ean: "2900200000011",
    nom: "Couscous royal traiteur 4 pers",
    marque: "Salam Cuisine",
    categorie: "Traiteur",
    sous_categorie: null,
    image_url: null,
    description: null,
    requires_barcode_print: true,
    est_traiteur: true,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-08T08:00:00Z",
  },
  {
    id: "prd-traiteur-tajine",
    ean: "2900200000012",
    nom: "Tajine agneau pruneaux 6 pers",
    marque: "Salam Cuisine",
    categorie: "Traiteur",
    sous_categorie: null,
    image_url: null,
    description: null,
    requires_barcode_print: true,
    est_traiteur: true,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-08T08:00:00Z",
  },
  {
    id: "prd-traiteur-pastilla",
    ean: "2900200000013",
    nom: "Pastilla poulet maison",
    marque: "Salam Cuisine",
    categorie: "Traiteur",
    sous_categorie: null,
    image_url: null,
    description: null,
    requires_barcode_print: true,
    est_traiteur: true,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-08T08:00:00Z",
  },
  {
    id: "prd-traiteur-mechoui",
    ean: "2900200000014",
    nom: "Méchoui d'agneau préparé 2kg",
    marque: "Salam Cuisine",
    categorie: "Traiteur",
    sous_categorie: null,
    image_url: null,
    description: null,
    requires_barcode_print: true,
    est_traiteur: true,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-08T08:00:00Z",
  },
  {
    id: "prd-traiteur-salade",
    ean: "2900200000015",
    nom: "Salade composée maison 500g",
    marque: "Salam Cuisine",
    categorie: "Traiteur",
    sous_categorie: null,
    image_url: null,
    description: null,
    requires_barcode_print: true,
    est_traiteur: true,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-08T08:00:00Z",
  },
];

const TRAITEUR_STOCK_PRICES: Record<string, { qty: number; prix: number }> = {
  "prd-traiteur-couscous": { qty: 8, prix: 39.9 },
  "prd-traiteur-tajine": { qty: 5, prix: 54.0 },
  "prd-traiteur-pastilla": { qty: 12, prix: 18.5 },
  "prd-traiteur-mechoui": { qty: 3, prix: 78.0 },
  "prd-traiteur-salade": { qty: 16, prix: 8.9 },
};

export const SEED_PRODUITS: Produit[] = [
  ...PRODUCTS_V1.map((p) => ({
    id: `prd-${p.id}`,
    ean: p.barcode,
    nom: p.name,
    marque: p.brand,
    categorie: p.category,
    sous_categorie: null,
    image_url: p.image_url,
    description: p.description ?? null,
    requires_barcode_print: p.barcode?.startsWith("290") ?? false,
    est_traiteur: false,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-08T08:00:00Z",
  })),
  ...TRAITEUR_PRODUITS,
];

/** Heuristic: which depots get this product, with stock range. */
function depotsFor(cat: string): { depot_id: string; range: [number, number] }[] {
  switch (cat) {
    case "Boucherie":
      return [{ depot_id: DEPOT_IDS.particulier, range: [12, 40] }];
    case "Charcuterie":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [8, 30] },
        { depot_id: DEPOT_IDS.professionnel, range: [20, 60] },
      ];
    case "Surgelés":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [10, 40] },
        { depot_id: DEPOT_IDS.professionnel, range: [20, 80] },
      ];
    case "Frais":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [10, 50] },
        { depot_id: DEPOT_IDS.professionnel, range: [12, 40] },
      ];
    case "Boissons":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [20, 80] },
        { depot_id: DEPOT_IDS.professionnel, range: [40, 200] },
        { depot_id: DEPOT_IDS.sodrune, range: [60, 300] },
      ];
    case "Hygiène":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [10, 40] },
        { depot_id: DEPOT_IDS.professionnel, range: [20, 80] },
        { depot_id: DEPOT_IDS.sodrune, range: [40, 200] },
      ];
    case "Épicerie":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [15, 50] },
        { depot_id: DEPOT_IDS.professionnel, range: [25, 80] },
        { depot_id: DEPOT_IDS.sodrune, range: [50, 200] },
      ];
    case "Produits du Maghreb":
      return [
        { depot_id: DEPOT_IDS.particulier, range: [20, 60] },
        { depot_id: DEPOT_IDS.professionnel, range: [30, 100] },
        { depot_id: DEPOT_IDS.sodrune, range: [60, 250] },
      ];
    default:
      return [{ depot_id: DEPOT_IDS.particulier, range: [10, 30] }];
  }
}

// Deterministic seeded RNG so the demo numbers stay stable.
function mulberry32(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

export const SEED_STOCK: StockParDepot[] = (() => {
  const out: StockParDepot[] = [];
  PRODUCTS_V1.forEach((p) => {
    const targets = depotsFor(p.category);
    targets.forEach((t) => {
      const [lo, hi] = t.range;
      const qty = Math.floor(lo + rand() * (hi - lo));
      out.push({
        id: `stock-${p.id}-${t.depot_id}`,
        produit_id: `prd-${p.id}`,
        depot_id: t.depot_id,
        quantite: qty,
        prix_vente: p.sale_price,
        is_visible: true,
        updated_at: "2026-05-08T08:00:00Z",
      });
    });
  });
  // Stock traiteur — uniquement au Particulier (la cuisine est en magasin).
  TRAITEUR_PRODUITS.forEach((p) => {
    const meta = TRAITEUR_STOCK_PRICES[p.id];
    if (!meta) return;
    out.push({
      id: `stock-${p.id}-${DEPOT_IDS.particulier}`,
      produit_id: p.id,
      depot_id: DEPOT_IDS.particulier,
      quantite: meta.qty,
      prix_vente: meta.prix,
      is_visible: true,
      updated_at: "2026-05-08T08:00:00Z",
    });
  });
  return out;
})();
