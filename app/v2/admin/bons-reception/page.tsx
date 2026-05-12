"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Loader2,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { supabase } from "@/lib/supabase";

interface BdlRow {
  id: string;
  numero_bdl: string;
  numero_bdl_fournisseur: string | null;
  date_livraison_prevue: string;
  statut: "prevue" | "en_cours" | "receptionnee" | "litige";
  receptionne_le: string | null;
  photo_palette_url_1: string | null;
  photo_bdl_url: string | null;
  fournisseurs: { nom: string } | null;
  depots: { nom: string } | null;
  bons_de_livraison_lignes: Array<{
    quantite_attendue: number;
    quantite_recue: number;
  }>;
}

type PeriodKey = "today" | "7j" | "30j" | "all";

function fmtDateFr(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTimeFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export default function BonsReceptionAdminPage() {
  const router = useRouter();
  const [rows, setRows] = useState<BdlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("7j");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    const sb = supabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data, error } = await sb
      .from("bons_de_livraison")
      .select(
        `id, numero_bdl, numero_bdl_fournisseur, date_livraison_prevue, statut, receptionne_le,
         photo_palette_url_1, photo_bdl_url,
         fournisseurs (nom),
         depots (nom),
         bons_de_livraison_lignes (quantite_attendue, quantite_recue)`
      )
      .eq("statut", "receptionnee")
      .order("receptionne_le", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as unknown as BdlRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      period === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : period === "7j"
          ? now - 7 * 86_400_000
          : period === "30j"
            ? now - 30 * 86_400_000
            : 0;
    let l = rows.filter((r) => {
      if (!r.receptionne_le) return false;
      return new Date(r.receptionne_le).getTime() >= cutoff;
    });
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter(
        (r) =>
          r.numero_bdl.toLowerCase().includes(q) ||
          (r.numero_bdl_fournisseur?.toLowerCase().includes(q) ?? false) ||
          (r.fournisseurs?.nom.toLowerCase().includes(q) ?? false) ||
          (r.depots?.nom.toLowerCase().includes(q) ?? false)
      );
    }
    return l;
  }, [rows, period, query]);

  const stats = useMemo(() => {
    let nbLignes = 0;
    let totalRecu = 0;
    let totalAttendu = 0;
    for (const r of filtered) {
      nbLignes += r.bons_de_livraison_lignes.length;
      for (const l of r.bons_de_livraison_lignes) {
        totalAttendu += l.quantite_attendue;
        totalRecu += Math.min(l.quantite_recue, l.quantite_attendue);
      }
    }
    return { nbBdl: filtered.length, nbLignes, totalRecu, totalAttendu };
  }, [filtered]);

  return (
    <V2Shell>
      <PageAccentStripe accent="or" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="section-eyebrow mt-3">
          <FileText className="w-3 h-3" />
          Bons de réception
        </p>
        <h1 className="h1 text-text-primary mt-1">BR PDF générés</h1>
        <p className="body-md text-text-secondary mt-1">
          Historique des réceptions validées avec téléchargement du Bon de
          Réception signé numériquement (à archiver avec la facture fournisseur).
        </p>

        {/* KPI */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Kpi label="BR émis" value={stats.nbBdl} />
          <Kpi label="Lignes" value={stats.nbLignes} />
          <Kpi
            label="Unités reçues"
            value={`${stats.totalRecu}/${stats.totalAttendu}`}
          />
        </div>

        {/* Filtres période */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto scrollbar-none -mx-1 px-1">
          {(
            [
              { k: "today", l: "Aujourd'hui" },
              { k: "7j", l: "7 jours" },
              { k: "30j", l: "30 jours" },
              { k: "all", l: "Tout" },
            ] as Array<{ k: PeriodKey; l: string }>
          ).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setPeriod(opt.k)}
              data-active={period === opt.k}
              className="pill-filter shrink-0"
            >
              {opt.l}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="N° BDL, fournisseur, dépôt…"
            className="input-field !pl-10 !rounded-full"
          />
        </div>
      </header>

      <section className="px-5 mt-5 pb-12">
        {loading ? (
          <div className="bg-white border border-rule rounded-2xl p-8 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-cream border border-rule rounded-2xl p-8 text-center">
            <FileText className="w-7 h-7 text-text-tertiary mx-auto mb-2" />
            <p className="font-bold text-text-primary">
              Aucun BR sur cette période
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Les BR apparaissent ici dès qu&apos;une réception est validée
              sur /v2/reception.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r, idx) => {
              const totalLignes = r.bons_de_livraison_lignes.length;
              const totalAttendu = r.bons_de_livraison_lignes.reduce(
                (s, l) => s + l.quantite_attendue,
                0
              );
              const totalRecu = r.bons_de_livraison_lignes.reduce(
                (s, l) => s + l.quantite_recue,
                0
              );
              const ecart = totalRecu - totalAttendu;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.03 }}
                  className="bg-white border border-rule rounded-2xl p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[14px] font-extrabold text-text-primary">
                          BR {r.numero_bdl}
                        </p>
                        <span className="bg-success-soft text-success text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Validé
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary mt-0.5">
                        {r.fournisseurs?.nom ?? "—"} · {r.depots?.nom ?? "—"}
                      </p>
                      {r.numero_bdl_fournisseur && (
                        <p className="text-[10.5px] text-text-tertiary mono mt-0.5">
                          N° fournisseur : {r.numero_bdl_fournisseur}
                        </p>
                      )}
                    </div>
                    <a
                      href={`/api/cashbox/bon-reception-pdf?bdl_id=${r.id}`}
                      target="_blank"
                      rel="noopener"
                      className="bg-primary text-white rounded-full px-3.5 py-2 text-[11.5px] font-bold inline-flex items-center gap-1.5 shadow-card active:scale-[0.97] transition-transform shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      BR PDF
                    </a>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule text-[11.5px] text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      Réceptionné {fmtDateTimeFr(r.receptionne_le)}
                    </span>
                    <span className="inline-flex items-center gap-2 tabular">
                      <span>
                        <b className="text-text-primary">{totalLignes}</b> lignes
                      </span>
                      <span className="text-text-tertiary">·</span>
                      <span>
                        <b className="text-text-primary">{totalRecu}</b>/{totalAttendu} u.
                      </span>
                      {ecart !== 0 && (
                        <span
                          className={`font-bold ${ecart < 0 ? "text-danger" : "text-warning"}`}
                        >
                          ({ecart > 0 ? "+" : ""}
                          {ecart})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Mini preview des photos jointes */}
                  {(r.photo_palette_url_1 || r.photo_bdl_url) && (
                    <div className="flex gap-1.5 mt-3">
                      {r.photo_palette_url_1 && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photo_palette_url_1}
                          alt="Palette"
                          className="w-12 h-12 object-cover rounded-lg border border-rule"
                        />
                      )}
                      {r.photo_bdl_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photo_bdl_url}
                          alt="BDL papier"
                          className="w-12 h-12 object-cover rounded-lg border border-rule"
                        />
                      )}
                      <span className="text-[10.5px] text-text-tertiary self-center ml-1">
                        photos intégrées au BR
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </V2Shell>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-rule rounded-2xl p-3">
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <p className="text-[18px] font-extrabold tabular text-text-primary leading-none mt-1">
        {value}
      </p>
    </div>
  );
}

// Lint: keep Filter import potential use
void Filter;
