"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Plus, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Category } from "@/lib/types";

const categories: ("Tout" | Category)[] = [
  "Tout",
  "Épicerie",
  "Boucherie",
  "Charcuterie",
  "Boissons",
  "Surgelés",
  "Frais",
  "Produits du Maghreb",
  "Hygiène",
];

export default function CataloguePage() {
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const [cat, setCat] = useState<(typeof categories)[number]>("Tout");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = products;
    if (cat !== "Tout") list = list.filter((p) => p.category === cat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.barcode.includes(q)
      );
    }
    return list;
  }, [products, cat, query]);

  return (
    <PageWrapper>
      <PageHeader
        label="STOCK"
        title="Catalogue produits"
        subtitle={`${products.length} références · ${products.filter((p) => p.stock_theoretical <= p.stock_min).length} en alerte stock`}
      />

      <div className="px-5 mt-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, une marque…"
            className="input-field !pl-11 !rounded-full"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto scrollbar-none px-5">
        <div className="flex items-center gap-2 pb-2">
          {categories.map((c) => (
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

      <div className="px-5 mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Aucun produit"
            description="Affine la recherche ou crée une nouvelle fiche."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => {
              const sup = suppliers.find((s) => s.id === p.supplier_id);
              return <ProductCard key={p.id} product={p} supplierName={sup?.name} />;
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 right-5 z-30">
        <Link
          href="/catalogue/nouveau"
          className="btn-fab !w-14 !h-14"
          aria-label="Créer un produit"
        >
          <Plus className="w-6 h-6" />
        </Link>
      </div>
    </PageWrapper>
  );
}
