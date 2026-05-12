"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Layers, Lock, Package, Pencil, Search, Store, Unlock } from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { StockEditModal } from "@/components/v2/StockEditModal";
import { PriceTag } from "@/components/v2/PriceTag";
import { useV2 } from "@/lib/v2-store";
import { listProduitsInDepot, listDepots } from "@/lib/db";
import type { Depot } from "@/lib/types/db";
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
  const [allDepots, setAllDepots] = useState<Depot[]>([]);
  const [allStocks, setAllStocks] = useState<Map<string, ProduitInDepot[]>>(
    new Map()
  );
  const [view, setView] = useState<"depot" | "regroupe">("depot");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tout");
  const [windows, setWindows] = useState<StockEditWindow[]>([]);
  const [editing, setEditing] = useState<ProduitInDepot | null>(null);

  async function reload() {
    if (!depot) return;
    const [stock, win, deps] = await Promise.all([
      listProduitsInDepot(depot.id),
      listStockEditWindows(),
      listDepots(),
    ]);
    setItems(stock);
    setWindows(win);
    setAllDepots(deps);
  }

  // Charge les stocks de tous les dépôts UNIQUEMENT quand on bascule sur
  // la vue regroupée (économise les requêtes en vue simple)
  useEffect(() => {
    if (view !== "regroupe" || allDepots.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = new Map<string, ProduitInDepot[]>();
      for (const d of allDepots) {
        const s = await listProduitsInDepot(d.id);
        if (cancelled) return;
        map.set(d.id, s);
      }
      if (!cancelled) setAllStocks(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, allDepots]);

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

  // Vue regroupée : map produit_id → { produit, total, breakdown par dépôt }
  type Aggregated = {
    id: string;
    nom: string;
    marque: string | null;
    categorie: string | null;
    ean: string | null;
    image_url: string | null;
    total: number;
    breakdown: Array<{ depot: Depot; quantite: number; prix_vente: number | null }>;
  };
  const aggregated: Aggregated[] = useMemo(() => {
    if (view !== "regroupe" || allStocks.size === 0) return [];
    const map = new Map<string, Aggregated>();
    for (const [depotId, stocks] of allStocks) {
      const dep = allDepots.find((d) => d.id === depotId);
      if (!dep) continue;
      for (const p of stocks) {
        const cur = map.get(p.id) ?? {
          id: p.id,
          nom: p.nom,
          marque: p.marque,
          categorie: p.categorie,
          ean: p.ean,
          image_url: p.image_url,
          total: 0,
          breakdown: [],
        };
        cur.total += p.quantite;
        cur.breakdown.push({
          depot: dep,
          quantite: p.quantite,
          prix_vente: p.prix_vente,
        });
        map.set(p.id, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [view, allStocks, allDepots]);

  const cats = useMemo(() => {
    const s = new Set<string>();
    const source = view === "regroupe" ? aggregated : items;
    source.forEach((p) => p.categorie && s.add(p.categorie));
    return ["Tout", ...Array.from(s).sort()];
  }, [items, aggregated, view]);

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

  const filteredAggregated = useMemo(() => {
    let l = aggregated;
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
  }, [aggregated, cat, query]);

  return (
    <V2Shell>
      <PageAccentStripe accent="fonce" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Stock</p>
        <h1 className="h1 text-text-primary mt-1">
          {view === "regroupe"
            ? `${aggregated.length} produit${aggregated.length > 1 ? "s" : ""} (3 dépôts)`
            : `${items.length} produit${items.length > 1 ? "s" : ""}`}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          {view === "regroupe"
            ? "Vue regroupée Particulier + Pro + Sodrune."
            : `Catalogue du dépôt ${depot?.nom}.`}
        </p>

        {/* Toggle vue dépôt unique / regroupée */}
        <div
          role="tablist"
          aria-label="Vue stock"
          className="inline-flex bg-white border border-rule rounded-full p-1 mt-3 shadow-card"
        >
          <button
            role="tab"
            aria-selected={view === "depot"}
            onClick={() => setView("depot")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              view === "depot" ? "bg-primary text-white" : "text-text-secondary"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            {depot?.nom ?? "Dépôt"}
          </button>
          <button
            role="tab"
            aria-selected={view === "regroupe"}
            onClick={() => setView("regroupe")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              view === "regroupe" ? "bg-primary text-white" : "text-text-secondary"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tous dépôts
          </button>
        </div>
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

      {view === "depot" ? (
        <>
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
                  <PriceTag
                    amount={p.prix_vente}
                    className="text-base font-extrabold text-primary mt-1 block"
                  />
                </div>
              </div>
            ))}
          </section>
          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-text-secondary">
              Aucun produit ne correspond à la recherche.
            </div>
          )}
        </>
      ) : (
        // ─── VUE REGROUPÉE 3 DÉPÔTS ─────────────────────────────
        <>
          <section className="px-5 mt-4 space-y-2.5">
            {filteredAggregated.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-rule rounded-2xl p-3 flex items-center gap-3"
              >
                <ProductThumbnail
                  nom={p.nom}
                  categorie={p.categorie}
                  size={48}
                  rounded="xl"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold text-text-primary truncate">
                    {p.nom}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {p.breakdown.map((b) => (
                      <span
                        key={b.depot.id}
                        className="inline-flex items-center gap-1 bg-cream rounded-full px-2 py-0.5 text-[10.5px] font-bold text-text-primary"
                      >
                        {b.depot.type === "entrepot" ? (
                          <Building2 className="w-2.5 h-2.5 text-text-tertiary" />
                        ) : (
                          <Store className="w-2.5 h-2.5 text-text-tertiary" />
                        )}
                        {b.depot.nom.slice(0, 4)} ·{" "}
                        <span className="tabular">{b.quantite}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary">
                    Total
                  </p>
                  <p className="text-[18px] font-extrabold text-primary tabular leading-none">
                    {p.total}
                  </p>
                </div>
              </div>
            ))}
          </section>
          {filteredAggregated.length === 0 && (
            <div className="px-5 py-10 text-center text-text-secondary">
              {allStocks.size === 0
                ? "Chargement des 3 dépôts…"
                : "Aucun produit ne correspond à la recherche."}
            </div>
          )}
        </>
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
