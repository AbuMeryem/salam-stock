"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, Check, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { AlertIconBadge } from "@/components/dashboard/AlertCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { timeAgo } from "@/lib/utils/format";
import type { Alert } from "@/lib/types";

const filters = ["Toutes", "Critiques", "Recommandations", "Conformité"] as const;

export default function AlertesPage() {
  const alerts = useStore((s) => s.alerts);
  const markTreated = useStore((s) => s.markAlertTreated);
  const [filter, setFilter] = useState<typeof filters[number]>("Toutes");
  const [active, setActive] = useState<Alert | null>(null);

  const filtered = useMemo(() => {
    let list = [...alerts].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === "Critiques") list = list.filter((a) => a.severity === "critique");
    if (filter === "Recommandations")
      list = list.filter((a) => a.severity === "recommandation");
    if (filter === "Conformité") list = list.filter((a) => a.severity === "conformite");
    return list;
  }, [alerts, filter]);

  function action(label: string, alert: Alert) {
    if (label === "Marquer traité") {
      markTreated(alert.id);
      toast.success("Alerte marquée comme traitée");
    } else if (label === "Notifier équipe") {
      toast.success("Notification envoyée à l'équipe");
    } else if (label === "Investiguer") {
      toast.info("Investigation enregistrée — Otmane prévenu");
    }
    setActive(null);
  }

  return (
    <PageWrapper>
      <PageHeader
        label="INTELLIGENCE"
        title="Centre d'alertes"
        subtitle="Surveillance temps réel propulsée par l'assistant Salam"
        rightSlot={
          <span className="hidden sm:inline-flex items-center gap-1 badge !bg-white/10 !text-gold">
            <Sparkles className="w-3 h-3" /> IA
          </span>
        }
      />

      <div className="px-5 mt-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 pb-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-active={filter === f}
              className="pill-filter"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 space-y-3">
        {filtered.length === 0 && <EmptyState icon={BellRing} title="Aucune alerte" />}
        {filtered.map((a) => (
          <button
            key={a.id}
            onClick={() => setActive(a)}
            className={`w-full text-left bg-white rounded-[20px] shadow-card p-4 active:scale-[0.99] transition-transform ${
              a.treated ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertIconBadge severity={a.severity} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`badge ${
                      a.severity === "critique"
                        ? "badge-danger"
                        : a.severity === "recommandation"
                        ? "badge-gold"
                        : "badge-success"
                    }`}
                  >
                    {a.severity === "critique"
                      ? "Critique"
                      : a.severity === "recommandation"
                      ? "Recommandation"
                      : "Conformité"}
                  </span>
                  <span className="text-[11px] text-text-tertiary">{timeAgo(a.date)}</span>
                  {a.treated && (
                    <span className="badge badge-neutral">
                      <Check className="w-3 h-3" /> Traitée
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-bold text-text-primary leading-snug">{a.title}</p>
                <p className="text-[13px] text-text-secondary mt-1 line-clamp-2">{a.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-[70] fixed-overlay flex items-end justify-center">
          <div className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-10 animate-slide-up">
            <div className="flex items-start gap-3">
              <AlertIconBadge severity={active.severity} />
              <div className="flex-1 min-w-0">
                <span
                  className={`badge ${
                    active.severity === "critique"
                      ? "badge-danger"
                      : active.severity === "recommandation"
                      ? "badge-gold"
                      : "badge-success"
                  }`}
                >
                  {active.severity === "critique"
                    ? "Critique"
                    : active.severity === "recommandation"
                    ? "Recommandation"
                    : "Conformité"}
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-2 leading-tight">
                  {active.title}
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {timeAgo(active.date)}
                </p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mt-4 leading-relaxed">
              {active.description}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {!active.treated && (
                <button
                  onClick={() => action("Marquer traité", active)}
                  className="btn-primary w-full"
                >
                  <Check className="w-4 h-4" /> Marquer comme traité
                </button>
              )}
              <button
                onClick={() => action("Investiguer", active)}
                className="btn-ghost w-full"
              >
                <AlertTriangle className="w-4 h-4" /> Investiguer
              </button>
              <button
                onClick={() => action("Notifier équipe", active)}
                className="btn-ghost w-full"
              >
                <Send className="w-4 h-4" /> Notifier l&apos;équipe
              </button>
              <button
                onClick={() => setActive(null)}
                className="text-text-secondary text-sm font-semibold mt-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
