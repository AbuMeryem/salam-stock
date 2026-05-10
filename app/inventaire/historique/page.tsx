"use client";

import { useMemo } from "react";
import { History as HistoryIcon, ShieldCheck, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/utils/format";

export default function InventaireHistoriquePage() {
  const inventories = useStore((s) => s.inventories);
  const users = useStore((s) => s.users);
  const products = useStore((s) => s.products);
  const sorted = useMemo(
    () => [...inventories].sort((a, b) => b.date.localeCompare(a.date)),
    [inventories]
  );

  return (
    <PageWrapper>
      <PageHeader
        label="OPÉRATIONS"
        title="Historique inventaires"
        subtitle={`${sorted.length} inventaire${sorted.length > 1 ? "s" : ""} sur 14 jours`}
        showBack
      />

      <div className="px-5 mt-4 space-y-3">
        {sorted.length === 0 && <EmptyState icon={HistoryIcon} title="Aucun inventaire" />}
        {sorted.map((inv) => {
          const user = users.find((u) => u.id === inv.user_id);
          const totalEcart = inv.items.reduce((s, it) => s + Math.abs(it.ecart), 0);
          const conform = inv.conformite_pct >= 99;
          return (
            <div key={inv.id} className="bg-white rounded-[20px] shadow-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className={`badge ${conform ? "badge-success" : "badge-warning"}`}>
                    {conform ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> Conforme
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Écart {totalEcart} u
                      </>
                    )}
                  </span>
                  <p className="text-sm font-bold text-text-primary mt-1.5">
                    {formatDateTime(inv.date)}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {user?.name ?? "—"} · {inv.items.length} produits comptés
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="label-caps text-text-tertiary">CONFORMITÉ</p>
                  <p className="text-lg font-bold text-text-primary mt-0.5">
                    {inv.conformite_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-line-light grid grid-cols-1 gap-2">
                {inv.items.map((it) => {
                  const p = products.find((x) => x.id === it.product_id);
                  return (
                    <div
                      key={it.product_id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate text-text-primary font-medium">
                        {p?.name?.split(" ").slice(0, 4).join(" ") ?? "—"}
                      </span>
                      <span className="text-text-secondary">
                        {it.stock_compte ?? "—"}/{it.stock_theoretical}
                        {it.ecart !== 0 && (
                          <span className={`ml-2 font-bold ${it.ecart < 0 ? "text-danger" : "text-warning"}`}>
                            ({it.ecart > 0 ? "+" : ""}
                            {it.ecart})
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </PageWrapper>
  );
}
