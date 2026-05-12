"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  PackageCheck,
  PlayCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { PriceTag } from "@/components/v2/PriceTag";
import {
  ClientTypeBadgeGroup,
  type ClientType,
} from "@/components/v2/ClientTypeBadge";
import {
  listCommandesDrive,
  listLignesPourCommande,
  setCommandeStatut,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
  CommandeDrive,
  CommandeDriveLigne,
  ZonePreparationDrive,
} from "@/lib/types/db";

interface CommandeWithLignes extends CommandeDrive {
  lignes: CommandeDriveLigne[];
}

type KanbanStatut = "a_preparer" | "en_preparation" | "pret" | "retire";

const COLUMNS: Array<{
  key: KanbanStatut;
  label: string;
  next: KanbanStatut | null;
  nextLabel: string | null;
  accent: string;
  textAccent: string;
}> = [
  {
    key: "a_preparer",
    label: "À préparer",
    next: "en_preparation",
    nextLabel: "Accepter la commande",
    accent: "bg-danger-soft border-danger/30",
    textAccent: "text-danger",
  },
  {
    key: "en_preparation",
    label: "En préparation",
    next: "pret",
    nextLabel: "Marquer prête",
    accent: "bg-warning-soft border-warning/30",
    textAccent: "text-warning",
  },
  {
    key: "pret",
    label: "Prêtes au retrait",
    next: "retire",
    nextLabel: "Marquer retirée",
    accent: "bg-gold-soft border-gold/30",
    textAccent: "text-primary-dark",
  },
  {
    key: "retire",
    label: "Retirées",
    next: null,
    nextLabel: null,
    accent: "bg-success-soft border-success/20",
    textAccent: "text-success",
  },
];

function clientTypeFromZone(z: ZonePreparationDrive | string): ClientType {
  if (z === "professionnel") return "pro";
  if (z === "traiteur") return "traiteur";
  return "particulier";
}

function formatHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export default function V2PreparationKanbanPage() {
  const [commandes, setCommandes] = useState<CommandeWithLignes[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFor, setActionFor] = useState<CommandeWithLignes | null>(null);
  const [updating, setUpdating] = useState(false);
  const [isLive, setIsLive] = useState(false);

  async function reload() {
    const cmds = await listCommandesDrive();
    const enriched = await Promise.all(
      cmds.map(async (c) => ({
        ...c,
        lignes: await listLignesPourCommande(c.id),
      }))
    );
    // Garde uniquement les statuts kanban (filtre "annule" en dehors)
    setCommandes(enriched.filter((c) => c.statut !== "annule"));
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // Realtime : suivre les changements de statut/lignes en live.
    // Si Realtime indispo (mode local), fallback polling 12s.
    const sb = supabase();
    if (!sb) {
      const t = setInterval(() => void reload(), 12_000);
      return () => clearInterval(t);
    }
    const ch = sb
      .channel("kanban-drive")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes_drive" },
        () => {
          void reload();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes_drive_lignes" },
        () => {
          void reload();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setIsLive(true);
      });
    return () => {
      ch.unsubscribe();
    };
  }, []);

  const byColumn = useMemo(() => {
    const map = new Map<KanbanStatut, CommandeWithLignes[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const c of commandes) {
      if (
        c.statut === "a_preparer" ||
        c.statut === "en_preparation" ||
        c.statut === "pret" ||
        c.statut === "retire"
      ) {
        map.get(c.statut)!.push(c);
      }
    }
    // Sort each column by créneau ascendant
    for (const list of map.values()) {
      list.sort((a, b) => a.creneau_retrait.localeCompare(b.creneau_retrait));
    }
    return map;
  }, [commandes]);

  async function advance(cmd: CommandeWithLignes, target: KanbanStatut) {
    setUpdating(true);
    try {
      await setCommandeStatut(cmd.id, target);
      const label =
        target === "en_preparation"
          ? "acceptée · en préparation"
          : target === "pret"
            ? "marquée prête"
            : "marquée retirée";
      toast.success(`${cmd.numero_commande} ${label}`, { duration: 1800 });
      setActionFor(null);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <V2Shell>
      <PageAccentStripe accent="sapin-or" />
      <header className="px-5 pt-7">
        <BackButton />
        <div className="flex items-end justify-between gap-3 mt-3">
          <div>
            <p className="label-caps text-primary">Préparation drive</p>
            <h1 className="h1 text-text-primary mt-1">
              Kanban des commandes
            </h1>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
              isLive
                ? "bg-success-soft text-success"
                : "bg-cream text-text-tertiary"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? "bg-success animate-pulse" : "bg-text-tertiary"
              }`}
            />
            {isLive ? "Temps réel" : "Polling 12s"}
          </span>
        </div>
      </header>

      {loading ? (
        <p className="px-5 py-10 text-center text-text-secondary">Chargement…</p>
      ) : (
        <div className="px-5 mt-5 space-y-6 pb-12">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col.key) ?? [];
            return (
              <section key={col.key}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <p className={`label-caps ${col.textAccent}`}>{col.label}</p>
                  <span className="text-[12px] font-extrabold tabular text-text-primary">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div
                    className={`border rounded-2xl p-4 text-center text-[12px] text-text-tertiary ${col.accent}`}
                  >
                    Aucune commande dans cette colonne.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((cmd) => {
                      const totalLignes = cmd.lignes.length;
                      const prepares = cmd.lignes.filter(
                        (l) => l.statut_preparation === "prepare"
                      ).length;
                      const types = Array.from(
                        new Set(
                          cmd.lignes.map((l) =>
                            clientTypeFromZone(l.zone_preparation)
                          )
                        )
                      );
                      const isFinal = col.key === "retire";
                      return (
                        <motion.div
                          key={cmd.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                          className={`bg-white border rounded-2xl p-3.5 shadow-card ${col.accent.split(" ")[1]}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[14px] font-extrabold text-text-primary">
                                {cmd.numero_commande}
                              </p>
                              <p className="text-[11.5px] text-text-secondary truncate">
                                {cmd.client_nom}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide bg-cream text-text-primary px-2 py-1 rounded-full`}
                            >
                              <Clock className="w-3 h-3" />
                              {formatHeure(cmd.creneau_retrait)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            <ClientTypeBadgeGroup size="sm" types={types} />
                            <span className="text-[11px] text-text-secondary inline-flex items-center gap-1 ml-auto">
                              {prepares}/{totalLignes} préparés
                              <PriceTag
                                amount={cmd.total_ttc}
                                decimals={0}
                                className="ml-1"
                              />
                            </span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Link
                              href={`/v2/preparation/${cmd.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold text-primary bg-cream rounded-full py-2 active:scale-[0.98] transition-transform"
                            >
                              Détail
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                            {!isFinal && (
                              <button
                                onClick={() => setActionFor(cmd)}
                                className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold text-white bg-primary rounded-full py-2 active:scale-[0.98] transition-transform"
                              >
                                Avancer
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Action sheet */}
      <AnimatePresence>
        {actionFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setActionFor(null)}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-8 shadow-card-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="label-caps text-text-tertiary">Commande</p>
                  <h2 className="text-[18px] font-extrabold text-text-primary mt-0.5">
                    {actionFor.numero_commande}
                  </h2>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    {actionFor.client_nom}
                  </p>
                </div>
                <button onClick={() => setActionFor(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
              <div className="space-y-2 mt-4">
                {actionFor.statut === "a_preparer" && (
                  <button
                    onClick={() => void advance(actionFor, "en_preparation")}
                    disabled={updating}
                    className="w-full bg-primary text-white rounded-[18px] py-3.5 px-5 flex items-center justify-center gap-2 font-bold shadow-card active:scale-[0.99] disabled:opacity-50"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Accepter et commencer la préparation
                  </button>
                )}
                {actionFor.statut === "en_preparation" && (
                  <button
                    onClick={() => void advance(actionFor, "pret")}
                    disabled={updating}
                    className="w-full bg-gold-bright text-primary-dark rounded-[18px] py-3.5 px-5 flex items-center justify-center gap-2 font-bold shadow-card active:scale-[0.99] disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Marquer prête au retrait
                  </button>
                )}
                {actionFor.statut === "pret" && (
                  <button
                    onClick={() => void advance(actionFor, "retire")}
                    disabled={updating}
                    className="w-full bg-success text-white rounded-[18px] py-3.5 px-5 flex items-center justify-center gap-2 font-bold shadow-card active:scale-[0.99] disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marquer retirée par le client
                  </button>
                )}
                <Link
                  href={`/v2/preparation/${actionFor.id}`}
                  className="w-full bg-white border border-rule text-text-primary rounded-[18px] py-3 px-5 flex items-center justify-center gap-2 font-bold active:scale-[0.99] transition-transform"
                >
                  <PlayCircle className="w-4 h-4 text-primary" />
                  Ouvrir le détail
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </V2Shell>
  );
}
