"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface KpiCardProps {
  label: string;
  value: string | ReactNode;
  comparison?: string;
  delta?: { value: number; positive: boolean };
  href?: string;
  chart?: ReactNode;
  accent?: "default" | "danger";
}

export function KpiCard({ label, value, comparison, delta, href, chart, accent = "default" }: KpiCardProps) {
  const Body = (
    <div className="bg-white rounded-[20px] shadow-card p-5 relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="label-caps text-primary mb-2">{label}</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className={cn(
              "text-[34px] font-extrabold leading-none tracking-tight",
              accent === "danger" ? "text-danger" : "text-text-primary"
            )}>
              {value}
            </p>
            {delta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full",
                  delta.positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                )}
              >
                {delta.positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {delta.positive ? "+" : ""}
                {delta.value}%
              </span>
            )}
          </div>
          {comparison && (
            <p className="text-xs text-text-secondary mt-2">{comparison}</p>
          )}
        </div>
        {href && (
          <span className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-primary shrink-0">
            <ChevronRight className="w-5 h-5" />
          </span>
        )}
      </div>
      {chart && <div className="mt-4 -mx-1">{chart}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:scale-[0.99] transition-transform">
        {Body}
      </Link>
    );
  }
  return Body;
}
