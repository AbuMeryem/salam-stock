"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownRight, ArrowLeft, ArrowUpRight,
  Download, FileSpreadsheet, FileText,
  Loader2, Mail, ShoppingBag, Store, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import type { MonthlyReport } from "@/lib/cashbox/monthly-report";
import { downloadOrShare } from "@/lib/download-helper";
import { DownloadCompleteBar } from "@/components/v2/DownloadCompleteBar";

const fr = (n: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(n);
const fr2 = (n: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(n);

function previousMonthYYYYMM() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(v: string) {
  const [y, m] = v.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default function RapportMensuelPage() {
  const router = useRouter();
  const [mois, setMois] = useState(previousMonthYYYYMM());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState<{ filename: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cashbox/monthly-report?mois=${mois}`)
      .then((r) => r.json())
      .then((data: MonthlyReport | { error: string }) => {
        if ("error" in data) { toast.error(data.error); setReport(null); }
        else setReport(data);
      })
      .finally(() => setLoading(false));
  }, [mois]);

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({ value: v, label: monthLabel(v) });
    }
    return out;
  }, []);

  async function downloadPdf() {
    toast.loading("Génération PDF…", { id: "rep-pdf" });
    const filename = `salam-rapport-mensuel-${mois}.pdf`;
    const r = await downloadOrShare({
      url: `/api/cashbox/monthly-report-pdf?mois=${mois}`,
      filename,
      contentType: "application/pdf",
      shareTitle: `Rapport mensuel ${mois}`,
    });
    if (r.success) {
      toast.success(
        r.strategy === "share" ? "PDF partagé"
        : r.strategy === "newtab" ? "PDF ouvert dans Safari"
        : "PDF téléchargé",
        { id: "rep-pdf" }
      );
      setDownloaded({ filename });
    } else if (r.strategy === "cancelled") {
      toast.dismiss("rep-pdf");
    } else {
      toast.error(r.error ?? "Erreur", { id: "rep-pdf" });
    }
  }

  async function downloadCsv() {
    toast.loading("Génération CSV…", { id: "rep-csv" });
    const filename = `salam-rapport-mensuel-${mois}.csv`;
    const r = await downloadOrShare({
      url: `/api/cashbox/monthly-report-csv?mois=${mois}`,
      filename,
      contentType: "text/csv",
      shareTitle: `Rapport CSV ${mois}`,
    });
    if (r.success) {
      toast.success(
        r.strategy === "share" ? "CSV partagé"
        : r.strategy === "newtab" ? "CSV ouvert dans Safari"
        : "CSV téléchargé",
        { id: "rep-csv" }
      );
      setDownloaded({ filename });
    } else if (r.strategy === "cancelled") {
      toast.dismiss("rep-csv");
    } else {
      toast.error(r.error ?? "Erreur", { id: "rep-csv" });
    }
  }

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <BackButton />
        <p className="section-eyebrow mt-3"><FileText className="w-3 h-3" />Rapport mensuel consolidé</p>
        <h1 className="h1 text-text-primary mt-1">{monthLabel(mois).replace(/^./, (c) => c.toUpperCase())}</h1>
        <p className="body-md text-text-secondary mt-1">
          Ventes magasin (Cashmag) + ventes Drive, pour ton expert-comptable.
        </p>
        <div className="mt-5">
          <label className="label-caps text-text-tertiary block mb-2">Mois</label>
          <select value={mois} onChange={(e) => setMois(e.target.value)} className="input-field max-w-[260px] font-bold text-text-primary">
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <section className="px-5 mt-6">
          <div className="bg-white border border-rule rounded-[20px] p-10 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">Calcul du rapport…</p>
          </div>
        </section>
      ) : !report ? (
        <section className="px-5 mt-6"><p className="text-text-secondary text-sm">Aucune donnée.</p></section>
      ) : (
        <>
          {report.magasin.partial && (
            <section className="px-5 mt-4">
              <div className="bg-warning-soft border border-warning/30 rounded-[16px] p-3.5 flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                <div className="text-[12px]">
                  <p className="font-bold text-warning">Données magasin partielles</p>
                  <p className="text-text-secondary mt-0.5">
                    Pensez à importer le CSV Cashmag de {monthLabel(mois)}.{" "}
                    <a href="/v2/admin/import-cashmag" className="text-primary font-bold underline">Importer</a>
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="px-5 mt-5">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
              className="bg-white border border-rule rounded-[20px] p-5 shadow-card">
              <p className="section-eyebrow"><TrendingUp className="w-3 h-3" />CA total consolidé</p>
              <p className="text-[32px] font-extrabold text-text-primary mt-1.5 tabular leading-none">
                {fr2(report.consolidation.ca_ttc_total)}
              </p>
              {report.consolidation.evolution_vs_mois_precedent !== null && (
                <p className={`mt-2 inline-flex items-center gap-1 text-[12px] font-bold tabular ${report.consolidation.evolution_vs_mois_precedent >= 0 ? "text-success" : "text-danger"}`}>
                  {report.consolidation.evolution_vs_mois_precedent >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {report.consolidation.evolution_vs_mois_precedent >= 0 ? "+" : ""}
                  {report.consolidation.evolution_vs_mois_precedent.toFixed(1)}%
                  <span className="text-text-tertiary font-medium ml-1">vs mois précédent</span>
                </p>
              )}
              <div className="mt-4 h-2 rounded-full bg-cream overflow-hidden flex">
                <div className="bg-primary h-full" style={{ width: `${report.consolidation.repartition.magasin_pct}%` }} />
                <div className="bg-gold-bright h-full" style={{ width: `${report.consolidation.repartition.drive_pct}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />Magasin {report.consolidation.repartition.magasin_pct.toFixed(0)}%
                </span>
                <span className="inline-flex items-center gap-1.5 text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-bright" />Drive {report.consolidation.repartition.drive_pct.toFixed(0)}%
                </span>
              </div>
              <div className="mt-5 border-t border-rule pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-2">Ventilation TVA collectée</p>
                <div className="space-y-1.5">
                  {Object.entries(report.consolidation.tva_par_taux).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([rate, v]) => (
                    <div key={rate} className="flex items-baseline text-[12.5px]">
                      <span className="w-[80px] font-bold text-text-primary tabular">TVA {rate}%</span>
                      <span className="flex-1 text-right tabular font-bold text-text-primary">{fr2(v.tva)}</span>
                      <span className="ml-3 text-text-tertiary text-[10.5px] tabular w-[110px] text-right">base {fr2(v.base_ht)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </section>

          <section className="px-5 mt-5">
            <SectionCard icon={<Store className="w-3 h-3" />} eyebrow="Ventes magasin"
              ca={report.magasin.ca_ttc} m1l="Tickets" m1v={report.magasin.nb_tickets.toString()}
              m2l="Panier moyen" m2v={fr2(report.magasin.panier_moyen)} top={report.magasin.top_produits}
              hint={report.magasin.last_import_at ? `Importé ${new Date(report.magasin.last_import_at).toLocaleDateString("fr-FR")}` : "Aucun import Cashmag"} />
          </section>

          <section className="px-5 mt-5">
            <SectionCard icon={<ShoppingBag className="w-3 h-3" />} eyebrow="Ventes drive"
              ca={report.drive.ca_ttc} m1l="Commandes" m1v={report.drive.nb_tickets.toString()}
              m2l="Panier moyen" m2v={fr2(report.drive.panier_moyen)} top={report.drive.top_produits}
              hint={`Frais Stripe ${fr2(report.drive.frais_stripe)} · Net ${fr2(report.drive.net)}`} />
          </section>

          <section className="px-5 mt-6 space-y-2.5">
            <p className="section-eyebrow mb-2"><FileText className="w-3 h-3" />Pour ton comptable</p>
            <button onClick={downloadPdf}
              className="w-full bg-primary text-white rounded-[18px] py-3.5 px-4 flex items-center justify-between shadow-card active:scale-[0.99] transition-transform">
              <span className="inline-flex items-center gap-2.5"><FileText className="w-5 h-5" />
                <span className="font-bold text-[14px]">Télécharger PDF mensuel</span></span>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={downloadCsv}
              className="w-full bg-white border border-rule rounded-[18px] py-3.5 px-4 flex items-center justify-between active:scale-[0.99] transition-transform">
              <span className="inline-flex items-center gap-2.5 text-text-primary"><FileSpreadsheet className="w-5 h-5 text-primary" />
                <span className="font-bold text-[14px]">CSV détaillé (4 sections)</span></span>
              <Download className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={async () => {
              toast.loading("Envoi…", { id: "rep-email" });
              try {
                const r = await fetch("/api/notify", { method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ kind: "monthly_report_email",
                    payload: { mois, ca_total: report.consolidation.ca_ttc_total,
                      pdf_url: `/api/cashbox/monthly-report-pdf?mois=${mois}`,
                      csv_url: `/api/cashbox/monthly-report-csv?mois=${mois}` } }) });
                if (!r.ok) throw new Error("Échec");
                toast.success("Email envoyé au comptable", { id: "rep-email" });
              } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur", { id: "rep-email" }); }
            }}
              className="w-full bg-cream border border-rule rounded-[18px] py-3 px-4 flex items-center gap-2.5 active:scale-[0.99] transition-transform">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-semibold text-[13px] text-text-primary">Envoyer par email au comptable</span>
            </button>
            <p className="text-[10.5px] text-text-tertiary text-center pt-1">
              Cron auto : envoi le 1er de chaque mois à 06h00.
            </p>
          </section>
        </>
      )}

      <DownloadCompleteBar
        filename={downloaded?.filename ?? null}
        onDismiss={() => setDownloaded(null)}
        backLabel="Retour à l'admin"
        backHref="/v2/admin"
      />
    </V2Shell>
  );
}

function SectionCard({ icon, eyebrow, ca, m1l, m1v, m2l, m2v, top, hint }: {
  icon: React.ReactNode; eyebrow: string; ca: number;
  m1l: string; m1v: string; m2l: string; m2v: string;
  top: Array<{ designation: string; quantite: number; ca: number }>; hint: string;
}) {
  return (
    <div className="bg-white border border-rule rounded-[20px] p-5 shadow-card">
      <p className="section-eyebrow">{icon}{eyebrow}</p>
      <p className="text-[22px] font-extrabold text-text-primary mt-1.5 tabular leading-none">{fr2(ca)}</p>
      <p className="text-[11px] text-text-tertiary mt-1.5">{hint}</p>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-bold">{m1l}</p>
          <p className="text-[15px] font-extrabold text-text-primary tabular mt-1">{m1v}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-bold">{m2l}</p>
          <p className="text-[15px] font-extrabold text-text-primary tabular mt-1">{m2v}</p>
        </div>
      </div>
      {top.length > 0 && (
        <div className="mt-4 border-t border-rule pt-3">
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-bold mb-2">Top {Math.min(top.length, 5)} produits</p>
          <ul className="space-y-1.5">
            {top.slice(0, 5).map((p, idx) => (
              <li key={p.designation} className="flex items-baseline gap-2 text-[12px]">
                <span className="text-text-tertiary w-4 tabular">{idx + 1}.</span>
                <span className="flex-1 truncate text-text-primary font-semibold">{p.designation}</span>
                <span className="text-text-tertiary tabular text-[10.5px]">×{p.quantite}</span>
                <span className="font-bold text-text-primary tabular w-[68px] text-right">{fr(p.ca)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
