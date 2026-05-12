"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, ClipboardCheck } from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { useV2 } from "@/lib/v2-store";
import {
  listDepots,
  listEmployes,
  listInventairesHistorique,
} from "@/lib/db";
import type { Depot, Employe, InventaireTournant } from "@/lib/types/db";

export default function V2InventaireHistoriquePage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const [rows, setRows] = useState<InventaireTournant[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [scope, setScope] = useState<"depot" | "all">("depot");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([listDepots(), listEmployes()]).then(([d, e]) => {
      setDepots(d);
      setEmployes(e);
    });
  }, []);

  useEffect(() => {
    if (!depot) return;
    setLoading(true);
    void listInventairesHistorique({
      depotId: scope === "depot" ? depot.id : undefined,
      limit: 80,
    })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [depot, scope]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, InventaireTournant[]>();
    rows.forEach((r) => {
      const list = byDate.get(r.date_assignation) ?? [];
      list.push(r);
      byDate.set(r.date_assignation, list);
    });
    return Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Historique inventaires</p>
        <h1 className="h1 text-text-primary mt-1">
          {rows.length} inventaire{rows.length > 1 ? "s" : ""}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          {scope === "depot"
            ? `Tournants comptés sur ${depot?.nom ?? "ce dépôt"}.`
            : "Tournants comptés sur les 3 dépôts."}
        </p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setScope("depot")}
            data-active={scope === "depot"}
            className="pill-filter"
          >
            Ce dépôt
          </button>
          <button
            onClick={() => setScope("all")}
            data-active={scope === "all"}
            className="pill-filter"
          >
            Tous les dépôts
          </button>
        </div>
      </header>

      <section className="px-5 mt-6 pb-12">
        {loading ? (
          <p className="text-center text-text-secondary py-8">Chargement…</p>
        ) : grouped.length === 0 ? (
          <div className="bg-cream border border-rule rounded-2xl p-8 text-center">
            <ClipboardCheck className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm font-bold text-text-primary">
              Pas encore d&apos;historique
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Les inventaires comptés apparaîtront ici, regroupés par jour.
            </p>
          </div>
        ) : (
          grouped.map(([date, items]) => {
            const validated = items.filter(
              (i) => i.quantite_comptee !== null
            ).length;
            const ecarts = items.filter(
              (i) => i.quantite_comptee !== null && i.ecart !== 0
            ).length;
            return (
              <div key={date} className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="label-caps text-text-tertiary inline-flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(date)}
                  </p>
                  <p className="text-[11px] text-text-secondary">
                    {validated}/{items.length} comptés
                    {ecarts > 0 && (
                      <span className="text-warning font-bold ml-2">
                        · {ecarts} écart{ecarts > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-white border border-rule rounded-2xl divide-y divide-rule overflow-hidden">
                  {items.map((i) => {
                    const e = employes.find(
                      (x) => x.id === i.employe_assigne_id
                    );
                    const d = depots.find((x) => x.id === i.depot_id);
                    const counted = i.quantite_comptee !== null;
                    const ok = counted && i.ecart === 0;
                    return (
                      <div
                        key={i.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            !counted
                              ? "bg-cream text-text-tertiary"
                              : ok
                                ? "bg-success-soft text-success"
                                : "bg-warning-soft text-warning"
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">
                            {scope === "all" && d?.nom + " · "}
                            {e?.prenom ?? "?"} {e?.nom ?? ""}
                          </p>
                          <p className="text-[11px] text-text-tertiary">
                            Théo {i.quantite_attendue ?? "—"} · Compté{" "}
                            {i.quantite_comptee ?? "—"}
                          </p>
                        </div>
                        {counted ? (
                          <span
                            className={`text-xs font-extrabold tabular-nums ${
                              ok ? "text-success" : "text-warning"
                            }`}
                          >
                            {i.ecart > 0 ? "+" : ""}
                            {i.ecart}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-text-tertiary">
                            À compter
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>
    </V2Shell>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}
