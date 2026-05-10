"use client";

import { useMemo } from "react";
import { History as HistoryIcon, ImageIcon, ShieldCheck, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/utils/format";

export default function HistoriquePage() {
  const receptions = useStore((s) => s.receptions);
  const orders = useStore((s) => s.orders);
  const suppliers = useStore((s) => s.suppliers);
  const users = useStore((s) => s.users);
  const products = useStore((s) => s.products);

  const sorted = useMemo(
    () => [...receptions].sort((a, b) => b.date.localeCompare(a.date)),
    [receptions]
  );

  return (
    <PageWrapper>
      <PageHeader
        label="LOGISTIQUE"
        title="Historique des réceptions"
        subtitle={`${sorted.length} réception${sorted.length > 1 ? "s" : ""} enregistrée${sorted.length > 1 ? "s" : ""}`}
        showBack
      />

      <div className="px-5 mt-4 space-y-3">
        {sorted.length === 0 && (
          <EmptyState icon={HistoryIcon} title="Aucune réception" />
        )}
        {sorted.map((r) => {
          const order = orders.find((o) => o.id === r.order_id);
          const supplier = order ? suppliers.find((s) => s.id === order.supplier_id) : null;
          const user = users.find((u) => u.id === r.user_id);
          const ecart = Math.abs(r.ecart_global_pct);
          const conform = ecart <= 0.5;
          const photos = r.lignes.flatMap((l) => l.photos);
          return (
            <div key={r.id} className="bg-white rounded-[20px] shadow-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span
                    className={`badge ${conform ? "badge-success" : "badge-warning"}`}
                  >
                    {conform ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> Conforme
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Écart {ecart.toFixed(1)}%
                      </>
                    )}
                  </span>
                  <p className="text-base font-bold text-text-primary mt-1.5">
                    {supplier?.name ?? "Fournisseur"}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {order?.reference} · {formatDateTime(r.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="label-caps text-text-tertiary">CONFORMITÉ</p>
                  <p className="text-lg font-bold text-text-primary mt-0.5">
                    {r.conformite_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-line-light text-center">
                <div>
                  <p className="label-caps text-text-tertiary">LIGNES</p>
                  <p className="text-base font-bold text-text-primary mt-0.5">
                    {r.lignes.length}
                  </p>
                </div>
                <div>
                  <p className="label-caps text-text-tertiary">PHOTOS</p>
                  <p className="text-base font-bold text-text-primary mt-0.5 inline-flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    {Math.max(r.photo_carton_count, photos.length)}
                  </p>
                </div>
                <div>
                  <p className="label-caps text-text-tertiary">PAR</p>
                  <p className="text-base font-bold text-text-primary mt-0.5 truncate">
                    {user?.initials ?? "?"}
                  </p>
                </div>
              </div>

              {photos.length > 0 && (
                <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-none">
                  {photos.slice(0, 6).map((src, idx) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={idx}
                      src={src}
                      alt={`photo ${idx + 1}`}
                      className="w-16 h-16 rounded-xl object-cover border border-line-light shrink-0"
                    />
                  ))}
                </div>
              )}

              {r.justification && (
                <div className="mt-3 p-3 rounded-xl bg-cream text-xs text-text-secondary leading-snug">
                  <span className="font-semibold text-text-primary">Justification :</span> {r.justification}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {r.lignes.slice(0, 3).map((l) => {
                  const p = products.find((x) => x.id === l.product_id);
                  return (
                    <span key={l.product_id} className="badge badge-neutral">
                      {p?.name?.split(" ").slice(0, 3).join(" ")}
                    </span>
                  );
                })}
                {r.lignes.length > 3 && (
                  <span className="badge badge-neutral">+{r.lignes.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageWrapper>
  );
}
