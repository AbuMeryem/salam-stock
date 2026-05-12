"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Boxes,
  Building2,
  ClipboardCheck,
  Repeat2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { RevenueChart, type RevenueDataPoint } from "@/components/v2/RevenueChart";
import { DriveDashboardSection } from "@/components/v2/DriveDashboardSection";
import { PushNotifCard } from "@/components/v2/PushNotifCard";
import { EmailRecapCard } from "@/components/v2/EmailRecapCard";
import { StockEditWindowCard } from "@/components/v2/StockEditWindowCard";
import { WhatsAppRecapCard } from "@/components/v2/WhatsAppRecapCard";
import { useV2 } from "@/lib/v2-store";
import {
  listDepots,
  listEmployes,
  listInventairesDuJour,
  listProduitsInDepot,
  listReceptions,
  listRevenueByDay,
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
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [view, setView] = useState<"stock" | "drive">("stock");
  const [loading, setLoading] = useState(true);
  const [showAllDepots, setShowAllDepots] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const ds = await listDepots();
    setDepots(ds);
    const today = new Date().toISOString().slice(0, 10);
    const allEmployes = await listEmployes();
    setEmployes(allEmployes);
    // CA par jour Particulier / Pro (90j max, le chart limite à 7/30/90)
    void listRevenueByDay({ days: 90 })
      .then(setRevenue)
      .catch(() => setRevenue([]));

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

  const emptyReceptions = useMemo(
    () => recentReceptions.filter((r) => r.reception_vide === true),
    [recentReceptions]
  );

  return (
    <V2Shell>
      <PageAccentStripe accent="or-sapin" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Dashboard global</p>
        <h1 className="h1 text-text-primary mt-1">Bonjour {employe?.prenom}</h1>
        <p className="body-md text-text-secondary mt-1">
          {view === "stock"
            ? "Vision unifiée des 3 dépôts en temps réel."
            : "Activité drive client : commandes, créneaux, top produits."}
        </p>

        {/* Raccourcis comptables */}
        <div className="flex flex-wrap gap-2 mt-4">
          <a
            href="/v2/admin/recap-fiscal"
            className="inline-flex items-center gap-2 bg-white border border-rule rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-text-primary shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gold-bright" />
            Récap fiscal du jour
          </a>
          <a
            href="/v2/admin/rapport-mensuel"
            className="inline-flex items-center gap-2 bg-white border border-rule rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-text-primary shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Rapport mensuel
          </a>
          <a
            href="/v2/admin/import-cashmag"
            className="inline-flex items-center gap-2 bg-white border border-rule rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-text-primary shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
            Import Cashmag
          </a>
          <a
            href="/v2/admin/bons-reception"
            className="inline-flex items-center gap-2 bg-white border border-rule rounded-full px-3.5 py-1.5 text-[11.5px] font-bold text-text-primary shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            BR émis
          </a>
          <a
            href="/v2/admin/alertes"
            className="inline-flex items-center gap-2 bg-danger text-white rounded-full px-3.5 py-1.5 text-[11.5px] font-bold shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            Alertes IA
          </a>
          <a
            href="/v2/admin/assistant-ia"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-dark text-gold rounded-full px-3.5 py-1.5 text-[11.5px] font-bold shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Assistant IA
          </a>
        </div>

        {/* TOGGLE Stock / Drive */}
        <div
          role="tablist"
          aria-label="Vue dashboard"
          className="inline-flex bg-white border border-rule rounded-full p-1 mt-4 shadow-card"
        >
          {(["stock", "drive"] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                role="tab"
                aria-selected={active}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-colors min-w-[88px] ${
                  active
                    ? "bg-primary text-white"
                    : "text-text-secondary"
                }`}
              >
                {v === "stock" ? "Vue Stock" : "Vue Drive"}
              </button>
            );
          })}
        </div>
      </header>

      {loading ? (
        <section className="px-5 mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-rule rounded-[20px] p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-24" />
                  <div className="skeleton h-2.5 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="skeleton h-2 w-12" />
                    <div className="skeleton h-4 w-14" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : view === "drive" ? (
        /* ───────── VUE DRIVE ───────── */
        <DriveDashboardSection />
      ) : (
        /* ───────── VUE STOCK ───────── */
        <>
          {/* ┌─ ACTIVITÉ — CA temps réel ─┐ */}
          <p className="px-5 mt-6 section-eyebrow">
            <TrendingUp className="w-3 h-3" />
            Activité du jour
          </p>
          <section className="px-5 mt-2">
            <RevenueChart data={revenue} initialSeries="global" initialPeriod={30} />
          </section>

          {/* ┌─ DÉPÔTS — état multi-dépôts ─┐ */}
          <p className="px-5 mt-7 section-eyebrow">
            <Boxes className="w-3 h-3" />
            État des dépôts
          </p>
          <section className="px-5 mt-2 space-y-3">
            {(showAllDepots ? stats : stats.slice(0, 3)).map((s, idx) => {
              const isEntrepot = s.depot.type === "entrepot";
              return (
                <motion.div
                  key={s.depot.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    ease: [0.22, 0.61, 0.36, 1],
                    delay: idx * 0.05,
                  }}
                  className="bg-white border border-rule rounded-[20px] shadow-card overflow-hidden active:scale-[0.99] transition-transform cursor-pointer"
                  onClick={() => router.push(`/v2/stock?depot=${s.depot.id}`)}
                  role="link"
                  aria-label={`Voir le stock du dépôt ${s.depot.nom}`}
                >
                  {/* C2-F — ruban couleur identifiant le dépôt */}
                  <div
                    aria-hidden
                    className="h-1.5 w-full"
                    style={{
                      background:
                        s.depot.nom === "Particulier"
                          ? "#C9A227"
                          : s.depot.nom === "Professionnel"
                            ? "#0E3B2E"
                            : "#0A2A20",
                    }}
                  />
                  <div className="p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isEntrepot
                          ? "bg-[#0A2A20] text-[#C9A227]"
                          : s.depot.nom === "Particulier"
                            ? "bg-[#FAEDC5] text-[#0E3B2E]"
                            : "bg-[#0E3B2E] text-white"
                      }`}
                    >
                      <Building2 className="w-4 h-4" strokeWidth={2.2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-text-primary leading-tight">
                        {s.depot.nom}
                      </p>
                      <p className="text-[10.5px] text-text-tertiary uppercase tracking-wide mt-0.5 leading-tight">
                        {isEntrepot
                          ? "Entrepôt back-office, pas de drive"
                          : "Point de vente"}
                      </p>
                    </div>
                    {isEntrepot && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0A2A20] text-[#C9A227] rounded-full px-2 py-0.5">
                        Back-office
                      </span>
                    )}
                    {s.ecartsCount > 0 && !isEntrepot && (
                      <span className="badge badge-warning text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        {s.ecartsCount} écart{s.ecartsCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-4 text-left">
                    <Stat label="Produits" value={s.productCount} />
                    <Stat label="Unités" value={s.totalUnits} />
                    <Stat
                      label="Valeur"
                      value={`${Math.round(s.totalValue).toLocaleString("fr-FR")} €`}
                      gold
                    />
                    <Stat
                      label="Mouvts"
                      value={`${s.receptionsToday}↓ ${s.sortiesToday}↑`}
                      hint="24h"
                    />
                  </div>
                  </div>
                </motion.div>
              );
            })}
            {!showAllDepots && stats.length > 3 && (
              <button
                onClick={() => setShowAllDepots(true)}
                className="w-full bg-cream border border-rule rounded-2xl py-3 text-sm font-bold text-primary inline-flex items-center justify-center gap-1.5"
              >
                Voir les {stats.length - 3} autre{stats.length - 3 > 1 ? "s" : ""} dépôt{stats.length - 3 > 1 ? "s" : ""}
              </button>
            )}
            {showAllDepots && stats.length > 3 && (
              <button
                onClick={() => setShowAllDepots(false)}
                className="w-full text-xs font-bold text-text-secondary py-2"
              >
                Replier
              </button>
            )}
          </section>

          {/* EMPTY RECEPTIONS — workflow safety net */}
          {emptyReceptions.length > 0 && (
            <section className="px-5 mt-7">
              <p className="label-caps text-warning mb-3 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Réceptions vides à vérifier
              </p>
              <div className="space-y-2">
                {emptyReceptions.map((r) => {
                  const d = depots.find((x) => x.id === r.depot_id);
                  const e = employes.find((x) => x.id === r.employe_id);
                  return (
                    <div
                      key={r.id}
                      className="bg-warning-soft border border-warning/30 rounded-2xl p-3 flex items-center gap-3"
                    >
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-warning">
                          BL vide · {r.fournisseur ?? "Fournisseur ?"} → {d?.nom ?? "?"}
                        </p>
                        <p className="text-[11px] text-text-secondary line-clamp-1">
                          Validé par {e?.prenom ?? "?"} {e?.nom ?? ""} sans aucun scan — vérifier la livraison.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* IA FLAGS — top 4, le reste sur /v2/admin/alertes */}
          {flaggedSorties.length > 0 && (
            <section className="px-5 mt-7">
              <div className="flex items-center justify-between mb-3">
                <p className="label-caps text-danger inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Alertes IA — sorties à réviser
                </p>
                {flaggedSorties.length > 4 && (
                  <a
                    href="/v2/admin/alertes"
                    className="text-[11px] font-bold text-danger inline-flex items-center gap-0.5"
                  >
                    Voir tout ({flaggedSorties.length}) →
                  </a>
                )}
              </div>
              <div className="space-y-2">
                {flaggedSorties.slice(0, 4).map((s) => (
                  <a
                    key={s.id}
                    href={`/v2/admin/alertes?sortie=${s.id}`}
                    className="bg-danger-soft border border-danger/20 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
                    aria-label="Ouvrir le détail de l'alerte sur le dashboard alertes"
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
                    <span className="text-danger text-xs font-bold">→</span>
                  </a>
                ))}
                {flaggedSorties.length > 4 && (
                  <a
                    href="/v2/admin/alertes"
                    className="block bg-cream border border-rule rounded-2xl p-3 text-center text-[12px] font-bold text-danger active:scale-[0.99] transition-transform"
                  >
                    +{flaggedSorties.length - 4} autre
                    {flaggedSorties.length - 4 > 1 ? "s" : ""} alerte
                    {flaggedSorties.length - 4 > 1 ? "s" : ""} — Tout consulter →
                  </a>
                )}
              </div>
            </section>
          )}

          {/* RECENT — top 4, le reste sur /v2/admin/activite */}
          <section className="px-5 mt-7">
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
              ].sort((a, b) => b.date.localeCompare(a.date));
              const visible = merged.slice(0, 4);
              const hidden = merged.length - 4;
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="label-caps text-primary">Activité 24h</p>
                    {hidden > 0 && (
                      <a
                        href="/v2/admin/activite"
                        className="text-[11px] font-bold text-primary inline-flex items-center gap-0.5"
                      >
                        Voir tout ({merged.length}) →
                      </a>
                    )}
                  </div>
                  {merged.length === 0 ? (
                    <div className="bg-white border border-rule rounded-2xl p-6 text-center">
                      <Sparkles className="w-6 h-6 text-text-tertiary mx-auto mb-2" />
                      <p className="text-sm font-bold text-text-primary">
                        Aucun mouvement sur les dernières 24h
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        Réceptions, sorties et transferts apparaîtront ici
                        dès qu&apos;ils seront validés.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white border border-rule rounded-2xl divide-y divide-rule overflow-hidden">
                      {visible.map((row, i) => (
                        <a
                          key={i}
                          href="/v2/admin/activite"
                          className="block active:bg-cream transition-colors cursor-pointer"
                          aria-label="Voir le détail dans l'activité complète"
                        >
                          <ActivityRow
                            row={row}
                            depots={depots}
                            employes={employes}
                          />
                        </a>
                      ))}
                      {hidden > 0 && (
                        <a
                          href="/v2/admin/activite"
                          className="block bg-cream p-3 text-center text-[12px] font-bold text-primary active:scale-[0.99] transition-transform"
                        >
                          +{hidden} autre{hidden > 1 ? "s" : ""} mouvement
                          {hidden > 1 ? "s" : ""} — Tout consulter →
                        </a>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </section>

          {/* INVENTAIRES TOURNANTS — top 4, le reste sur historique */}
          {recentInventaires.length > 0 && (
            <section className="px-5 mt-7">
              <div className="flex items-center justify-between mb-3">
                <p className="label-caps text-primary inline-flex items-center gap-1">
                  <ClipboardCheck className="w-3 h-3" />
                  Inventaires du jour
                </p>
                {recentInventaires.length > 4 ? (
                  <a
                    href="/v2/inventaire/historique"
                    className="text-[11px] font-bold text-primary inline-flex items-center gap-0.5"
                  >
                    Voir tout ({recentInventaires.length}) →
                  </a>
                ) : (
                  <a
                    href="/v2/inventaire/historique"
                    className="text-[11px] font-bold text-primary inline-flex items-center gap-0.5"
                  >
                    Historique →
                  </a>
                )}
              </div>
              <div className="bg-white border border-rule rounded-2xl divide-y divide-rule overflow-hidden">
                {recentInventaires.slice(0, 4).map((inv) => {
                  const d = depots.find((x) => x.id === inv.depot_id);
                  const e = employes.find((x) => x.id === inv.employe_assigne_id);
                  return (
                    <a
                      key={inv.id}
                      href="/v2/inventaire"
                      className="p-3 flex items-center gap-3 active:bg-cream transition-colors"
                      aria-label={`Ouvrir l'inventaire ${d?.nom ?? ""}`}
                    >
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
                      <span className="text-text-tertiary text-xs ml-1">→</span>
                    </a>
                  );
                })}
                {recentInventaires.length > 4 && (
                  <a
                    href="/v2/inventaire/historique"
                    className="block bg-cream p-3 text-center text-[12px] font-bold text-primary active:scale-[0.99] transition-transform"
                  >
                    +{recentInventaires.length - 4} autre
                    {recentInventaires.length - 4 > 1 ? "s" : ""} inventaire
                    {recentInventaires.length - 4 > 1 ? "s" : ""} —
                    Tout consulter →
                  </a>
                )}
              </div>
            </section>
          )}

          {/* ┌─ COMMUNICATION — notifs, emails, accès édition ─┐ */}
          <p className="px-5 mt-8 section-eyebrow">
            <Bell className="w-3 h-3" />
            Communication & notifs
          </p>
          <section className="px-5 mt-2 grid grid-cols-1 gap-3">
            <PushNotifCard employeId={employe?.id ?? null} />
            <EmailRecapCard defaultTo="ceo@hamy.studio" />
            <StockEditWindowCard
              employeId={employe?.id ?? null}
              employeRole={employe?.role}
            />
          </section>

          {/* Recap WhatsApp 19h — mockup pour la démo */}
          <section className="px-5 mt-3 mb-8">
            <WhatsAppRecapCard />
          </section>
        </>
      )}
    </V2Shell>
  );
}

function Stat({
  label,
  value,
  hint,
  gold,
}: {
  label: string;
  value: string | number;
  hint?: string;
  gold?: boolean;
}) {
  return (
    <div>
      <p className="text-[9.5px] text-text-tertiary uppercase tracking-wide font-bold flex items-baseline gap-1">
        {label}
        {hint && (
          <span className="text-text-tertiary/80 normal-case tracking-normal font-medium">
            · {hint}
          </span>
        )}
      </p>
      <p className={`text-[15px] font-extrabold mt-1 tabular tracking-tight ${gold ? "text-[#C9A227]" : "text-text-primary"}`}>
        {value}
      </p>
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
