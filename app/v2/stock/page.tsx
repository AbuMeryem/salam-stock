"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Search } from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { listProduitsInDepot } from "@/lib/db";
import type { ProduitInDepot } from "@/lib/types/db";

export default function V2StockPage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const [items, setItems] = useState<ProduitInDepot[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tout");

  useEffect(() => {
    if (!depot) return;
    void listProduitsInDepot(depot.id).then(setItems);
  }, [depot]);

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
      <header className="px-5 pt-5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-primary mt-3">Stock</p>
        <h1 className="h1 text-text-primary mt-1">
          {items.length} produit{items.length > 1 ? "s" : ""}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          Catalogue du dépôt {depot?.nom}.
        </p>
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
    </V2Shell>
  );
}
