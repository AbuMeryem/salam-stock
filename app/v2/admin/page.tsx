"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  Package,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { useV2 } from "@/lib/v2-store";
import {
  listDepots,
  listEmployes,
  listInventairesDuJour,
  listProduitsInDepot,
  listReceptions,
  listSorties,
  listTransferts,
} from "@/lib/db";
import type {
  Depot,
  Employe,
  InventaireTournant,
  Reception,
  SortieStock,
  SortieType,
  TransfertInterDepot,
} from "@/lib/types/db";

const SORTIE_LABEL: Record<SortieType, string> = {
  casse_manipulation: "Casse manip.",
  casse_client: "Casse client",
  perime_dlc: "Périmé DLC",
  perime_ddm: "Périmé DDM",
  defaut_fournisseur: "Défaut fourn.",
  demarque_inconnue: "Démarque inconnue",
  autre: "Autre motif",
};

interface DepotStats {
  depot: Depot;
  productCount: number;
  totalUnits: number;
  totalValue: number;
  receptionsToday: number;
  sortiesToday: number;
  ecartsCount: number;
}

export default function V2AdminDashboardPage() {
  const router = useRouter();
  const employe = useV2((s) => s.currentEmploye);

  const [depots, setDepots] = useState<Depot[]>([]);
  const [stats, setStats] = useState<DepotStats[]>([]);
  const [recentReceptions, setRecentReceptions] = useState<Reception[]>([]);
  const [recentSorties, setRecentSorties] = useState<SortieStock[]>([]);
  const [recentTransferts, setRecentTransferts] = useState<TransfertInterDepot[]>([]);
  const [recentInventaires, setRecentInventaires] = useState<InventaireTournant[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const ds = await listDepots();
    setDepots(ds);
    const today = new Date().toISOString().slice(0, 10);
    const allEmployes = await listEmployes();
    setEmployes(allEmployes);

    const computed: DepotStats[] = await Promise.all(
      ds.map(async (d) => {
        const stock = await listProduitsInDepot(d.id);
        const receptions = await listReceptions({ depotId: d.id, limit: 100 });
        const sorties = await listSorties({ depotId: d.id, limit: 100 });
        const inventaires = await listInventairesDuJour({ depotId: d.id });
        const isToday = (iso: string) => iso.slice(0, 10) === today;
        return {
          depot: d,
          productCount: stock.length,
          totalUnits: stock.reduce((s, p) => s + p.quantite, 0),
          totalValue: stock.reduce(
            (s, p) => s + p.quantite * (p.prix_vente ?? 0),
            0
          ),
          receptionsToday: receptions.filter((r) => isToday(r.created_at)).length,
          sortiesToday: sorties.filter((r) => isToday(r.created_at)).length,
          ecartsCount: inventaires.filter(
            (i) => i.quantite_comptee !== null && i.ecart !== 0
          ).length,
        };
      })
    );
    setStats(computed);

    const allReceptions: Reception[] = [];
    const allSorties: SortieStock[] = [];
    const allTransferts = await listTransferts({ limit: 30 });
    for (const d of ds) {
      allReceptions.push(...(await listReceptions({ depotId: d.id, limit: 10 })));
      allSorties.push(...(await listSorties({ depotId: d.id, limit: 10 })));
    }
    setRecentReceptions(
      allReceptions.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)
    );
    setRecentSorties(
      allSorties.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)
    );
    setRecentTransferts(allTransferts.slice(0, 5));

    // Inventaires aggregated
    const allInv: InventaireTournant[] = [];
    for (const d of ds) {
      allInv.push(...(await listInventairesDuJour({ depotId: d.id })));
    }
    setRecentInventaires(allInv.slice(0, 10));

    setLoading(false);
  }

  const flaggedSorties = useMemo(
    () =>
      recentSorties.filter(
        (s) => s.ia_coherence_score !== null && s.ia_coherence_score < 0.6
      ),
    [recentSorties]
  );

  return (
    <V2Shell>
      <header className="px-5 pt-5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-primary mt-3">Dashboard global</p>
        <h1 className="h1 text-text-primary mt-1">Bonjour {employe?.prenom}</h1>
        <p className="body-md text-text-secondary mt-1">
          Vision unifiée des 3 dépôts en temps réel.
        </p>
      </header>

      {loading ? (
        <p className="px-5 pt-10 text-center text-text-secondary">Chargement…</p>
      ) : (
        <>
          {/* DEPOT GRID */}
          <section className="px-5 mt-5 space-y-3">
            {stats.map((s) => (
              <div
                key={s.depot.id}
                className="bg-white border border-rule rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      s.depot.type === "entrepot"
                        ? "bg-gold-soft text-primary-dark"
                        : "bg-cream text-primary"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-base font-bold text-text-primary">
                      {s.depot.nom}
                    </p>
                    <p className="text-[11px] text-text-tertiary uppercase tracking-wide">
                      {s.depot.type === "entrepot" ? "Entrepôt" : "Point de vente"}
                    </p>
                  </div>
                  {s.ecartsCount > 0 && (
                    <span className="badge badge-warning text-[10px]">
                      <AlertTriangle className="w-3 h-3" />
                      {s.ecartsCount} écart{s.ecartsCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <Stat label="Produits" value={s.productCount} />
                  <Stat label="Unités" value={s.totalUnits} />
                  <Stat
                    label="Valeur"
                    value={`${Math.round(s.totalValue).toLocaleString("fr-FR")} €`}
                  />
                  <Stat
                    label="Mouvts 24h"
                    value={`${s.receptionsToday}↓ ${s.sortiesToday}↑`}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* IA FLAGS */}
          {flaggedSorties.length > 0 && (
            <section className="px-5 mt-7">
              <p className="label-caps text-danger mb-3 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Alertes IA — sorties à réviser
              </p>
              <div className="space-y-2">
                {flaggedSorties.map((s) => (
                  <div
                    key={s.id}
                    className="bg-danger-soft border border-danger/20 rounded-2xl p-3 flex items-center gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-danger">
                        Score {Math.round((s.ia_coherence_score ?? 0) * 100)}%
                        · {s.type}
                      </p>
                      <p className="text-[11px] text-text-secondary line-clamp-1">
                        {s.ia_coherence_notes}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* RECENT */}
          <section className="px-5 mt-7">
            <p className="label-caps text-primary mb-3">Activité 24h</p>
            {(() => {
              const merged = [
                ...recentReceptions.map((r) => ({
                  type: "rec" as const,
                  date: r.created_at,
                  item: r,
                })),
                ...recentSorties.map((s) => ({
                  type: "sor" as const,
                  date: s.created_at,
                  item: s,
                })),
                ...recentTransferts.map((t) => ({
                  type: "trf" as const,
                  date: t.created_at,
                  item: t,
                })),
              ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
              if (merged.length === 0) {
                return (
                  <div className="bg-white border border-rule rounded-2xl p-6 text-center">
                    <Sparkles className="w-6 h-6 text-text-tertiary mx-auto mb-2" />
                    <p className="text-sm font-bold text-text-primary">
                      Aucun mouvement sur les dernières 24h
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      Réceptions, sorties et transferts apparaîtront ici dès qu&apos;ils seront validés.
                    </p>
                  </div>
                );
              }
              return (
                <div className="bg-white border border-rule rounded-2xl divide-y divide-rule overflow-hidden">
                  {merged.map((row, i) => (
                    <ActivityRow
                      key={i}
                      row={row}
                      depots={depots}
                      employes={employes}
                    />
                  ))}
                </div>
              );
            })()}
          </section>

          {/* INVENTAIRES TOURNANTS */}
          {recentInventaires.length > 0 && (
            <section className="px-5 mt-7">
              <div className="flex items-center justify-between mb-3">
                <p className="label-caps text-primary inline-flex items-center gap-1">
                  <ClipboardCheck className="w-3 h-3" />
                  Inventaires du jour
                </p>
                <a
                  href="/v2/inventaire/historique"
                  className="text-[11px] font-bold text-primary inline-flex items-center gap-0.5"
                >
                  Historique →
                </a>
              </div>
              <div className="bg-white border border-rule rounded-2xl divide-y divide-rule">
                {recentInventaires.map((inv) => {
                  const d = depots.find((x) => x.id === inv.depot_id);
                  const e = employes.find((x) => x.id === inv.employe_assigne_id);
                  return (
                    <div key={inv.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {d?.nom} · {e?.prenom} {e?.nom}
                        </p>
                        <p className="text-[11px] text-text-tertiary">
                          Théo {inv.quantite_attendue ?? "—"} · Compté{" "}
                          {inv.quantite_comptee ?? "—"}
                        </p>
                      </div>
                      <span
                        className={`badge text-[10px] ${
                          inv.statut === "valide"
                            ? "badge-success"
                            : inv.statut === "compte"
                              ? Math.abs(inv.ecart) > 2
                                ? "badge-warning"
                                : "badge-success"
                              : "badge-neutral"
                        }`}
                      >
                        {inv.statut === "assigne"
                          ? "À compter"
                          : inv.ecart === 0
                            ? "Conforme"
                            : `Écart ${inv.ecart > 0 ? "+" : ""}${inv.ecart}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </V2Shell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] text-text-tertiary uppercase tracking-wide font-bold">
        {label}
      </p>
      <p className="text-sm font-extrabold text-text-primary mt-0.5">{value}</p>
    </div>
  );
}

function ActivityRow({
  row,
  depots,
  employes,
}: {
  row:
    | { type: "rec"; date: string; item: Reception }
    | { type: "sor"; date: string; item: SortieStock }
    | { type: "trf"; date: string; item: TransfertInterDepot };
  depots: Depot[];
  employes: Employe[];
}) {
  if (row.type === "rec") {
    const d = depots.find((x) => x.id === row.item.depot_id);
    const e = employes.find((x) => x.id === row.item.employe_id);
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
          <ArrowDownToLine className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-text-primary">
            Réception {row.item.fournisseur ?? "fournisseur"} → {d?.nom}
          </p>
          <p className="text-[10px] text-text-tertiary">
            {e?.prenom} {e?.nom} · {timeAgo(row.date)}
          </p>
        </div>
      </div>
    );
  }
  if (row.type === "sor") {
    const d = depots.find((x) => x.id === row.item.depot_id);
    const e = employes.find((x) => x.id === row.item.employe_id);
    const lowScore =
      row.item.ia_coherence_score !== null && row.item.ia_coherence_score < 0.6;
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          lowScore ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
        }`}>
          <ArrowUpRight className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-text-primary">
            Sortie {SORTIE_LABEL[row.item.type] ?? row.item.type} × {row.item.quantite} · {d?.nom}
          </p>
          <p className="text-[10px] text-text-tertiary">
            {e?.prenom} {e?.nom} · {timeAgo(row.date)}
            {row.item.ia_coherence_score !== null && (
              <> · IA {Math.round(row.item.ia_coherence_score * 100)}%</>
            )}
          </p>
        </div>
      </div>
    );
  }
  // transfert
  const ds = depots.find((x) => x.id === row.item.depot_source_id);
  const dd = depots.find((x) => x.id === row.item.depot_destination_id);
  const e = employes.find((x) => x.id === row.item.employe_id);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-8 h-8 rounded-lg bg-gold-soft text-primary-dark flex items-center justify-center">
        <Repeat2 className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-text-primary">
          Transfert {ds?.nom} → {dd?.nom} · qté {row.item.quantite}
        </p>
        <p className="text-[10px] text-text-tertiary">
          {e?.prenom} {e?.nom} · {timeAgo(row.date)}
        </p>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  return `${j} j`;
}
