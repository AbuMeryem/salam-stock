"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { listDepots } from "@/lib/db";
import { useV2 } from "@/lib/v2-store";
import type { Depot } from "@/lib/types/db";

export function DepotSwitcher() {
  const [open, setOpen] = useState(false);
  const [depots, setDepots] = useState<Depot[]>([]);
  const current = useV2((s) => s.currentDepot);
  const setCurrent = useV2((s) => s.setCurrentDepot);

  useEffect(() => {
    void listDepots().then((d) => {
      setDepots(d);
      // Auto-select first depot if none selected.
      if (!current && d.length > 0) setCurrent(d[0]);
    });
  }, [current, setCurrent]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 bg-white border border-rule rounded-full px-3 py-2 text-sm font-semibold text-text-primary shadow-sm"
      >
        <Building2 className="w-4 h-4 text-primary" strokeWidth={2.2} />
        <span className="max-w-[160px] truncate">
          {current?.nom ?? "Choisir un dépôt"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-tertiary transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-30 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-40 w-64 bg-white rounded-2xl shadow-card-lg border border-rule overflow-hidden">
            {depots.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setCurrent(d);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-cream/60 ${
                  current?.id === d.id ? "bg-cream" : ""
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    d.type === "entrepot"
                      ? "bg-gold-soft text-primary-dark"
                      : "bg-cream text-primary"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">
                    {d.nom}
                  </p>
                  <p className="text-[11px] text-text-tertiary uppercase tracking-wide">
                    {d.type === "entrepot" ? "Entrepôt" : "Point de vente"}
                  </p>
                </div>
                {current?.id === d.id && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
