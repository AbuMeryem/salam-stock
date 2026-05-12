"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import {
  listDepots,
  listEmployes,
  listReceptions,
  listSorties,
  listTransferts,
} from "@/lib/db";
import type {
  Depot,
  Employe,
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

type Filter = "all" | "rec" | "sor" | "trf";

interface Row {
  type: "rec" | "sor" | "trf";
  date: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any;
}

export default function ActivitePage() {
  const router = useRouter();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [sorties, setSorties] = useState<SortieStock[]>([]);
  const [transferts, setTransferts] = useState<TransfertInterDepot[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const ds = await listDepots();
    setDepots(ds);
    setEmployes(await listEmployes());

    const allRec: Reception[] = [];
    const allSor: SortieStock[] = [];
    for (const d of ds) {
      allRec.push(...(await listReceptions({ depotId: d.id, limit: 200 })));
      allSor.push(...(await listSorties({ depotId: d.id, limit: 200 })));
    }
    setReceptions(allRec);
    setSorties(allSor);
    setTransferts(await listTransferts({ limit: 200 }));
    setLoading(false);
  }

  const merged = useMemo<Row[]>(() => {
    const all: Row[] = [
      ...receptions.map((r) => ({ type: "rec" as const, date: r.created_at, item: r })),
      ...sorties.map((s) => ({ type: "sor" as const, date: s.created_at, item: s })),
      ...transferts.map((t) => ({ type: "trf" as const, date: t.created_at, item: t })),
    ];
    return all
      .filter((r) => filter === "all" || r.type === filter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [receptions, sorties, transferts, filter]);

  const counts = {
    rec: receptions.length,
    sor: sorties.length,
    trf: transferts.length,
    all: receptions.length + sorties.length + transferts.length,
  };

  // Group by day
  const grouped = useMemo(() => {
    const out = new Map<string, Row[]>();
    for (const r of merged) {
      const key = r.date.slice(0, 10);
      const arr = out.get(key) ?? [];
      arr.push(r);
      out.set(key, arr);
    }
    return Array.from(out.entries());
  }, [merged]);

  return (
    <V2Shell>
      <PageAccentStripe accent="or-sapin" />
      <header className="px-5 pt-7">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-primary mt-3 inline-flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Activité complète
        </p>
        <h1 className="h1 text-text-primary mt-1">
          {counts.all} mouvement{counts.all > 1 ? "s" : ""}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          Réceptions, sorties et transferts horodatés sur tous les dépôts.
        </p>
      </header>

      <section className="px-5 mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`Tout · ${counts.all}`}
          />
          <FilterPill
            active={filter === "rec"}
            onClick={() => setFilter("rec")}
            label={`Réceptions · ${counts.rec}`}
            icon={<ArrowDownToLine className="w-3 h-3 text-success" />}
          />
          <FilterPill
            active={filter === "sor"}
            onClick={() => setFilter("sor")}
            label={`Sorties · ${counts.sor}`}
            icon={<ArrowUpRight className="w-3 h-3 text-warning" />}
          />
          <FilterPill
            active={filter === "trf"}
            onClick={() => setFilter("trf")}
            label={`Transferts · ${counts.trf}`}
            icon={<Repeat2 className="w-3 h-3 text-primary-dark" />}
          />
        </div>
      </section>

      {loading ? (
        <div className="px-5 py-10 text-center text-text-secondary">
          Chargement…
        </div>
      ) : merged.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Sparkles className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            Aucun mouvement à afficher.
          </p>
        </div>
      ) : (
        <section className="px-5 mt-5 pb-nav-stack space-y-5">
          {grouped.map(([day, rows]) => (
            <div key={day}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-tertiary mb-2 sticky top-[var(--header-height,56px)] bg-cream py-1">
                {formatDay(day)} · {rows.length}
              </p>
              <div className="bg-white border border-rule rounded-2xl divide-y divide-rule overflow-hidden">
                {rows.map((row, i) => (
                  <Row key={i} row={row} depots={depots} employes={employes} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </V2Shell>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap border transition-colors ${
        active
          ? "bg-primary text-white border-primary"
          : "bg-white text-text-primary border-rule"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({
  row,
  depots,
  employes,
}: {
  row: Row;
  depots: Depot[];
  employes: Employe[];
}) {
  if (row.type === "rec") {
    const r = row.item as Reception;
    const d = depots.find((x) => x.id === r.depot_id);
    const e = employes.find((x) => x.id === r.employe_id);
    return (
      <a
        href="/v2/reception"
        className="px-3 py-2.5 flex items-center gap-3 active:bg-cream transition-colors"
      >
        <span className="w-9 h-9 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
          <ArrowDownToLine className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-text-primary truncate">
            Réception {r.fournisseur ?? "—"} → {d?.nom ?? "?"}
          </p>
          <p className="text-[11px] text-text-secondary">
            {e?.prenom} {e?.nom} · {formatTime(row.date)}
          </p>
        </div>
        <span className="text-text-tertiary text-xs">→</span>
      </a>
    );
  }
  if (row.type === "sor") {
    const s = row.item as SortieStock;
    const d = depots.find((x) => x.id === s.depot_id);
    const e = employes.find((x) => x.id === s.employe_id);
    const lowScore =
      s.ia_coherence_score !== null && s.ia_coherence_score < 0.6;
    return (
      <a
        href={lowScore ? `/v2/admin/alertes?sortie=${s.id}` : "/v2/admin/alertes"}
        className="px-3 py-2.5 flex items-center gap-3 active:bg-cream transition-colors"
      >
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            lowScore ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-text-primary truncate">
            Sortie {SORTIE_LABEL[s.type] ?? s.type} × {s.quantite} · {d?.nom}
          </p>
          <p className="text-[11px] text-text-secondary">
            {e?.prenom} {e?.nom} · {formatTime(row.date)}
            {s.ia_coherence_score !== null && (
              <> · IA {Math.round(s.ia_coherence_score * 100)}%</>
            )}
          </p>
        </div>
        <span className="text-text-tertiary text-xs">→</span>
      </a>
    );
  }
  // transfert
  const t = row.item as TransfertInterDepot;
  const ds = depots.find((x) => x.id === t.depot_source_id);
  const dd = depots.find((x) => x.id === t.depot_destination_id);
  const e = employes.find((x) => x.id === t.employe_id);
  return (
    <a
      href="/v2/transfert"
      className="px-3 py-2.5 flex items-center gap-3 active:bg-cream transition-colors"
    >
      <span className="w-9 h-9 rounded-xl bg-gold-soft text-primary-dark flex items-center justify-center shrink-0">
        <Repeat2 className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-text-primary truncate">
          Transfert {ds?.nom} → {dd?.nom} · qté {t.quantite}
        </p>
        <p className="text-[11px] text-text-secondary">
          {e?.prenom} {e?.nom} · {formatTime(row.date)}
        </p>
      </div>
      <span className="text-text-tertiary text-xs">→</span>
    </a>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - dt.getTime()) / 86400000;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
