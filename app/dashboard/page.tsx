"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ConformiteChart, ReceptionsBarChart } from "@/components/dashboard/Charts";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { formatCurrency } from "@/lib/utils/format";

const periodes = ["Aujourd'hui", "Cette semaine", "Ce mois"] as const;

const conformiteData = [
  { day: "L", current: 92, previous: 88 },
  { day: "M", current: 95, previous: 90 },
  { day: "M", current: 96, previous: 91 },
  { day: "J", current: 94, previous: 93 },
  { day: "V", current: 97, previous: 92 },
  { day: "S", current: 96, previous: 94 },
  { day: "D", current: 96, previous: 94 },
];

const receptionsData = [
  { day: "L", value: 2 },
  { day: "M", value: 3 },
  { day: "M", value: 2 },
  { day: "J", value: 1 },
  { day: "V", value: 3 },
  { day: "S", value: 2 },
  { day: "D", value: 1 },
];

export default function DashboardPage() {
  const [periode, setPeriode] = useState<typeof periodes[number]>("Cette semaine");
  const user = useStore((s) => s.currentUser);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const alerts = useStore((s) => s.alerts);
  const activities = useStore((s) => s.activities);

  const kpis = useMemo(() => {
    const stockValue = products.reduce(
      (sum, p) => sum + p.stock_theoretical * p.purchase_price,
      0
    );
    const ecartCount = alerts.filter((a) => a.severity === "critique").length;
    const enAttente = orders.filter((o) => o.status === "en_attente_reception").length;
    return { stockValue, ecartCount, enAttente };
  }, [products, orders, alerts]);

  const topAlerts = alerts.filter((a) => a.severity === "critique").slice(0, 3);
  if (topAlerts.length < 3) {
    alerts
      .filter((a) => a.severity !== "critique")
      .slice(0, 3 - topAlerts.length)
      .forEach((a) => topAlerts.push(a));
  }

  return (
    <PageWrapper>
      <PageHeader
        label="ESPACE ADMIN"
        title="Tableau de bord"
        subtitle={`Salam Market Toulouse · ${user?.name ?? ""}`}
        showSettings
      />

      <div className="px-5 -mt-4 relative z-10">
        <div className="bg-white rounded-full shadow-card p-1 flex items-center gap-1">
          {periodes.map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={`flex-1 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                p === periode
                  ? "bg-primary text-white"
                  : "text-text-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6 space-y-3">
        <KpiCard
          label="TAUX DE CONFORMITÉ RÉCEPTIONS"
          value="96%"
          comparison="vs semaine dernière"
          delta={{ value: 2, positive: true }}
          chart={<ConformiteChart data={conformiteData} />}
        />
        <KpiCard
          label="ÉCARTS DÉTECTÉS"
          value={kpis.ecartCount}
          comparison="vs semaine dernière"
          delta={{ value: -50, positive: true }}
          href="/alertes"
        />
        <KpiCard
          label="RÉCEPTIONS TRAITÉES"
          value="14"
          comparison={`${kpis.enAttente} en attente`}
          chart={<ReceptionsBarChart data={receptionsData} />}
          delta={{ value: 8, positive: true }}
        />
        <KpiCard
          label="VALEUR DU STOCK"
          value={formatCurrency(kpis.stockValue)}
          comparison="Sur 35 références actives"
          delta={{ value: 4, positive: true }}
        />
      </div>

      <section className="px-5 mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="label-caps-md text-primary">ACTIVITÉ RÉCENTE</h2>
          <Link href="/reception/historique" className="text-xs font-semibold text-primary flex items-center gap-1">
            Tout voir <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <ActivityList entries={activities} max={5} />
      </section>

      <section className="px-5 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="label-caps-md text-primary inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            ALERTES IA
          </h2>
          <Link href="/alertes" className="text-xs font-semibold text-primary flex items-center gap-1">
            Centre d&apos;alertes <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-3">
          {topAlerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      </section>

      <section className="px-5 mt-7">
        <Link
          href="/assistant"
          className="block bg-primary rounded-[24px] p-5 text-white shadow-card-lg active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gold flex items-center justify-center text-primary-dark shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="label-caps text-gold">ASSISTANT IA · BÊTA</p>
              <p className="text-base font-bold mt-1 leading-snug">
                Pose une question à l&apos;assistant Salam
              </p>
              <p className="text-[13px] text-text-ondarkmuted mt-1">
                « Quels écarts cette semaine ? » · « Produits en rupture ? »
              </p>
            </div>
            <ArrowUpRight className="w-5 h-5 text-gold" />
          </div>
        </Link>
      </section>
    </PageWrapper>
  );
}
