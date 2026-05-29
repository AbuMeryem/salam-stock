"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Sparkles,
  Sprout,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import {
  assignInventairesPourDepot,
  completeInventaire,
  listInventairesDuJour,
  listProduitsInDepot,
} from "@/lib/db";
import type { InventaireTournant, ProduitInDepot } from "@/lib/types/db";

interface Row extends InventaireTournant {
  produit?: ProduitInDepot;
}

export default function V2InventairePage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const employe = useV2((s) => s.currentEmploye);

  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!depot) return;
    void load();
  }, [depot]);

  async function load() {
    if (!depot) return;
    setLoading(true);
    try {
      let invs = await listInventairesDuJour({ depotId: depot.id });
      // Auto-assign 5 produits if none yet for today (the cron does this in prod).
      if (invs.length === 0) {
        invs = await assignInventairesPourDepot(depot.id, 5);
      }
      const stock = await listProduitsInDepot(depot.id);
      const merged: Row[] = invs.map((i) => ({
        ...i,
        produit: stock.find((p) => p.id === i.produit_id),
      }));
      setRows(merged);
    } catch (e) {
      console.error(e);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  const mine = useMemo(() => {
    if (!employe) return rows;
    // Show all but mark mine
    return rows.sort((a) => (a.employe_assigne_id === employe.id ? -1 : 1));
  }, [rows, employe]);

  async function validateAll() {
    if (!employe) return;

    const mineAssigned = rows.filter(
      (r) => r.statut === "assigne" && r.employe_assigne_id === employe.id
    );
    const fillable = mineAssigned.filter((r) => {
      const raw = (counts[r.id] ?? "").trim();
      if (raw === "") return false;
      const c = Number(raw);
      return Number.isFinite(c) && c >= 0;
    });

    if (mineAssigned.length === 0) {
      toast.error("Aucun produit à valider sur cet inventaire.", {
        id: "inv-nothing-to-do",
      });
      return;
    }

    if (fillable.length === 0) {
      toast.error(
        `Compte au moins un produit (sur ${mineAssigned.length}) avant de valider.`,
        { id: "inv-empty" }
      );
      return;
    }

    const partial = fillable.length < mineAssigned.length;
    if (partial) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          `Tu as compté ${fillable.length} produit${fillable.length > 1 ? "s" : ""} sur ${mineAssigned.length}. ` +
            "Valider partiellement ?\n\nLes produits non comptés resteront à compter plus tard."
        );
      if (!ok) return;
    }

    setSubmitting(true);
    let totalEcart = 0;
    let totalTheo = 0;
    try {
      for (const r of fillable) {
        const c = Number((counts[r.id] ?? "").trim());
        await completeInventaire(r.id, c);
        const ecart = c - (r.quantite_attendue ?? 0);
        totalEcart += Math.abs(ecart);
        totalTheo += r.quantite_attendue ?? 0;
      }
      const conf =
        totalTheo > 0 ? Math.max(0, 100 - (totalEcart / totalTheo) * 100) : 100;
      const progress = `${fillable.length}/${mineAssigned.length}`;
      const lowConf = conf < 95;
      // Push iPhone admin — inventaire complété (urgent si conformité basse)
      void import("@/lib/notifications").then((m) =>
        m.pushToAdmins({
          title: lowConf
            ? `⚠️ Inventaire ${depot?.nom ?? ""} · conformité ${conf.toFixed(0)}%`
            : `✅ Inventaire ${depot?.nom ?? ""} validé`,
          body: `${employe.prenom ?? "Employé"} a compté ${progress} produits · ${totalEcart} unités d'écart`,
          url: "/v2/inventaire/historique",
          tag: `inv-done-${Date.now()}`,
          urgent: lowConf,
        })
      );
      if (lowConf) {
        toast.warning(
          `Inventaire ${progress} validé · conformité ${conf.toFixed(1)}% · Otmane + Ahmed notifiés.`,
          { id: "inv-done" }
        );
        await fetch("/api/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "inventaire_low_conformite",
            payload: {
              depot: depot?.nom,
              employe: `${employe.prenom} ${employe.nom}`,
              conformite: conf,
              ecarts: totalEcart,
              comptes: fillable.length,
              assignes: mineAssigned.length,
            },
          }),
        }).catch(() => {});
      } else {
        toast.success(
          `Inventaire ${progress} validé · conformité ${conf.toFixed(1)}% · admin notifié.`,
          { id: "inv-done" }
        );
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la validation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <V2Shell hideNav>
      <PageAccentStripe accent="or" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Inventaire tournant</p>
        <h1 className="h1 text-text-primary mt-1">
          {rows.length} produit{rows.length > 1 ? "s" : ""} à compter
        </h1>
        <p className="body-md text-text-secondary mt-1">
          Tirage automatique chaque matin à 7h dans le dépôt actif.
        </p>
      </header>

      {loading ? (
        <div className="px-5 pt-10 text-center text-text-secondary">
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 pt-10 text-center text-text-secondary">
          Aucun inventaire assigné aujourd&apos;hui.
        </div>
      ) : (
        <section className="px-5 mt-5 space-y-3">
          <div className="bg-gold-soft rounded-2xl p-3 flex items-start gap-2 text-xs text-primary-dark">
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Les produits sont tirés au sort parmi le catalogue du dépôt
              actif. Compte physiquement, saisis la quantité, valide.
            </p>
          </div>
          {mine.map((r, i) => {
            const isMine = r.employe_assigne_id === employe?.id;
            const c = parseInt(counts[r.id] ?? "", 10);
            const ecart = !Number.isNaN(c) ? c - (r.quantite_attendue ?? 0) : null;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-white border rounded-2xl p-4 ${
                  isMine ? "border-primary" : "border-rule"
                }`}
              >
                <div className="flex items-start gap-3">
                  <ProductThumbnail
                    nom={r.produit?.nom ?? "?"}
                    categorie={r.produit?.categorie}
                    size={48}
                    rounded="xl"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary line-clamp-2">
                      {r.produit?.nom ?? "Produit"}
                    </p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {isMine ? "Assigné à toi" : "Assigné à un collègue"}
                      {r.statut === "compte" && " · compté"}
                      {r.statut === "valide" && " · validé"}
                    </p>
                  </div>
                </div>
                {r.statut === "assigne" && isMine ? (
                  <div className="flex items-end justify-between mt-4 gap-3">
                    <div>
                      <p className="label-caps text-text-tertiary">THÉORIQUE</p>
                      <p className="text-lg font-bold text-text-primary mt-0.5">
                        {r.quantite_attendue ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="label-caps text-text-tertiary text-right">COMPTÉ</p>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={counts[r.id] ?? ""}
                        onChange={(e) =>
                          setCounts((c) => ({ ...c, [r.id]: e.target.value }))
                        }
                        className="w-20 mt-0.5 text-center bg-cream border border-rule rounded-xl py-1.5 text-lg font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end justify-between mt-3 text-xs text-text-secondary">
                    <span>Théorique : {r.quantite_attendue ?? "—"}</span>
                    {r.quantite_comptee !== null && (
                      <span>
                        Compté : <strong>{r.quantite_comptee}</strong> · écart{" "}
                        <strong className={r.ecart === 0 ? "text-success" : "text-warning"}>
                          {r.ecart > 0 ? "+" : ""}
                          {r.ecart}
                        </strong>
                      </span>
                    )}
                  </div>
                )}
                {ecart !== null && ecart !== 0 && r.statut === "assigne" && isMine && (
                  <p className="text-[11px] text-warning font-bold mt-2">
                    Écart prévu : {ecart > 0 ? "+" : ""}
                    {ecart}
                  </p>
                )}
              </motion.div>
            );
          })}
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
          {(() => {
            const mineAssigned = rows.filter(
              (r) =>
                r.statut === "assigne" && r.employe_assigne_id === employe?.id
            );
            const filledCount = mineAssigned.filter((r) => {
              const raw = (counts[r.id] ?? "").trim();
              if (raw === "") return false;
              const c = Number(raw);
              return Number.isFinite(c) && c >= 0;
            }).length;
            const nothingAssigned = mineAssigned.length === 0;
            const noneFilled = !nothingAssigned && filledCount === 0;
            return (
              <button
                onClick={validateAll}
                disabled={submitting || nothingAssigned}
                className={`w-full rounded-[22px] px-5 py-4 flex items-center justify-between shadow-card-lg disabled:opacity-50 transition-colors ${
                  noneFilled
                    ? "bg-warning text-white"
                    : "bg-primary text-white"
                }`}
              >
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
                    {submitting
                      ? "Validation…"
                      : noneFilled
                        ? "Compte au moins 1 produit"
                        : "Valider l'inventaire"}
                  </p>
                  <p className="text-[15px] font-extrabold mt-0.5">
                    {filledCount}/{mineAssigned.length} compté
                    {mineAssigned.length > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="bg-white/15 backdrop-blur-sm rounded-full p-2.5">
                  {submitting ? (
                    <Sprout className="w-5 h-5" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </span>
              </button>
            );
          })()}
        </div>
      </div>
    </V2Shell>
  );
}
