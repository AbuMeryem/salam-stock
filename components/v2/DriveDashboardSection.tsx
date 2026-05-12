"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  PackageOpen,
  ShoppingBag,
  TrendingUp,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  listCommandesDrive,
  listDriveRevenueByDay,
  listLignesPourCommande,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
  CommandeDrive,
  CommandeDriveLigne,
  CommandeDriveStatus,
} from "@/lib/types/db";
import {
  DriveRevenueChart,
  type DriveRevenueDataPoint,
} from "./DriveRevenueChart";

interface CommandeAggreg extends CommandeDrive {
  lignes: CommandeDriveLigne[];
}

const STATUT_META: Record<
  CommandeDriveStatus,
  { label: string; icon: typeof Clock; bg: string; fg: string }
> = {
  a_preparer: {
    label: "À préparer",
    icon: Clock,
    bg: "bg-danger-soft",
    fg: "text-danger",
  },
  en_preparation: {
    label: "En préparation",
    icon: Clock,
    bg: "bg-warning-soft",
    fg: "text-warning",
  },
  pret: {
    label: "Prête à retirer",
    icon: CheckCircle2,
    bg: "bg-success-soft",
    fg: "text-success",
  },
  retire: {
    label: "Retirée",
    icon: PackageOpen,
    bg: "bg-cream",
    fg: "text-text-secondary",
  },
  annule: {
    label: "Annulée",
    icon: XCircle,
    bg: "bg-danger-soft",
    fg: "text-danger",
  },
};

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCreneau(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Aujourd'hui · ${time}`;
  if (isTomorrow) return `Demain · ${time}`;
  return (
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) + ` · ${time}`
  );
}

export function DriveDashboardSection() {
  const [commandes, setCommandes] = useState<CommandeAggreg[]>([]);
  const [revenue, setRevenue] = useState<DriveRevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">(
    "connecting"
  );
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  /**
   * Fetch combiné commandes + CA par jour. Appelé au mount ET à chaque
   * event Realtime sur commandes_drive (ou son fallback polling).
   */
  const refetch = useCallback(async () => {
    try {
      const [enPrep, pret, retire, annule] = await Promise.all([
        listCommandesDrive("en_preparation"),
        listCommandesDrive("pret"),
        listCommandesDrive("retire"),
        listCommandesDrive("annule"),
      ]);
      const all = [...enPrep, ...pret, ...retire, ...annule];
      const enriched = await Promise.all(
        all.map(async (c) => ({
          ...c,
          lignes: await listLignesPourCommande(c.id),
        }))
      );
      setCommandes(enriched);

      const rev = await listDriveRevenueByDay({ days: 90 }).catch(() => []);
      setRevenue(rev);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Subscription Supabase Realtime sur commandes_drive + lignes
  // Quand une nouvelle commande arrive (INSERT) ou change (UPDATE),
  // on re-fetch tout le bloc (commandes + revenue). Debounce 600ms
  // pour éviter les rafales sur un import en bulk.
  const refetchDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchDebouncedRef.current) clearTimeout(refetchDebouncedRef.current);
    refetchDebouncedRef.current = setTimeout(() => {
      void refetch();
    }, 600);
  }, [refetch]);

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setLiveStatus("offline");
      return;
    }
    const channel = sb
      .channel("v2-admin-drive")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes_drive" },
        () => scheduleRefetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes_drive_lignes" },
        () => scheduleRefetch()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setLiveStatus("offline");
      });

    // Fallback polling 20s en cas de Realtime cassé
    const poll = setInterval(() => {
      if (liveStatus !== "live") void refetch();
    }, 20_000);

    return () => {
      clearInterval(poll);
      if (refetchDebouncedRef.current)
        clearTimeout(refetchDebouncedRef.current);
      void sb.removeChannel(channel);
    };
  }, [refetch, scheduleRefetch, liveStatus]);

  // KPI par statut
  const byStatut = useMemo(() => {
    const counts: Record<CommandeDriveStatus, number> = {
      a_preparer: 0,
      en_preparation: 0,
      pret: 0,
      retire: 0,
      annule: 0,
    };
    for (const c of commandes) counts[c.statut]++;
    return counts;
  }, [commandes]);

  // CA du jour
  const todayCA = useMemo(() => {
    const today = new Date().toDateString();
    return commandes
      .filter(
        (c) =>
          c.statut !== "annule" &&
          new Date(c.created_at).toDateString() === today
      )
      .reduce((s, c) => s + Number(c.total_ttc), 0);
  }, [commandes]);

  // Créneaux à venir (24h)
  const upcomingSlots = useMemo(() => {
    const now = Date.now();
    const tomorrow = now + 24 * 3600 * 1000;
    const byCreneau = new Map<string, CommandeAggreg[]>();
    commandes
      .filter((c) => c.statut !== "annule" && c.statut !== "retire")
      .filter((c) => {
        const t = new Date(c.creneau_retrait).getTime();
        return t >= now && t <= tomorrow;
      })
      .forEach((c) => {
        const key = c.creneau_retrait;
        const list = byCreneau.get(key) ?? [];
        list.push(c);
        byCreneau.set(key, list);
      });
    return Array.from(byCreneau.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 5);
  }, [commandes]);

  // Top 5 produits (par quantité totale)
  const topProduits = useMemo(() => {
    const byProduit = new Map<string, number>();
    for (const c of commandes) {
      if (c.statut === "annule") continue;
      for (const l of c.lignes) {
        byProduit.set(
          l.produit_id,
          (byProduit.get(l.produit_id) ?? 0) + Number(l.quantite)
        );
      }
    }
    return Array.from(byProduit.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [commandes]);

  const recent = useMemo(
    () =>
      [...commandes]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8),
    [commandes]
  );

  if (loading) {
    return (
      <section className="px-5 mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-rule rounded-[20px] p-4 space-y-2"
          >
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-6 w-24" />
          </div>
        ))}
      </section>
    );
  }

  if (commandes.length === 0) {
    return (
      <section className="px-5 mt-5">
        <div className="bg-white border border-rule rounded-[20px] p-8 text-center">
          <ShoppingBag className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm font-bold text-text-primary">
            Pas encore de commande drive
          </p>
          <p className="text-xs text-text-secondary mt-1.5 max-w-[280px] mx-auto">
            Les commandes passées sur Salamarket Drive apparaîtront ici
            automatiquement.
          </p>
        </div>
      </section>
    );
  }

  const liveLabel =
    liveStatus === "live"
      ? "Temps réel"
      : liveStatus === "connecting"
        ? "Connexion…"
        : "Polling 20s";
  const liveDotColor =
    liveStatus === "live"
      ? "#22D67A"
      : liveStatus === "connecting"
        ? "#F2C314"
        : "#9CA3AF";
  const sinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  return (
    <>
      {/* CHART CA Drive — courbe néon violet */}
      <section className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] inline-flex items-center gap-1.5 font-bold uppercase tracking-wide text-text-secondary">
            <span className="relative inline-flex">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: liveDotColor }}
              />
              {liveStatus === "live" && (
                <span
                  className="absolute inset-0 w-2 h-2 rounded-full animate-ping"
                  style={{ background: liveDotColor, opacity: 0.55 }}
                />
              )}
            </span>
            {liveLabel}
          </p>
          <p className="text-[10.5px] text-text-tertiary tabular">
            {sinceUpdate < 5
              ? "à l'instant"
              : sinceUpdate < 60
                ? `il y a ${sinceUpdate}s`
                : `il y a ${Math.floor(sinceUpdate / 60)} min`}
          </p>
        </div>
        <DriveRevenueChart data={revenue} initialPeriod={30} />
      </section>

      {/* KPI ligne */}
      <section className="px-5 mt-5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="bg-white border border-rule rounded-[20px] p-4 shadow-card"
        >
          <p className="section-eyebrow">
            <TrendingUp className="w-3 h-3" />
            Drive aujourd&apos;hui
          </p>
          <p className="text-[28px] font-extrabold tracking-tight text-text-primary mt-1.5 tabular leading-none">
            {formatEUR(todayCA)}
          </p>
          <p className="text-[12px] text-text-secondary mt-1">
            {byStatut.en_preparation + byStatut.pret} commande
            {byStatut.en_preparation + byStatut.pret > 1 ? "s" : ""} active
            {byStatut.en_preparation + byStatut.pret > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {(Object.keys(STATUT_META) as CommandeDriveStatus[]).map((s) => {
              const meta = STATUT_META[s];
              const Icon = meta.icon;
              return (
                <div key={s} className="text-center">
                  <span
                    className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${meta.bg} ${meta.fg} mb-1`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.2} />
                  </span>
                  <p className="text-[15px] font-extrabold text-text-primary tabular leading-none">
                    {byStatut[s]}
                  </p>
                  <p className="text-[9.5px] text-text-tertiary uppercase tracking-wide font-bold mt-1 leading-tight">
                    {meta.label}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Créneaux à venir 24h */}
      {upcomingSlots.length > 0 && (
        <section className="px-5 mt-7">
          <p className="section-eyebrow mb-3">
            <Clock className="w-3 h-3" />
            Créneaux 24h
          </p>
          <div className="bg-white border border-rule rounded-[20px] divide-y divide-rule overflow-hidden">
            {upcomingSlots.map(([creneau, cmds]) => {
              const total = cmds.reduce(
                (s, c) => s + Number(c.total_ttc),
                0
              );
              return (
                <div
                  key={creneau}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="inline-flex w-9 h-9 rounded-xl bg-gold-soft text-primary-dark items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-text-primary leading-tight">
                      {formatCreneau(creneau)}
                    </p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {cmds.length} commande{cmds.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-[14px] font-extrabold text-primary tabular shrink-0">
                    {formatEUR(total)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top produits */}
      {topProduits.length > 0 && (
        <section className="px-5 mt-7">
          <p className="section-eyebrow mb-3">
            <ShoppingBag className="w-3 h-3" />
            Top 5 produits commandés
          </p>
          <div className="bg-white border border-rule rounded-[20px] divide-y divide-rule overflow-hidden">
            {topProduits.map(([produitId, qty], idx) => (
              <div
                key={produitId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-[12px] font-extrabold ${
                    idx === 0
                      ? "bg-primary text-white"
                      : "bg-cream text-text-primary"
                  } tabular shrink-0`}
                >
                  {idx + 1}
                </span>
                <p className="text-[13px] font-bold text-text-primary truncate flex-1 mono">
                  {produitId.slice(0, 8)}…
                </p>
                <p className="text-[14px] font-extrabold text-primary tabular shrink-0">
                  ×{qty}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-text-tertiary text-center mt-2">
            (ID produit Supabase. Le nom complet viendra dans une prochaine
            itération.)
          </p>
        </section>
      )}

      {/* Commandes récentes */}
      <section className="px-5 mt-7 mb-2">
        <p className="section-eyebrow mb-3">
          <AlertCircle className="w-3 h-3" />
          Commandes récentes
        </p>
        <div className="bg-white border border-rule rounded-[20px] divide-y divide-rule overflow-hidden">
          {recent.map((c) => {
            const meta = STATUT_META[c.statut];
            const Icon = meta.icon;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${meta.bg} ${meta.fg} shrink-0`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text-primary leading-tight truncate">
                    {c.numero_commande}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                    {c.client_nom} · {meta.label.toLowerCase()}
                  </p>
                </div>
                <p className="text-[13px] font-extrabold text-text-primary tabular shrink-0">
                  {formatEUR(Number(c.total_ttc))}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
