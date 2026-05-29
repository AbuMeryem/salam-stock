"use client";

/**
 * PreparationWorkflow — UI de pesée + capture Stripe d'une commande Drive.
 *
 * Pour chaque ligne, en fonction de `produits.unit_type` :
 *   - unit            → checkbox "préparé" (le montant = prix_unitaire × quantite)
 *   - weight          → input poids réel (kg, step 0.01) → montant_reel = price_per_kg × poids
 *   - weight_bracket  → 3 boutons radio (les brackets définis sur le produit)
 *
 * À chaque saisie : calcul live de l'écart % et de l'action (auto_accept /
 * preparator_decision / client_notify / client_validation_required) via
 * `determineEcartAction` (lib/drive-pesee.ts).
 *
 * Bouton "Finaliser préparation" → server action `finalizePreparation` qui :
 *   1. (déjà fait au fil de l'eau) UPDATE chaque ligne
 *   2. INSERT drive_ecarts_poids pour les lignes avec écart > 0
 *   3. POST /api/stripe/capture-payment (depuis le server action)
 *   4. UPDATE commandes_drive.statut = 'prete_retrait'
 */
import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Scale,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeEcartPct,
  determineEcartAction,
  type EcartAction,
} from "@/lib/drive-pesee";
import {
  finalizePreparation,
  markLineWeighed,
} from "@/lib/staff/preparation-actions";
import { useStore } from "@/lib/store";
// TODO_DEMO_10_JUIN : hack centralisé dans lib/staff/auth-fallback.ts
// (cf. BLOCKERS.md B9), à retirer après Mission 4 (Supabase Auth câblée).
import { getUserUuid } from "@/lib/staff/auth-fallback";
import { formatCurrency } from "@/lib/utils/format";
import type {
  CommandeDetail,
  CommandeLigneDetail,
  ProduitDetail,
} from "./types";

interface Props {
  commande: CommandeDetail;
  initialLignes: CommandeLigneDetail[];
  onFinished: () => void;
}

interface LigneState {
  id: string;
  produit: ProduitDetail | null;
  quantite_commandee: number;
  prix_unitaire: number;
  montant_estime_ttc: number;
  // Saisie utilisateur
  unit_done: boolean;
  poids_kg: number | null;
  bracket_index: number | null;
  // Calculé
  montant_reel_ttc: number;
  saved: boolean;
  saving: boolean;
}

function lineUnitType(p: ProduitDetail | null): "unit" | "weight" | "weight_bracket" {
  return (p?.unit_type as "unit" | "weight" | "weight_bracket" | null) ?? "unit";
}

function initLigneState(l: CommandeLigneDetail): LigneState {
  const ut = lineUnitType(l.produits);
  const estime =
    Number(l.montant_estime_ttc ?? l.prix_unitaire * l.quantite) || 0;
  return {
    id: l.id,
    produit: l.produits,
    quantite_commandee: Number(l.quantite_estimee ?? l.quantite ?? 0),
    prix_unitaire: Number(l.prix_unitaire ?? 0),
    montant_estime_ttc: estime,
    unit_done: ut === "unit" ? l.quantite_reelle_pesee != null : false,
    poids_kg:
      ut === "weight"
        ? l.quantite_reelle_pesee != null
          ? Number(l.quantite_reelle_pesee)
          : null
        : null,
    bracket_index: null,
    montant_reel_ttc: Number(l.montant_reel_ttc ?? 0),
    saved: l.montant_reel_ttc != null,
    saving: false,
  };
}

const ACTION_LABEL: Record<EcartAction, string> = {
  auto_accept: "OK",
  preparator_decision: "Décision préparateur",
  client_notify: "Notifier client",
  client_validation_required: "Validation client requise",
};

function ecartColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 10) return "bg-[#F4E9C4]/50 text-[#0E3B2E] ring-[#0E3B2E]/20";
  if (abs <= 20) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

function ecartIcon(action: EcartAction) {
  if (action === "auto_accept") return <Check className="h-3.5 w-3.5" />;
  if (action === "client_notify") return <Bell className="h-3.5 w-3.5" />;
  if (action === "client_validation_required")
    return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Sparkles className="h-3.5 w-3.5" />;
}

export function PreparationWorkflow({
  commande,
  initialLignes,
  onFinished,
}: Props) {
  const currentUser = useStore((s) => s.currentUser);
  const [lignes, setLignes] = useState<LigneState[]>(() =>
    initialLignes.map(initLigneState),
  );
  const [submitting, startSubmit] = useTransition();

  function updateLine(id: string, patch: Partial<LigneState>) {
    setLignes((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function computeMontantReel(l: LigneState): number {
    const ut = lineUnitType(l.produit);
    if (ut === "unit") {
      return l.unit_done ? l.prix_unitaire * l.quantite_commandee : 0;
    }
    if (ut === "weight") {
      const ppk = Number(l.produit?.price_per_kg ?? 0);
      return l.poids_kg != null ? Number((ppk * l.poids_kg).toFixed(2)) : 0;
    }
    if (ut === "weight_bracket" && l.bracket_index != null) {
      const b = l.produit?.brackets_poids?.[l.bracket_index];
      return b ? Number(b.prix_ttc) : 0;
    }
    return 0;
  }

  async function persistLine(l: LigneState) {
    const montant = computeMontantReel(l);
    let quantite: number;
    const ut = lineUnitType(l.produit);
    if (ut === "weight") quantite = l.poids_kg ?? 0;
    else if (ut === "weight_bracket") {
      const b = l.produit?.brackets_poids?.[l.bracket_index ?? -1];
      quantite = b?.poids_kg ?? 0;
    } else {
      quantite = l.unit_done ? l.quantite_commandee : 0;
    }

    updateLine(l.id, {
      saving: true,
      montant_reel_ttc: montant,
    });

    const res = await markLineWeighed({
      line_id: l.id,
      quantite_reelle: quantite,
      montant_reel_ttc: montant,
      user_id: getUserUuid(currentUser?.id),
    });

    if (!res.ok) {
      toast.error(`Sauvegarde ligne échouée : ${res.error}`);
      updateLine(l.id, { saving: false, saved: false });
      return;
    }
    updateLine(l.id, { saving: false, saved: true });
  }

  const totals = useMemo(() => {
    let estime = 0;
    let reel = 0;
    let pesees = 0;
    for (const l of lignes) {
      estime += l.montant_estime_ttc;
      reel += l.montant_reel_ttc;
      if (l.saved) pesees++;
    }
    return { estime, reel, pesees, total: lignes.length };
  }, [lignes]);

  const allReady = lignes.every((l) => l.saved);
  const overAutorise =
    commande.montant_autorise_ttc != null &&
    totals.reel > commande.montant_autorise_ttc + 0.005;

  function handleFinalize() {
    if (!allReady) {
      toast.error("Toutes les lignes doivent être pesées.");
      return;
    }
    if (overAutorise) {
      toast.error(
        `Total réel ${formatCurrency(totals.reel)} > autorisé ${formatCurrency(
          commande.montant_autorise_ttc ?? 0,
        )}. Demander supplément client.`,
      );
      return;
    }
    startSubmit(async () => {
      const res = await finalizePreparation({
        commande_id: commande.id,
        user_id: getUserUuid(currentUser?.id),
        lignes: lignes.map((l) => ({
          id: l.id,
          montant_estime_ttc: l.montant_estime_ttc,
          montant_reel_ttc: l.montant_reel_ttc,
        })),
      });
      if (!res.ok) {
        toast.error(`Finalisation échouée : ${res.error}`);
        return;
      }
      const capturedMsg = res.montantCaptureTtc
        ? ` · capturé ${formatCurrency(res.montantCaptureTtc)}`
        : "";
      toast.success(`Préparation finalisée${capturedMsg}`);
      onFinished();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header commande */}
      <div className="rounded-2xl border border-[#E8E4D8] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              {commande.numero_commande}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[#0F1A14]">
              {commande.client_nom}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#6B7280]">
              {commande.client_telephone && (
                <span>{commande.client_telephone}</span>
              )}
              {commande.client_email && <span>{commande.client_email}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(commande.creneau_retrait).toLocaleString("fr-FR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/Paris",
                })}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F4E9C4] px-3 py-1 text-xs font-semibold uppercase text-[#0E3B2E]">
              <CreditCard className="h-3 w-3" />
              {commande.statut_paiement ?? "autorise"}
            </span>
            <p className="mt-2 text-xs text-[#6B7280]">
              {totals.pesees}/{totals.total} lignes pesées
            </p>
          </div>
        </div>

        {/* Totaux */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Estimé" value={formatCurrency(totals.estime)} />
          <Stat
            label="Autorisé"
            value={
              commande.montant_autorise_ttc != null
                ? formatCurrency(commande.montant_autorise_ttc)
                : "—"
            }
            tone="brand"
          />
          <Stat
            label="Réel pesé"
            value={formatCurrency(totals.reel)}
            tone={overAutorise ? "red" : "default"}
          />
        </div>
      </div>

      {/* Lignes */}
      <ul className="space-y-3">
        {lignes.map((l, idx) => (
          <motion.li
            key={l.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.03 }}
          >
            <LigneCard
              ligne={l}
              onChange={(patch) => updateLine(l.id, patch)}
              onPersist={() => persistLine(l)}
              computeMontant={computeMontantReel}
            />
          </motion.li>
        ))}
      </ul>

      {/* Footer sticky */}
      <div className="sticky bottom-0 -mx-4 border-t border-[#E8E4D8] bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[#6B7280]">
            {allReady ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[#0E3B2E]">
                <CheckCircle2 className="h-4 w-4" />
                Toutes les lignes sont pesées
              </span>
            ) : (
              <span>
                {totals.total - totals.pesees} ligne
                {totals.total - totals.pesees > 1 ? "s" : ""} restante
                {totals.total - totals.pesees > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!allReady || submitting || overAutorise}
            onClick={handleFinalize}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#082A20] disabled:cursor-not-allowed disabled:bg-[#6B7280]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Finaliser préparation & capturer
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- subcomponents -------------------------------- */

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand" | "red";
}) {
  const toneClass =
    tone === "brand"
      ? "text-[#0E3B2E]"
      : tone === "red"
        ? "text-red-700"
        : "text-[#0F1A14]";
  return (
    <div className="rounded-xl bg-[#FAF7EE] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function LigneCard({
  ligne,
  onChange,
  onPersist,
  computeMontant,
}: {
  ligne: LigneState;
  onChange: (patch: Partial<LigneState>) => void;
  onPersist: () => void | Promise<void>;
  computeMontant: (l: LigneState) => number;
}) {
  const ut = lineUnitType(ligne.produit);
  const liveMontant = computeMontant(ligne);
  const ecartPct =
    liveMontant > 0
      ? computeEcartPct(ligne.montant_estime_ttc, liveMontant)
      : 0;
  const ecartEur = liveMontant - ligne.montant_estime_ttc;
  const action: EcartAction = determineEcartAction(ecartPct, ecartEur);
  const hasSaisie =
    (ut === "unit" && ligne.unit_done) ||
    (ut === "weight" && ligne.poids_kg != null && ligne.poids_kg > 0) ||
    (ut === "weight_bracket" && ligne.bracket_index != null);

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        ligne.saved
          ? "border-[#0E3B2E]/20 bg-[#F4E9C4]/20"
          : "border-[#E8E4D8]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FAF7EE]">
          {ligne.produit?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ligne.produit.image_url}
              alt=""
              className="h-12 w-12 rounded-xl object-cover"
            />
          ) : (
            <ShoppingBag className="h-5 w-5 text-[#6B7280]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-bold text-[#0F1A14]">
            {ligne.produit?.nom ?? "Produit"}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6B7280]">
            <span>
              Commandé : <strong>{ligne.quantite_commandee}</strong>
              {ut === "weight" ? " kg" : ""}
            </span>
            <span>
              Estimé :{" "}
              <strong>{formatCurrency(ligne.montant_estime_ttc)}</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <Scale className="h-3 w-3" />
              {ut === "unit"
                ? "À l'unité"
                : ut === "weight"
                  ? "Au poids"
                  : "Par tranche"}
            </span>
          </div>
        </div>
        {ligne.saved && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F4E9C4] px-2 py-1 text-[11px] font-semibold uppercase text-[#0E3B2E]">
            <Check className="h-3 w-3" /> sauvegardée
          </span>
        )}
      </div>

      <div className="mt-4">
        {ut === "unit" && (
          <label className="flex items-center gap-3 rounded-xl bg-[#FAF7EE] px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ligne.unit_done}
              onChange={(e) => {
                onChange({ unit_done: e.target.checked });
              }}
              className="h-5 w-5 rounded border-[#E8E4D8] text-[#0E3B2E] focus:ring-[#0E3B2E]"
            />
            <span className="text-sm font-medium text-[#0F1A14]">
              {ligne.unit_done ? "Article prêt" : "Marquer comme préparé"}
            </span>
            <span className="ml-auto text-sm font-bold text-[#0F1A14]">
              {formatCurrency(liveMontant)}
            </span>
          </label>
        )}

        {ut === "weight" && (
          <div className="rounded-xl bg-[#FAF7EE] p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Poids réel pesé (kg)
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={ligne.poids_kg ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({ poids_kg: v === "" ? null : parseFloat(v) });
                }}
                className="w-32 rounded-lg border border-[#E8E4D8] bg-white px-3 py-2 text-lg font-semibold text-[#0F1A14] focus:border-[#0E3B2E] focus:outline-none focus:ring-1 focus:ring-[#0E3B2E]"
              />
              <span className="text-sm text-[#6B7280]">
                × {formatCurrency(Number(ligne.produit?.price_per_kg ?? 0))}/kg
              </span>
              <span className="ml-auto text-lg font-bold text-[#0F1A14]">
                {formatCurrency(liveMontant)}
              </span>
            </div>
            {ligne.produit?.poids_min_kg != null &&
              ligne.produit?.poids_max_kg != null && (
                <p className="mt-2 text-[11px] text-[#6B7280]">
                  Fourchette attendue : {ligne.produit.poids_min_kg} kg →{" "}
                  {ligne.produit.poids_max_kg} kg
                </p>
              )}
          </div>
        )}

        {ut === "weight_bracket" && (
          <div className="rounded-xl bg-[#FAF7EE] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Choisir une tranche
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(ligne.produit?.brackets_poids ?? []).map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ bracket_index: i })}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    ligne.bracket_index === i
                      ? "border-[#0E3B2E] bg-[#F4E9C4] ring-2 ring-[#0E3B2E]/20"
                      : "border-[#E8E4D8] bg-white hover:border-[#0E3B2E]/30"
                  }`}
                >
                  <p className="text-sm font-bold text-[#0F1A14]">{b.label}</p>
                  <p className="text-xs text-[#6B7280]">{b.poids_kg} kg</p>
                  <p className="mt-1 text-sm font-semibold text-[#0E3B2E]">
                    {formatCurrency(Number(b.prix_ttc))}
                  </p>
                </button>
              ))}
              {(!ligne.produit?.brackets_poids ||
                ligne.produit.brackets_poids.length === 0) && (
                <p className="col-span-full text-xs text-amber-700">
                  Aucune tranche définie sur ce produit — saisie impossible.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live écart + action + save */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {hasSaisie && liveMontant > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ring-1 ${ecartColor(ecartPct)}`}
            >
              {ecartPct > 0 ? "+" : ""}
              {ecartPct.toFixed(1)} % ({ecartEur > 0 ? "+" : ""}
              {formatCurrency(ecartEur)})
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ring-1 ${ecartColor(ecartPct)}`}
            >
              {ecartIcon(action)}
              {ACTION_LABEL[action]}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#6B7280]">En attente de saisie…</span>
        )}

        <button
          type="button"
          disabled={!hasSaisie || ligne.saving}
          onClick={() => void onPersist()}
          className="inline-flex items-center gap-1 rounded-lg border border-[#0E3B2E]/20 bg-[#F4E9C4] px-3 py-1.5 text-xs font-semibold text-[#0E3B2E] transition hover:bg-[#F4E9C4]/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ligne.saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : ligne.saved ? (
            <Check className="h-3 w-3" />
          ) : (
            <Scale className="h-3 w-3" />
          )}
          {ligne.saved ? "Re-sauver" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
