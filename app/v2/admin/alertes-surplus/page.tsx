"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  PackagePlus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { supabase } from "@/lib/supabase";
import { useV2 } from "@/lib/v2-store";

interface AlerteSurplus {
  id: string;
  bdl_id: string | null;
  code_barre_scanne: string;
  produit_id: string | null;
  quantite_surplus: number;
  signale_par: string | null;
  signale_le: string;
  statut: "en_attente" | "accepte" | "refuse";
  decideur: string | null;
  decide_le: string | null;
  photo_preuve_url: string | null;
  notes: string | null;
  produits: { id: string; nom: string; ean: string | null } | null;
  bons_de_livraison: {
    id: string;
    numero_bdl: string;
    fournisseurs: { id: string; nom: string } | null;
  } | null;
  stock_par_depot?: Array<{ prix_vente: number | null }>;
}

function fr(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function timeAgoFr(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function AlertesSurplusPage() {
  const router = useRouter();
  const employe = useV2((s) => s.currentEmploye);
  const [alertes, setAlertes] = useState<AlerteSurplus[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AlerteSurplus | null>(null);

  async function fetchAlertes() {
    setLoading(true);
    const sb = supabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data, error } = await sb
      .from("alertes_surplus")
      .select(
        `id, bdl_id, code_barre_scanne, produit_id, quantite_surplus, signale_par, signale_le, statut,
         decideur, decide_le, photo_preuve_url, notes,
         produits (id, nom, ean),
         bons_de_livraison (id, numero_bdl, fournisseurs (id, nom))`
      )
      .order("signale_le", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setAlertes((data ?? []) as unknown as AlerteSurplus[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchAlertes();
  }, []);

  async function decide(
    alerte: AlerteSurplus,
    statut: "accepte" | "refuse"
  ) {
    const sb = supabase();
    if (!sb) return;
    const { error } = await sb
      .from("alertes_surplus")
      .update({
        statut,
        decideur: employe?.id ?? null,
        decide_le: new Date().toISOString(),
      })
      .eq("id", alerte.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      statut === "accepte"
        ? "Surplus accepté · facture fournisseur à émettre"
        : "Surplus refusé · à retourner au fournisseur"
    );
    setDetail(null);
    void fetchAlertes();
  }

  const enAttente = alertes.filter((a) => a.statut === "en_attente");
  const historique = alertes.filter((a) => a.statut !== "en_attente");

  return (
    <V2Shell hideNav>
      <PageAccentStripe accent="or" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="section-eyebrow mt-3">
          <AlertTriangle className="w-3 h-3" />
          Surplus fournisseurs
        </p>
        <h1 className="h1 text-text-primary mt-1">Alertes à valider</h1>
        <p className="body-md text-text-secondary mt-1">
          Produits livrés en plus du bon de livraison. À accepter (facturer
          fournisseur) ou refuser (retourner).
        </p>
      </header>

      <section className="px-5 mt-5">
        {loading ? (
          <div className="bg-white border border-rule rounded-[20px] p-10 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">Chargement…</p>
          </div>
        ) : enAttente.length === 0 ? (
          <div className="bg-success-soft border border-success/20 rounded-[20px] p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="font-bold text-text-primary">Aucune alerte en attente</p>
            <p className="text-xs text-text-secondary mt-1">
              Tous les surplus signalés ont été traités.
            </p>
          </div>
        ) : (
          <>
            <p className="label-caps text-text-tertiary mb-2">
              {enAttente.length} alerte{enAttente.length > 1 ? "s" : ""} en attente
            </p>
            <div className="space-y-2.5">
              {enAttente.map((a) => (
                <AlertCard
                  key={a.id}
                  alerte={a}
                  onClick={() => setDetail(a)}
                />
              ))}
            </div>
          </>
        )}

        {historique.length > 0 && (
          <div className="mt-7">
            <p className="label-caps text-text-tertiary mb-2">
              Historique ({historique.length})
            </p>
            <div className="space-y-2 opacity-80">
              {historique.slice(0, 10).map((a) => (
                <AlertCard
                  key={a.id}
                  alerte={a}
                  onClick={() => setDetail(a)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-10 shadow-card-lg max-h-[88vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="label-caps text-danger">Surplus signalé</p>
                <button onClick={() => setDetail(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
              <h2 className="text-[20px] font-extrabold text-text-primary">
                {detail.produits?.nom ?? "Produit inconnu"}
              </h2>
              <p className="text-[12px] font-mono bg-cream text-text-tertiary inline-block px-2 py-1 rounded-lg mt-2">
                {detail.code_barre_scanne}
              </p>

              <dl className="mt-5 space-y-3 text-[13px]">
                <Row
                  label="Fournisseur"
                  value={detail.bons_de_livraison?.fournisseurs?.nom ?? "—"}
                />
                <Row
                  label="N° BDL"
                  value={detail.bons_de_livraison?.numero_bdl ?? "—"}
                />
                <Row
                  label="Quantité en surplus"
                  value={`${detail.quantite_surplus} unité${detail.quantite_surplus > 1 ? "s" : ""}`}
                />
                <Row label="Signalé" value={timeAgoFr(detail.signale_le)} />
                <Row
                  label="Statut"
                  value={
                    detail.statut === "en_attente"
                      ? "En attente"
                      : detail.statut === "accepte"
                        ? "Accepté"
                        : "Refusé"
                  }
                />
              </dl>

              {detail.notes && (
                <div className="mt-4 bg-cream rounded-2xl p-3">
                  <p className="label-caps text-text-tertiary mb-1">Note</p>
                  <p className="text-[13px] text-text-primary leading-relaxed">
                    {detail.notes}
                  </p>
                </div>
              )}

              {detail.photo_preuve_url && (
                <div className="mt-4">
                  <p className="label-caps text-text-tertiary mb-1.5">Photo preuve</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.photo_preuve_url}
                    alt="Preuve"
                    className="w-full aspect-[4/3] object-cover rounded-2xl border border-rule"
                  />
                </div>
              )}

              {detail.statut === "en_attente" && (
                <div className="mt-6 space-y-2.5">
                  <button
                    onClick={() => void decide(detail, "accepte")}
                    className="w-full bg-success text-white rounded-[18px] py-4 px-5 flex items-center justify-between font-bold shadow-card-lg active:scale-[0.99]"
                  >
                    <span className="text-left">
                      <span className="block label-caps text-white/80">
                        ACCEPTER
                      </span>
                      <span className="block text-[14px] font-extrabold">
                        Facturer au fournisseur
                      </span>
                    </span>
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => void decide(detail, "refuse")}
                    className="w-full bg-white border border-rule text-text-primary rounded-[18px] py-3.5 px-5 flex items-center justify-between font-bold active:scale-[0.99]"
                  >
                    <span className="text-left">
                      <span className="block label-caps text-text-tertiary">
                        REFUSER
                      </span>
                      <span className="block text-[14px] font-extrabold">
                        Retourner au fournisseur
                      </span>
                    </span>
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </V2Shell>
  );
}

function AlertCard({
  alerte,
  onClick,
}: {
  alerte: AlerteSurplus;
  onClick: () => void;
}) {
  const isPending = alerte.statut === "en_attente";
  return (
    <button
      onClick={onClick}
      className={`w-full bg-white border rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform ${
        isPending ? "border-danger/40 shadow-card" : "border-rule"
      }`}
    >
      <span
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          isPending
            ? "bg-danger-soft text-danger"
            : alerte.statut === "accepte"
              ? "bg-success-soft text-success"
              : "bg-cream text-text-tertiary"
        }`}
      >
        {isPending ? (
          <AlertTriangle className="w-5 h-5" />
        ) : alerte.statut === "accepte" ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-text-primary truncate">
          {alerte.produits?.nom ?? "Produit inconnu"}
        </p>
        <p className="text-[11.5px] text-text-secondary mt-0.5 truncate">
          {alerte.bons_de_livraison?.fournisseurs?.nom ?? "—"} · BDL{" "}
          {alerte.bons_de_livraison?.numero_bdl ?? "—"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[15px] font-extrabold text-text-primary tabular">
          +{alerte.quantite_surplus}
        </p>
        <p className="text-[10px] text-text-tertiary mt-0.5">
          {timeAgoFr(alerte.signale_le)}
        </p>
      </div>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-tertiary text-[12px] font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="font-bold text-text-primary text-right">{value}</span>
    </div>
  );
}
