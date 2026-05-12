"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Package, Pencil, Search, Unlock } from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { StockEditModal } from "@/components/v2/StockEditModal";
import { useV2 } from "@/lib/v2-store";
import { listProduitsInDepot } from "@/lib/db";
import {
  canEditStock,
  listStockEditWindows,
  type StockEditWindow,
} from "@/lib/db/stock-edit";
import type { ProduitInDepot } from "@/lib/types/db";

export default function V2StockPage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const employe = useV2((s) => s.currentEmploye);
  const [items, setItems] = useState<ProduitInDepot[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tout");
  const [windows, setWindows] = useState<StockEditWindow[]>([]);
  const [editing, setEditing] = useState<ProduitInDepot | null>(null);

  async function reload() {
    if (!depot) return;
    const [stock, win] = await Promise.all([
      listProduitsInDepot(depot.id),
      listStockEditWindows(),
    ]);
    setItems(stock);
    setWindows(win);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depot]);

  const editAllowed = depot
    ? canEditStock(employe?.role, depot.id, windows)
    : false;
  const windowOpen = depot
    ? Boolean(windows.find((w) => w.depot_id === depot.id)?.is_open)
    : false;

  const cats = useMemo(() => {
    const s = new Set<string>();
    items.forEach((p) => p.categorie && s.add(p.categorie));
    return ["Tout", ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let l = items;
    if (cat !== "Tout") l = l.filter((p) => p.categorie === cat);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter(
        (p) =>
          p.nom.toLowerCase().includes(q) ||
          (p.marque?.toLowerCase().includes(q) ?? false) ||
          (p.ean?.includes(q) ?? false)
      );
    }
    return l;
  }, [items, cat, query]);

  return (
    <V2Shell>
      <PageAccentStripe accent="fonce" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Stock</p>
        <h1 className="h1 text-text-primary mt-1">
          {items.length} produit{items.length > 1 ? "s" : ""}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          Catalogue du dépôt {depot?.nom}.
        </p>
        {/* Bandeau accès édition stock */}
        <div
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
            editAllowed
              ? "bg-success-soft text-success"
              : "bg-cream text-text-secondary border border-rule"
          }`}
        >
          {editAllowed ? (
            <>
              <Unlock className="w-3 h-3" />
              {employe?.role === "admin"
                ? "Édition stock active (admin)"
                : windowOpen
                  ? "Inventaire en cours — édition autorisée"
                  : "Édition autorisée"}
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              Lecture seule — admin ou inventaire requis
            </>
          )}
        </div>
      </header>

      <section className="px-5 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, une marque, un EAN…"
            className="input-field !pl-10 !rounded-full"
          />
        </div>
      </section>

      <div className="mt-3 px-5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 pb-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              data-active={cat === c}
              className="pill-filter"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <section className="px-5 mt-4 grid grid-cols-2 gap-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-rule rounded-2xl overflow-hidden"
          >
            <div className="aspect-square relative">
              <ProductThumbnail
                nom={p.nom}
                categorie={p.categorie}
                rounded="lg"
                className="absolute inset-0 w-full h-full text-3xl"
              />
              <span className="absolute top-2 right-2 bg-white/95 rounded-full px-2 py-0.5 text-[11px] font-bold text-primary inline-flex items-center gap-1 shadow-sm">
                <Package className="w-3 h-3" />
                {p.quantite}
              </span>
              {editAllowed && (
                <button
                  onClick={() => setEditing(p)}
                  className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-card-lg active:scale-95"
                  aria-label="Modifier le stock"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-3">
              <p className="text-[13px] font-bold text-text-primary line-clamp-2 min-h-[34px]">
                {p.nom}
              </p>
              <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
                {p.marque}
              </p>
              {p.prix_vente !== null && (
                <p className="text-base font-extrabold text-primary mt-1">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(p.prix_vente)}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      {filtered.length === 0 && (
        <div className="px-5 py-10 text-center text-text-secondary">
          Aucun produit ne correspond à la recherche.
        </div>
      )}

      <StockEditModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => void reload()}
        produit={
          editing
            ? { id: editing.id, nom: editing.nom, categorie: editing.categorie }
            : null
        }
        depotId={depot?.id ?? ""}
        depotNom={depot?.nom ?? ""}
        quantiteActuelle={editing?.quantite ?? 0}
        employeId={employe?.id ?? ""}
        duringInventaire={windowOpen}
      />
    </V2Shell>
  );
}
