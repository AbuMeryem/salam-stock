"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Clock,
  History,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const tabs = ["En attente", "Historique"] as const;

export default function ReceptionPage() {
  const [tab, setTab] = useState<typeof tabs[number]>("En attente");
  const orders = useStore((s) => s.orders);
  const suppliers = useStore((s) => s.suppliers);
  const receptions = useStore((s) => s.receptions);

  const enAttente = useMemo(
    () => orders.filter((o) => o.status === "en_attente_reception"),
    [orders]
  );
  const historique = useMemo(
    () => orders.filter((o) => o.status !== "en_attente_reception"),
    [orders]
  );

  return (
    <PageWrapper>
      <PageHeader
        label="LOGISTIQUE"
        title="Réception fournisseurs"
        subtitle={`${enAttente.length} bon${enAttente.length > 1 ? "s" : ""} de commande à traiter`}
        rightSlot={
          <Link
            href="/reception/historique"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-ondark"
            aria-label="Historique"
          >
            <History className="w-5 h-5" />
          </Link>
        }
      />

      <div className="px-5 -mt-4 relative z-10">
        <div className="bg-white rounded-full shadow-card p-1 flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                t === tab ? "bg-primary text-white" : "text-text-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6 space-y-3">
        {tab === "En attente" && enAttente.length === 0 && (
          <EmptyState
            icon={PackageCheck}
            title="Aucune réception en attente"
            description="Toutes les livraisons fournisseurs ont été traitées. Belle journée !"
          />
        )}
        {tab === "En attente" &&
          enAttente.map((o) => {
            const supplier = suppliers.find((s) => s.id === o.supplier_id);
            return (
              <Link
                key={o.id}
                href={`/reception/${o.id}`}
                className="block bg-white rounded-[20px] shadow-card p-5 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge badge-warning">
                        <Clock className="w-3 h-3" /> À RÉCEPTIONNER
                      </span>
                    </div>
                    <p className="text-base font-bold text-text-primary leading-tight">
                      {supplier?.name ?? "Fournisseur"}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {o.reference} · livraison {formatDate(o.date_livraison_prevue)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-tertiary mt-1" />
                </div>

                <div className="flex items-end justify-between mt-4 pt-4 border-t border-line-light">
                  <div>
                    <p className="label-caps text-text-tertiary">LIGNES</p>
                    <p className="text-lg font-bold text-text-primary mt-0.5">
                      {o.lignes.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="label-caps text-text-tertiary">TOTAL HT</p>
                    <p className="text-lg font-bold text-text-primary mt-0.5">
                      {formatCurrency(o.total_ht)}
                    </p>
                  </div>
                  <button className="btn-gold !py-2.5 !px-5 text-[13px]">
                    <Truck className="w-4 h-4" />
                    Démarrer
                  </button>
                </div>
              </Link>
            );
          })}

        {tab === "Historique" && historique.length === 0 && (
          <EmptyState icon={History} title="Aucun historique" />
        )}
        {tab === "Historique" &&
          historique.map((o) => {
            const supplier = suppliers.find((s) => s.id === o.supplier_id);
            const reception = receptions.find((r) => r.order_id === o.id);
            const ecart = reception?.ecart_global_pct ?? 0;
            const conformite = reception?.conformite_pct ?? 100;
            return (
              <div
                key={o.id}
                className="bg-white rounded-[20px] shadow-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span
                      className={`badge ${
                        o.status === "recu_avec_ecart"
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                    >
                      {o.status === "recu_avec_ecart"
                        ? `Écart ${Math.abs(ecart).toFixed(1)}%`
                        : "Conforme"}
                    </span>
                    <p className="text-base font-bold text-text-primary mt-1.5">
                      {supplier?.name}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {o.reference} · reçu le {formatDate(o.date_livraison_prevue)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="label-caps text-text-tertiary">CONFORMITÉ</p>
                    <p className="text-lg font-bold text-text-primary mt-0.5">
                      {conformite.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </PageWrapper>
  );
}
