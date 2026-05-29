"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import type { DailyZSummary } from "@/lib/cashbox/daily-z";
import { downloadOrShare } from "@/lib/download-helper";
import { DownloadCompleteBar } from "@/components/v2/DownloadCompleteBar";

function formatEurFr(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDateFr(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatHeureFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    })
    .replace(":", "h");
}

function yesterdayIsoParis() {
  const now = new Date();
  const paris = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  paris.setDate(paris.getDate() - 1);
  return paris.toISOString().slice(0, 10);
}

export default function RecapFiscalPage() {
  const router = useRouter();
  const [date, setDate] = useState(yesterdayIsoParis());
  const [summary, setSummary] = useState<DailyZSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloaded, setDownloaded] = useState<{ filename: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cashbox/daily-z?date=${date}`)
      .then((r) => r.json())
      .then((data: DailyZSummary | { error: string }) => {
        if ("error" in data) {
          toast.error(data.error, { id: "z-error" });
          setSummary(null);
        } else {
          setSummary(data);
        }
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Erreur");
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [date]);

  async function downloadPdf() {
    toast.loading("Génération du PDF…", { id: "z-pdf" });
    const filename = `salam-drive-Z-${date}.pdf`;
    const r = await downloadOrShare({
      url: `/api/cashbox/daily-z-pdf?date=${date}`,
      filename,
      contentType: "application/pdf",
      shareTitle: `Récap fiscal ${date}`,
    });
    if (r.success) {
      toast.success(
        r.strategy === "share"
          ? "PDF partagé"
          : r.strategy === "newtab"
            ? "PDF ouvert dans Safari"
            : "PDF téléchargé",
        { id: "z-pdf" }
      );
      setDownloaded({ filename });
    } else if (r.strategy === "cancelled") {
      toast.dismiss("z-pdf");
    } else {
      toast.error(r.error ?? "Erreur", { id: "z-pdf" });
    }
  }

  async function downloadCsv() {
    toast.loading("Génération du CSV…", { id: "z-csv" });
    const filename = `salam-drive-Z-${date}.csv`;
    const r = await downloadOrShare({
      url: `/api/cashbox/daily-z-csv?date=${date}`,
      filename,
      contentType: "text/csv",
      shareTitle: `Récap fiscal CSV ${date}`,
    });
    if (r.success) {
      toast.success(
        r.strategy === "share"
          ? "CSV partagé"
          : r.strategy === "newtab"
            ? "CSV ouvert dans Safari"
            : "CSV téléchargé",
        { id: "z-csv" }
      );
      setDownloaded({ filename });
    } else if (r.strategy === "cancelled") {
      toast.dismiss("z-csv");
    } else {
      toast.error(r.error ?? "Erreur", { id: "z-csv" });
    }
  }

  async function sendEmail() {
    toast.loading("Envoi par email…", { id: "z-email" });
    try {
      const r = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "daily_z_email",
          payload: {
            date,
            pdf_url: `/api/cashbox/daily-z-pdf?date=${date}`,
            csv_url: `/api/cashbox/daily-z-csv?date=${date}`,
          },
        }),
      });
      if (!r.ok) throw new Error("Envoi échoué");
      toast.success("Email envoyé à l'adresse comptable configurée", {
        id: "z-email",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur", { id: "z-email" });
    }
  }

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <BackButton />
        <p className="section-eyebrow mt-3">
          <Receipt className="w-3 h-3" />
          Récap fiscal journalier
        </p>
        <h1 className="h1 text-text-primary mt-1">Salam Drive · Z du jour</h1>
        <p className="body-md text-text-secondary mt-1">
          Document récapitulatif des ventes Drive. À transmettre au comptable
          avec le Z magasin Cashmag.
        </p>

        {/* Date selector */}
        <div className="mt-5">
          <label className="label-caps text-text-tertiary block mb-2">
            <Calendar className="w-3 h-3 inline mr-1" />
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="input-field max-w-[220px] font-bold text-text-primary tabular"
          />
        </div>
      </header>

      {/* TICKET Z */}
      <section className="px-5 mt-6">
        {loading ? (
          <div className="bg-white border border-rule rounded-[20px] p-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">
              Génération du récap fiscal…
            </p>
          </div>
        ) : !summary || summary.status === "no_data" ? (
          <div className="bg-white border border-rule rounded-[20px] p-8 text-center">
            <Receipt className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm font-bold text-text-primary">
              Aucune vente Drive le {formatDateFr(date)}
            </p>
            <p className="text-xs text-text-secondary mt-1.5">
              Si tu attends des données, vérifie que les commandes sont
              bien synchronisées via le trigger Supabase (0009 sync).
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="bg-white border-2 border-dashed border-line-medium rounded-[20px] p-5 shadow-card mono text-[12.5px] leading-relaxed text-text-primary"
            style={{
              fontFamily:
                'ui-monospace, "SF Mono", "Menlo", "JetBrains Mono", monospace',
            }}
          >
            {/* Header magasin */}
            <div className="text-center mb-3">
              <p className="font-extrabold text-[14px]">SALAM MARKET DRIVE</p>
              <p className="text-text-secondary text-[11px] mt-0.5">
                K &amp; A FOOD — SIRET 802 773 812
              </p>
              <p className="text-text-secondary text-[11px]">
                8 av. Larrieu-Thibaud, 31100 Toulouse
              </p>
            </div>

            <div className="border-t border-line-medium my-2" />

            <div className="text-center mb-3">
              <p className="font-extrabold uppercase text-[13px]">
                Récap fiscal journalier
              </p>
              <p className="mt-1">
                Date : <span className="font-bold">{formatDateFr(date)}</span>
              </p>
              <p className="text-text-secondary text-[11px] mt-0.5">
                Émis le{" "}
                {new Date(summary.generated_at).toLocaleString("fr-FR", {
                  timeZone: "Europe/Paris",
                })}
              </p>
            </div>

            <div className="border-t border-line-medium my-2" />

            {/* Compteurs */}
            <div className="space-y-1.5">
              <Row
                label="Nombre de commandes"
                value={summary.nb_commandes.toString()}
              />
              <Row
                label="1ère commande"
                value={formatHeureFr(summary.premiere_commande_at)}
              />
              <Row
                label="Dernière commande"
                value={formatHeureFr(summary.derniere_commande_at)}
              />
            </div>

            <div className="border-t border-line-medium my-3" />

            {/* CA */}
            <div className="space-y-1.5">
              <Row
                label="CA TTC"
                value={formatEurFr(summary.ca_ttc)}
                bold
              />
              <Row label="CA HT" value={formatEurFr(summary.ca_ht)} />
            </div>

            <div className="border-t border-line-medium my-3" />

            {/* TVA */}
            <p className="font-bold uppercase text-[11px] tracking-wide text-text-secondary mb-1">
              TVA collectée
            </p>
            <div className="space-y-1">
              {Object.entries(summary.tva_par_taux)
                .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                .map(([rate, v]) => (
                  <div key={rate} className="flex items-baseline">
                    <span className="w-[88px] tabular">TVA {rate}%</span>
                    <span className="flex-1 tabular text-right">
                      {formatEurFr(v.tva)}
                    </span>
                    <span className="text-text-tertiary text-[10.5px] tabular ml-3 w-[110px] text-right">
                      base {formatEurFr(v.base_ht)}
                    </span>
                  </div>
                ))}
              <Row
                label="Total TVA"
                value={formatEurFr(summary.tva_totale)}
                bold
              />
            </div>

            <div className="border-t border-line-medium my-3" />

            {/* Mode paiement */}
            <p className="font-bold uppercase text-[11px] tracking-wide text-text-secondary mb-1">
              Mode de paiement
            </p>
            <div className="space-y-1">
              {Object.entries(summary.modes_paiement).map(([mode, ttc]) => (
                <Row
                  key={mode}
                  label={mode === "stripe" ? "Stripe (CB online)" : mode}
                  value={formatEurFr(ttc)}
                />
              ))}
            </div>

            <div className="border-t border-line-medium my-3" />

            {/* Net */}
            <div className="space-y-1.5">
              <Row
                label="Frais Stripe"
                value={`− ${formatEurFr(summary.frais_stripe)}`}
              />
              <Row
                label="NET ENCAISSÉ"
                value={formatEurFr(summary.net_encaisse)}
                bold
                highlight
              />
              <Row
                label="Panier moyen"
                value={formatEurFr(summary.panier_moyen)}
              />
            </div>

            <div className="border-t border-line-medium my-3" />

            <p className="text-center text-[10.5px] text-text-secondary leading-relaxed">
              Document non fiscal au sens NF525.
              <br />
              À conserver pour la comptabilité.
            </p>
          </motion.div>
        )}
      </section>

      {/* Actions */}
      {summary && summary.status === "ok" && (
        <section className="px-5 mt-5 space-y-2.5">
          <button
            onClick={downloadPdf}
            className="w-full bg-primary text-white rounded-[18px] py-3.5 px-4 flex items-center justify-between shadow-card active:scale-[0.99] transition-transform"
          >
            <span className="inline-flex items-center gap-2.5">
              <FileText className="w-5 h-5" />
              <span className="font-bold text-[14px]">Télécharger PDF</span>
            </span>
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={downloadCsv}
            className="w-full bg-white border border-rule rounded-[18px] py-3.5 px-4 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="inline-flex items-center gap-2.5 text-text-primary">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span className="font-bold text-[14px]">
                CSV détaillé (ligne par ligne)
              </span>
            </span>
            <Download className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={sendEmail}
            className="w-full bg-cream border border-rule rounded-[18px] py-3 px-4 flex items-center justify-between active:scale-[0.99] transition-transform"
          >
            <span className="inline-flex items-center gap-2.5 text-text-primary">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-semibold text-[13px]">
                Envoyer par email au comptable
              </span>
            </span>
          </button>
          <p className="text-[10.5px] text-text-tertiary text-center pt-1">
            Cron auto : envoi quotidien à 23h59 (Europe/Paris).
          </p>
        </section>
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

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline ${
        highlight
          ? "bg-primary text-white -mx-2 px-3 py-1.5 rounded-md my-1"
          : ""
      }`}
    >
      <span
        className={`flex-1 ${bold ? "font-bold" : ""} ${
          highlight ? "" : "text-text-secondary"
        } text-[12px] uppercase tracking-wide`}
      >
        {label}
      </span>
      <span
        className={`tabular text-right ${bold ? "font-extrabold" : "font-semibold"} ${
          highlight ? "text-white" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
