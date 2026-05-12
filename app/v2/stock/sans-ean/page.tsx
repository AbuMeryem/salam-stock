"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackageX, Search, ScanBarcode } from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { listProduitsInDepot, listDepots } from "@/lib/db";
import type { ProduitInDepot, Depot } from "@/lib/types/db";

/**
 * Liste des articles sans code-barre EAN (ou EAN illisible) du dépôt actif.
 * Sert à la réception et aux sorties : on visualise les produits qui ne
 * peuvent pas être scannés et on les sélectionne à la main par nom/marque.
 */
export default function StockSansEanPage() {
  const router = useRouter();
  const currentDepot = useV2((s) => s.currentDepot);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepotId, setSelectedDepotId] = useState<string | null>(null);
  const [items, setItems] = useState<ProduitInDepot[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listDepots().then(setDepots);
  }, []);

  useEffect(() => {
    if (!selectedDepotId && currentDepot) {
      setSelectedDepotId(currentDepot.id);
    }
  }, [currentDepot, selectedDepotId]);

  useEffect(() => {
    if (!selectedDepotId) return;
    setLoading(true);
    void listProduitsInDepot(selectedDepotId).then((all) => {
      const noEan = all.filter(
        (p) => !p.ean || p.ean.trim() === "" || /^[A-Z]{2,}-/.test(p.ean)
      );
      setItems(noEan);
      setLoading(false);
    });
  }, [selectedDepotId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        (p.marque?.toLowerCase().includes(q) ?? false) ||
        (p.categorie?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  const selectedDepotNom = depots.find((d) => d.id === selectedDepotId)?.nom;

  return (
    <V2Shell>
      <PageAccentStripe accent="bordeaux" />
      <header className="px-5 pt-7">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-danger mt-3 inline-flex items-center gap-1">
          <PackageX className="w-3 h-3" />
          Articles sans code-barre
        </p>
        <h1 className="h1 text-text-primary mt-1">
          {items.length} produit{items.length > 1 ? "s" : ""}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          {selectedDepotNom
            ? `Dépôt ${selectedDepotNom} · à scanner manuellement (par nom)`
            : "Sélectionne un dépôt"}
        </p>
      </header>

      {/* Filter par dépôt */}
      <section className="px-5 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {depots.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDepotId(d.id)}
              className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap border transition-colors ${
                selectedDepotId === d.id
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-text-primary border-rule"
              }`}
            >
              {d.nom}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom, marque, catégorie…"
            className="input-field !pl-10 !rounded-full"
          />
        </div>
      </section>

      {loading ? (
        <div className="px-5 py-10 text-center text-text-secondary">
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <PackageX className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            {items.length === 0
              ? "Aucun produit sans code-barre dans ce dépôt. ✓"
              : "Aucun produit ne correspond au filtre."}
          </p>
        </div>
      ) : (
        <section className="px-5 mt-4 space-y-2 pb-nav-stack">
          {filtered.map((p) => (
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
                <p className="text-sm font-bold text-text-primary truncate">
                  {p.nom}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {p.marque && (
                    <span className="text-[11px] text-text-secondary">
                      {p.marque}
                    </span>
                  )}
                  {p.categorie && (
                    <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wide">
                      · {p.categorie}
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-danger inline-flex items-center gap-1 mt-1">
                  <ScanBarcode className="w-3 h-3" />
                  {p.ean
                    ? `Code interne : ${p.ean}`
                    : "Aucun code-barre — saisie nom obligatoire"}
                </p>
              </div>
              <span className="text-xs font-bold text-primary tabular">
                ×{p.quantite}
              </span>
            </div>
          ))}
        </section>
      )}
    </V2Shell>
  );
}
