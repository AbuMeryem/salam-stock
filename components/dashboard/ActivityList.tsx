"use client";

import { ClipboardList, AlertTriangle, Sparkles, Box } from "lucide-react";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils/format";
import type { ActivityEntry } from "@/lib/types";

const iconMap = {
  reception: ClipboardList,
  inventaire: Box,
  alerte: AlertTriangle,
  produit: Sparkles,
} as const;

const colorMap = {
  reception: "bg-success-soft text-success",
  inventaire: "bg-gold-soft text-[#8B6F0E]",
  alerte: "bg-danger-soft text-danger",
  produit: "bg-cream text-primary",
} as const;

export function ActivityList({ entries, max = 5 }: { entries: ActivityEntry[]; max?: number }) {
  const users = useStore((s) => s.users);
  const list = entries.slice(0, max);

  return (
    <div className="bg-white rounded-[20px] shadow-card divide-y divide-line-light">
      {list.map((a) => {
        const Icon = iconMap[a.type];
        const u = users.find((x) => x.id === a.user_id);
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorMap[a.type]}`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-text-primary leading-snug">
                {a.label}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {u?.name ?? "Système"} · {timeAgo(a.date)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
