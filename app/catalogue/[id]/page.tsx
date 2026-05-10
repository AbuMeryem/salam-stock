"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building2, Package, ScanBarcode, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils/format";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const receptions = useStore((s) => s.receptions);

  const product = useMemo(
    () => products.find((p) => p.id === params?.id),
    [products, params?.id]
  );

  if (!product) {
    return (
      <PageWrapper hideNav>
        <div className="px-6 py-12 text-center">
          <p className="text-text-secondary">Produit introuvable.</p>
          <button onClick={() => router.replace("/catalogue")} className="btn-primary mt-6">
            Retour au catalogue
          </button>
        </div>
      </PageWrapper>
    );
  }

  const supplier = suppliers.find((s) => s.id === product.supplier_id);
  const productReceptions = receptions
    .filter((r) => r.lignes.some((l) => l.product_id === product.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const margin = product.purchase_price > 0
    ? ((product.sale_price - product.purchase_price) / product.purchase_price) * 100
    : 0;
  const lowStock = product.stock_theoretical <= product.stock_min;

  return (
    <PageWrapper>
      <PageHeader
        label="STOCK"
        title={product.name}
        subtitle={`${product.brand} · ${product.category}`}
        showBack
      />

      <div className="px-5 mt-4">
        <div
          className="aspect-square rounded-[24px] bg-cream bg-cover bg-center shadow-card"
          style={{ backgroundImage: `url(${product.image_url})` }}
        />
      </div>

      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-[20px] shadow-card p-4">
          <p className="label-caps text-primary">PRIX DE VENTE</p>
          <p className="text-xl font-extrabold text-text-primary mt-1">
            {formatCurrency(product.sale_price)}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Marge {margin.toFixed(0)}%
          </p>
        </div>
        <div className={`rounded-[20px] shadow-card p-4 ${lowStock ? "bg-danger-soft" : "bg-white"}`}>
          <p className="label-caps text-primary">STOCK ACTUEL</p>
          <p className={`text-xl font-extrabold mt-1 ${lowStock ? "text-danger" : "text-text-primary"}`}>
            {product.stock_theoretical} <span className="text-sm font-normal">{product.unit === "L" ? "L" : product.unit === "kg" ? "kg" : "u"}</span>
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Mini {product.stock_min}
          </p>
        </div>
      </div>

      <div className="px-5 mt-3 space-y-3">
        <div className="bg-white rounded-[20px] shadow-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center text-primary">
            <Building2 className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="label-caps text-text-tertiary">FOURNISSEUR</p>
            <p className="text-sm font-bold text-text-primary truncate">
              {supplier?.name}
            </p>
            <p className="text-xs text-text-secondary truncate">{supplier?.contact}</p>
          </div>
        </div>
        <div className="bg-white rounded-[20px] shadow-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center text-primary">
            <ScanBarcode className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="label-caps text-text-tertiary">CODE-BARRES</p>
            <p className="text-sm font-bold text-text-primary font-mono">
              {product.barcode}
            </p>
            <p className="text-xs text-text-secondary">
              Prix d&apos;achat HT {formatCurrency(product.purchase_price)}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-[20px] shadow-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center text-primary">
            <Package className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="label-caps text-text-tertiary">DERNIÈRE RÉCEPTION</p>
            <p className="text-sm font-bold text-text-primary truncate">
              {product.last_received_at ? formatDate(product.last_received_at) : "—"}
            </p>
            <p className="text-xs text-text-secondary">
              {product.last_received_at ? timeAgo(product.last_received_at) : "Jamais réceptionné"}
            </p>
          </div>
        </div>
      </div>

      {productReceptions.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="label-caps-md text-primary mb-3 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-gold" />
            HISTORIQUE DES RÉCEPTIONS
          </h2>
          <div className="bg-white rounded-[20px] shadow-card divide-y divide-line-light">
            {productReceptions.map((r) => {
              const line = r.lignes.find((l) => l.product_id === product.id);
              if (!line) return null;
              return (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {line.quantite_recue} {product.unit === "L" ? "L" : product.unit === "kg" ? "kg" : "unités"}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {formatDate(r.date)}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      Math.abs(line.ecart_pct) < 0.5 ? "badge-success" : "badge-warning"
                    }`}
                  >
                    {Math.abs(line.ecart_pct) < 0.5
                      ? "Conforme"
                      : `${line.ecart_pct > 0 ? "+" : ""}${line.ecart_pct.toFixed(1)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </PageWrapper>
  );
}
