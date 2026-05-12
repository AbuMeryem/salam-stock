"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Layers,
  Package,
  Store,
  Truck,
  Warehouse,
} from "lucide-react";
import { listDepots, listProduitsInDepot } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useV2 } from "@/lib/v2-store";
import type { Depot } from "@/lib/types/db";

interface DepotStats {
  productCount: number;
  totalUnits: number;
  bdlTodayCount: number;
  inventaireOpen: boolean;
}

const ACCENT: Record<string, { dot: string; bg: string; text: string }> = {
  Particulier: { dot: "bg-gold-bright", bg: "bg-gold-soft", text: "text-primary-dark" },
  Professionnel: { dot: "bg-primary", bg: "bg-cream", text: "text-primary" },
  Sodrune: { dot: "bg-text-secondary", bg: "bg-cream", text: "text-text-primary" },
};

function iconFor(d: Depot) {
  if (d.type === "entrepot") return Warehouse;
  if (d.nom === "Professionnel") return Building2;
  return Store;
}

export function DepotSwitcher() {
  const [open, setOpen] = useState(false);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [stats, setStats] = useState<Map<string, DepotStats>>(new Map());
  const current = useV2((s) => s.currentDepot);
  const setCurrent = useV2((s) => s.setCurrentDepot);
  const employe = useV2((s) => s.currentEmploye);

  // 1) Load depots + auto-select sur depot_principal_id de l'employé.
  useEffect(() => {
    void listDepots().then((d) => {
      setDepots(d);
      if (!current && d.length > 0) {
        const principal = employe?.depot_principal_id
          ? d.find((x) => x.id === employe.depot_principal_id)
          : null;
        setCurrent(principal ?? d[0]);
      }
    });
  }, [current, setCurrent, employe?.depot_principal_id]);

  // 2) Load stats par dépôt (qty + BDL aujourd'hui). Refresh une seule fois
  //    au mount + à chaque ouverture du dropdown pour rester frais.
  useEffect(() => {
    if (depots.length === 0) return;
    let cancelled = false;
    (async () => {
      const sb = supabase();
      const today = new Date().toISOString().slice(0, 10);
      const map = new Map<string, DepotStats>();
      for (const d of depots) {
        const stock = await listProduitsInDepot(d.id);
        if (cancelled) return;
        let bdlToday = 0;
        if (sb) {
          try {
            const { count } = await sb
              .from("bons_de_livraison")
              .select("id", { count: "exact", head: true })
              .eq("depot_destination_id", d.id)
              .eq("date_livraison_prevue", today)
              .neq("statut", "receptionnee");
            bdlToday = count ?? 0;
          } catch {
            /* table peut ne pas exister */
          }
        }
        map.set(d.id, {
          productCount: stock.length,
          totalUnits: stock.reduce((s, p) => s + p.quantite, 0),
          bdlTodayCount: bdlToday,
          inventaireOpen: false,
        });
      }
      if (!cancelled) setStats(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [depots, open]);

  const currentAccent = useMemo(() => {
    if (current?.nom && ACCENT[current.nom]) return ACCENT[current.nom];
    return ACCENT.Particulier;
  }, [current]);

  const totalBdlToday = useMemo(
    () => Array.from(stats.values()).reduce((s, st) => s + st.bdlTodayCount, 0),
    [stats]
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 bg-white border border-rule rounded-full pl-2 pr-3 py-1.5 text-[13px] font-bold text-text-primary shadow-card active:scale-[0.98] transition-transform`}
        aria-label="Choisir un dépôt"
        aria-expanded={open}
      >
        {/* Icône dépôt courant + dot couleur */}
        <span
          className={`relative inline-flex items-center justify-center w-7 h-7 rounded-full ${currentAccent.bg} ${currentAccent.text}`}
        >
          {current ? (
            (() => {
              const Icon = iconFor(current);
              return <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />;
            })()
          ) : (
            <Building2 className="w-3.5 h-3.5" />
          )}
          {/* Dot rouge si BDL aujourd'hui sur le dépôt courant */}
          {current && (stats.get(current.id)?.bdlTodayCount ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-danger border-2 border-white rounded-full" />
          )}
        </span>
        <span className="max-w-[120px] truncate">
          {current?.nom ?? "Dépôt"}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${
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
          <div className="absolute right-0 mt-2 z-40 w-[280px] bg-white rounded-2xl shadow-card-lg border border-rule overflow-hidden">
            {/* Header dropdown */}
            <div className="px-4 pt-3 pb-2 border-b border-rule">
              <p className="label-caps text-text-tertiary">Dépôt actif</p>
              {totalBdlToday > 0 && (
                <p className="text-[11px] text-danger font-bold inline-flex items-center gap-1 mt-1">
                  <Truck className="w-3 h-3" />
                  {totalBdlToday} BDL prévu{totalBdlToday > 1 ? "s" : ""} aujourd&apos;hui
                </p>
              )}
            </div>

            {depots.map((d) => {
              const accent = ACCENT[d.nom] ?? ACCENT.Particulier;
              const st = stats.get(d.id);
              const isActive = current?.id === d.id;
              const Icon = iconFor(d);
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setCurrent(d);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-cream/60 transition-colors ${
                    isActive ? "bg-cream" : ""
                  }`}
                >
                  <span
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.bg} ${accent.text}`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.4} />
                    {(st?.bdlTodayCount ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                        {st!.bdlTodayCount}
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13.5px] font-bold text-text-primary truncate">
                        {d.nom}
                      </p>
                      {d.type === "entrepot" && (
                        <span className="text-[9px] bg-cream text-text-tertiary font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">
                          Entrepôt
                        </span>
                      )}
                    </div>
                    {st ? (
                      <p className="text-[11px] text-text-secondary mt-0.5 inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" />
                          <span className="tabular font-bold">{st.productCount}</span> ref.
                        </span>
                        <span className="text-text-tertiary">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5" />
                          <span className="tabular font-bold">{st.totalUnits}</span> u.
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-text-tertiary mt-0.5">
                        Chargement…
                      </p>
                    )}
                    {(st?.bdlTodayCount ?? 0) > 0 && (
                      <p className="text-[11px] text-danger font-bold mt-0.5 inline-flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {st!.bdlTodayCount} livraison{st!.bdlTodayCount > 1 ? "s" : ""} à réceptionner
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
