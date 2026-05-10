"use client";

import Link from "next/link";
import { AlertOctagon, AlertTriangle, ChevronRight, Sparkles, ShieldCheck } from "lucide-react";
import { timeAgo } from "@/lib/utils/format";
import type { Alert } from "@/lib/types";

const sevConfig = {
  critique: {
    badge: "Critique",
    icon: AlertOctagon,
    iconBg: "bg-danger-soft text-danger",
    badgeClass: "badge-danger",
  },
  recommandation: {
    badge: "Recommandation",
    icon: Sparkles,
    iconBg: "bg-gold-soft text-[#8B6F0E]",
    badgeClass: "badge-gold",
  },
  conformite: {
    badge: "Conformité",
    icon: ShieldCheck,
    iconBg: "bg-success-soft text-success",
    badgeClass: "badge-success",
  },
} as const;

export function AlertCard({ alert, compact }: { alert: Alert; compact?: boolean }) {
  const cfg = sevConfig[alert.severity] ?? sevConfig.recommandation;
  const Icon = cfg.icon;

  return (
    <Link
      href="/alertes"
      className="block bg-white rounded-[20px] shadow-card p-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${cfg.badgeClass}`}>{cfg.badge}</span>
            <span className="text-[11px] text-text-tertiary">{timeAgo(alert.date)}</span>
          </div>
          <p className="text-[14px] font-bold text-text-primary leading-snug">{alert.title}</p>
          {!compact && (
            <p className="text-[13px] text-text-secondary mt-1 line-clamp-2">{alert.description}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-text-tertiary mt-1 shrink-0" />
      </div>
    </Link>
  );
}

export function AlertIconBadge({ severity }: { severity: Alert["severity"] }) {
  const cfg = sevConfig[severity] ?? sevConfig.recommandation;
  const Icon = cfg.icon;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.iconBg}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

export { AlertTriangle };
