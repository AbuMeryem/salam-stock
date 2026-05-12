"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { adjustStockManual } from "@/lib/db/stock-edit";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  produit: { id: string; nom: string; categorie?: string | null } | null;
  depotId: string;
  depotNom: string;
  quantiteActuelle: number;
  employeId: string;
  duringInventaire: boolean;
}

export function StockEditModal({
  open,
  onClose,
  onSaved,
  produit,
  depotId,
  depotNom,
  quantiteActuelle,
  employeId,
  duringInventaire,
}: Props) {
  const [qty, setQty] = useState<number>(quantiteActuelle);
  const [raison, setRaison] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQty(quantiteActuelle);
      setRaison("");
    }
  }, [open, quantiteActuelle]);

  async function save() {
    if (!produit) return;
    if (qty < 0) {
      toast.error("Quantité invalide");
      return;
    }
    if (qty === quantiteActuelle) {
      toast.warning("Aucun changement");
      return;
    }
    if (!raison.trim() && !duringInventaire) {
      toast.error("Raison obligatoire");
      return;
    }
    setSubmitting(true);
    try {
      await adjustStockManual({
        produit_id: produit.id,
        depot_id: depotId,
        quantite_apres: qty,
        raison: raison.trim() || (duringInventaire ? "Inventaire complet" : "Sans raison"),
        employe_id: employeId,
        during_inventaire: duringInventaire,
      });
      toast.success(
        `Stock ${produit.nom} : ${quantiteActuelle} → ${qty} (${depotNom})`
      );
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  if (!produit) return null;
  const delta = qty - quantiteActuelle;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-primary-dark/60 backdrop-blur-[6px]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-[460px] bg-white rounded-t-[28px] shadow-card-lg pb-[calc(var(--safe-bottom)+16px)]"
          >
            <div className="pt-2 pb-1 flex justify-center">
              <span className="w-10 h-1 rounded-full bg-line-medium" />
            </div>
            <div className="px-5 pb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-caps text-text-tertiary">Modifier le stock</p>
                <p className="text-base font-bold text-text-primary mt-1 truncate">
                  {produit.nom}
                </p>
                <p className="text-[11.5px] text-text-secondary">
                  Dépôt {depotNom}
                  {duringInventaire && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-gold-soft text-primary-dark rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      Inventaire
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 space-y-4">
              <div>
                <p className="label-caps text-text-tertiary mb-2">
                  Nouvelle quantité ({quantiteActuelle} actuellement)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty((q) => Math.max(0, q - 1))}
                    className="w-12 h-12 rounded-2xl bg-cream border border-rule flex items-center justify-center"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={qty}
                    onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
                    className="flex-1 input-field text-center text-2xl font-extrabold tabular"
                  />
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    className="w-12 h-12 rounded-2xl bg-cream border border-rule flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {delta !== 0 && (
                  <p
                    className={`text-[11.5px] font-bold mt-2 tabular text-center ${
                      delta > 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta} unités
                  </p>
                )}
              </div>

              <div>
                <p className="label-caps text-text-tertiary mb-2">
                  Raison {duringInventaire ? "(facultatif)" : "(obligatoire)"}
                </p>
                <input
                  type="text"
                  value={raison}
                  onChange={(e) => setRaison(e.target.value)}
                  placeholder={
                    duringInventaire
                      ? "Inventaire complet (par défaut)"
                      : "Ex: erreur saisie, démarque inconnue, retour client…"
                  }
                  className="input-field"
                />
              </div>

              <button
                onClick={() => void save()}
                disabled={submitting || (delta === 0)}
                className="w-full bg-primary text-white rounded-2xl py-3.5 inline-flex items-center justify-center gap-2 font-bold disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {submitting ? "Enregistrement…" : "Enregistrer + tracer"}
              </button>
              <p className="text-[10.5px] text-text-tertiary text-center">
                Tracé dans `stock_edit_log` avec ton ID employé + horodatage.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
