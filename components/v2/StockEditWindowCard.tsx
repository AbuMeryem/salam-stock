"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock, ClipboardCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  closeStockEditWindow,
  listStockEditWindows,
  openStockEditWindow,
  type StockEditWindow,
} from "@/lib/db/stock-edit";
import { listDepots } from "@/lib/db";
import type { Depot } from "@/lib/types/db";

interface Props {
  /** Employé courant (admin attendu sinon le toggle s'affiche en lecture). */
  employeId: string | null;
  employeRole: string | undefined;
}

export function StockEditWindowCard({ employeId, employeRole }: Props) {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [windows, setWindows] = useState<StockEditWindow[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const isAdmin = employeRole === "admin";

  async function refresh() {
    const [d, w] = await Promise.all([listDepots(), listStockEditWindows()]);
    setDepots(d);
    setWindows(w);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggle(depotId: string, open: boolean) {
    if (!employeId) {
      toast.error("Employé non identifié");
      return;
    }
    if (!isAdmin) {
      toast.error("Réservé aux admins");
      return;
    }
    setPending(depotId);
    try {
      if (open) {
        await openStockEditWindow({
          depot_id: depotId,
          employe_id: employeId,
          raison: "Inventaire complet",
        });
        toast.success("Fenêtre ouverte — employés autorisés à modifier le stock");
      } else {
        await closeStockEditWindow({ depot_id: depotId, employe_id: employeId });
        toast.success("Fenêtre fermée — accès employés révoqué");
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPending(null);
    }
  }

  // Cache Sodrune (entrepôt back-office, pas de besoin inventaire complet)
  const visibleDepots = depots.filter((d) => d.type !== "entrepot");

  return (
    <div className="bg-white rounded-2xl border border-rule p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold-soft text-primary-dark">
          <ClipboardCheck className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-primary leading-tight">
            Inventaire complet — édition stock
          </p>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
            Par défaut, seul l&apos;admin modifie le stock. Pendant l&apos;inventaire complet, ouvre la fenêtre pour autoriser les employés. Toute modification est tracée.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {visibleDepots.length === 0 && (
          <p className="text-xs text-text-tertiary">Chargement…</p>
        )}
        {visibleDepots.map((d) => {
          const w = windows.find((x) => x.depot_id === d.id);
          const open = Boolean(w?.is_open);
          const busy = pending === d.id;
          return (
            <div
              key={d.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                open ? "bg-success-soft border-success/25" : "bg-cream border-rule"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary leading-tight">
                  {d.nom}
                </p>
                <p className="text-[10.5px] text-text-secondary mt-0.5 inline-flex items-center gap-1">
                  {open ? (
                    <>
                      <Unlock className="w-3 h-3 text-success" />
                      Ouverte{w?.opened_at && ` · ${formatTimeAgo(w.opened_at)}`}
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" />
                      Fermée{w?.closed_at && ` · ${formatTimeAgo(w.closed_at)}`}
                    </>
                  )}
                </p>
              </div>
              <button
                disabled={!isAdmin || busy}
                onClick={() => void toggle(d.id, !open)}
                className={`text-xs font-bold rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  open
                    ? "bg-danger text-white"
                    : "bg-primary text-white"
                }`}
              >
                {busy ? "…" : open ? "Fermer" : "Ouvrir"}
              </button>
            </div>
          );
        })}
      </div>

      {!isAdmin && (
        <p className="text-[10.5px] text-text-tertiary mt-2 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Lecture seule — admin uniquement peut ouvrir/fermer.
        </p>
      )}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const j = Math.floor(h / 24);
  return `${j} j`;
}
