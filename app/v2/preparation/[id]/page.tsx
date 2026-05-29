"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  Clock,
  CreditCard,
  Loader2,
  PackageMinus,
  Scale,
  ScanBarcode,
  ShoppingBag,
  Snowflake,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { ClientTypeBadge, type ClientType } from "@/components/v2/ClientTypeBadge";
import { useV2 } from "@/lib/v2-store";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import {
  findProduitByEan,
  listCommandesDrive,
  listDepots,
  listLignesPourCommande,
  listProduitsInDepot,
  setCommandeStatut,
  updateLignePreparation,
} from "@/lib/db";
import type {
  CommandeDrive,
  CommandeDriveLigne,
  Depot,
  Produit,
} from "@/lib/types/db";
import {
  computeEcartPct,
  determineEcartAction,
  type EcartAction,
} from "@/lib/drive-pesee";
import {
  finalizePreparation,
  markLineWeighed,
} from "@/lib/staff/preparation-actions";
import { getEmployeUuid, getUserUuid } from "@/lib/staff/auth-fallback";

interface EnrichedLigne extends CommandeDriveLigne {
  produit?: Produit;
  /** Saisie locale du poids pesé (kg) pour unit_type='weight'. */
  weighedKg?: string;
  /** Bracket choisi pour unit_type='weight_bracket' (index dans la liste). */
  weighedBracket?: number;
  /** Indicateur "ligne sauvegardée côté server action". */
  saved?: boolean;
  saving?: boolean;
}

const COLD_CATEGORIES = new Set(["Surgelés", "Frais", "Boucherie", "Charcuterie"]);

const ZONE_LABEL: Record<"particulier" | "professionnel" | "traiteur", string> = {
  particulier: "Zone Particulier",
  professionnel: "Zone Professionnel",
  traiteur: "Zone Traiteur",
};

const ZONE_EMOJI: Record<"particulier" | "professionnel" | "traiteur", string> = {
  particulier: "🛒",
  professionnel: "🏢",
  traiteur: "🍽️",
};

export default function V2PreparationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employe = useV2((s) => s.currentEmploye);

  const [commande, setCommande] = useState<CommandeDrive | null>(null);
  const [lignes, setLignes] = useState<EnrichedLigne[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [missingPhotoFor, setMissingPhotoFor] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    void load(params.id);
  }, [params?.id]);

  async function load(id: string) {
    const [cmds, deps] = await Promise.all([listCommandesDrive(), listDepots()]);
    const cmd = cmds.find((c) => c.id === id) ?? null;
    setCommande(cmd);
    setDepots(deps);
    if (!cmd) return;
    const ls = await listLignesPourCommande(id);
    // Enrich with produits + sort: cold first, then by depot
    const allByDepot = new Map<string, Awaited<ReturnType<typeof listProduitsInDepot>>>();
    const depotIds = Array.from(new Set(ls.map((l) => l.depot_id)));
    for (const dId of depotIds) {
      allByDepot.set(dId, await listProduitsInDepot(dId));
    }
    const enriched: EnrichedLigne[] = ls.map((l) => {
      const stock = allByDepot.get(l.depot_id) ?? [];
      const p = stock.find((x) => x.id === l.produit_id);
      return { ...l, produit: p };
    });
    setLignes(enriched);
  }

  /** Group by zone_preparation (particulier / professionnel / traiteur),
   *  cold-chain products first within each zone. */
  const groupedByZone = useMemo(() => {
    const order: Array<"particulier" | "professionnel" | "traiteur"> = [
      "particulier",
      "professionnel",
      "traiteur",
    ];
    const buckets = new Map<string, EnrichedLigne[]>();
    for (const l of lignes) {
      const zone = l.zone_preparation ?? "particulier";
      const list = buckets.get(zone) ?? [];
      list.push(l);
      buckets.set(zone, list);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => {
        const aCold = COLD_CATEGORIES.has(a.produit?.categorie ?? "") ? 0 : 1;
        const bCold = COLD_CATEGORIES.has(b.produit?.categorie ?? "") ? 0 : 1;
        return aCold - bCold;
      });
    }
    return order
      .map((z) => ({ zone: z, items: buckets.get(z) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [lignes]);

  const handleScanRef = useRef<((c: string) => void) | undefined>(undefined);
  const handleScan = async (code: string) => {
    setScannerOpen(false);
    const p = await findProduitByEan(code);
    if (!p) {
      toast.error("Code inconnu");
      return;
    }
    const ligne = lignes.find(
      (l) => l.produit_id === p.id && l.statut_preparation === "en_attente"
    );
    if (!ligne) {
      toast.warning(`${p.nom} n'est pas (ou plus) à préparer pour cette commande.`);
      return;
    }
    if (!employe) return;
    // FIX 2026-05-17 : employes.id ≠ profiles.id. Le zustand local
    // stocke un id non-UUID ("u-ahmed") ou un UUID profile. Pour la
    // FK prepare_par_employe_id → employes(id), on passe par
    // getEmployeUuid() qui fallback sur Ahmed Nasri.
    const employeUuid = getEmployeUuid(employe.id);
    await updateLignePreparation(ligne.id, {
      statut_preparation: "prepare",
      prepare_par_employe_id: employeUuid,
      prepare_at: new Date().toISOString(),
    });
    setLignes((prev) =>
      prev.map((l) =>
        l.id === ligne.id
          ? {
              ...l,
              statut_preparation: "prepare",
              prepare_par_employe_id: employeUuid,
              prepare_at: new Date().toISOString(),
            }
          : l
      )
    );
    toast.success(`${p.nom} préparé`);
  };
  handleScanRef.current = handleScan;

  async function markMissing(ligneId: string, photoUrl: string) {
    if (!employe) return;
    const employeUuid = getEmployeUuid(employe.id);
    await updateLignePreparation(ligneId, {
      statut_preparation: "manquant",
      prepare_par_employe_id: employeUuid,
      prepare_at: new Date().toISOString(),
    });
    setLignes((prev) =>
      prev.map((l) =>
        l.id === ligneId
          ? {
              ...l,
              statut_preparation: "manquant",
              prepare_par_employe_id: employeUuid,
              prepare_at: new Date().toISOString(),
            }
          : l
      )
    );
    toast.warning("Marqué manquant. Photo de l'étagère enregistrée.");
    void photoUrl;
  }

  // ─── Drive au poids — helpers pesée ────────────────────────────────
  /** Une ligne est "à peser" si son produit est weight ou weight_bracket. */
  function isWeightLine(l: EnrichedLigne): boolean {
    const ut = l.produit?.unit_type;
    return ut === "weight" || ut === "weight_bracket";
  }

  /** Calcule le montant_reel_ttc d'une ligne weight/bracket selon la
   *  saisie locale. Retourne null si saisie invalide. */
  function computeMontantReel(l: EnrichedLigne): number | null {
    const ut = l.produit?.unit_type ?? "unit";
    if (ut === "weight") {
      const kg = parseFloat(l.weighedKg ?? "");
      if (!Number.isFinite(kg) || kg <= 0) return null;
      const ppk = l.produit?.price_per_kg ?? 0;
      if (ppk <= 0) return null;
      return Math.round(ppk * kg * 100) / 100;
    }
    if (ut === "weight_bracket") {
      return Math.round((l.prix_unitaire ?? 0) * (l.quantite ?? 1) * 100) / 100;
    }
    return null;
  }

  async function saveWeightLigne(l: EnrichedLigne) {
    const montant = computeMontantReel(l);
    if (montant == null) {
      toast.error("Poids invalide");
      return;
    }
    const ut = l.produit?.unit_type ?? "unit";
    const quantiteReelle =
      ut === "weight" ? parseFloat(l.weighedKg ?? "0") : (l.weighedBracket ?? 0) + 1;
    setLignes((prev) =>
      prev.map((x) => (x.id === l.id ? { ...x, saving: true } : x)),
    );
    const res = await markLineWeighed({
      line_id: l.id,
      quantite_reelle: quantiteReelle,
      montant_reel_ttc: montant,
      user_id: getUserUuid(employe?.id ?? null),
      employe_id: getEmployeUuid(employe?.id ?? null),
    });
    if (!res.ok) {
      toast.error(`Sauvegarde échouée : ${res.error}`);
      setLignes((prev) =>
        prev.map((x) => (x.id === l.id ? { ...x, saving: false } : x)),
      );
      return;
    }
    setLignes((prev) =>
      prev.map((x) =>
        x.id === l.id
          ? {
              ...x,
              saving: false,
              saved: true,
              statut_preparation: "prepare",
              quantite_reelle_pesee: quantiteReelle,
              montant_reel_ttc: montant,
            }
          : x,
      ),
    );
    toast.success("Pesée enregistrée");
  }

  async function finalize() {
    if (!commande) return;
    // Branche Drive au poids — si la commande a un PI Stripe pré-
    // autorisé, on capture via le server action AVANT de notifier.
    // Sinon (commandes legacy 100% unit), flow scan + notify classique.
    if (commande.statut_paiement === "autorise") {
      const notDone = lignes.filter(
        (l) =>
          l.statut_preparation === "en_attente" ||
          (isWeightLine(l) && !l.saved && l.quantite_reelle_pesee == null),
      );
      if (notDone.length > 0) {
        toast.error(`${notDone.length} ligne(s) pas encore pesée(s)/préparée(s)`);
        return;
      }
      const res = await finalizePreparation({
        commande_id: commande.id,
        user_id: getUserUuid(employe?.id ?? null),
        lignes: lignes.map((l) => ({
          id: l.id,
          montant_estime_ttc: l.montant_estime_ttc ?? l.prix_unitaire * l.quantite,
          montant_reel_ttc:
            l.montant_reel_ttc ??
            computeMontantReel(l) ??
            l.montant_estime_ttc ??
            l.prix_unitaire * l.quantite,
        })),
      });
      if (!res.ok) {
        toast.error(`Capture Stripe échouée : ${res.error}`);
        return;
      }
      const captured = res.montantCaptureTtc;
      toast.success(
        captured != null
          ? `${commande.numero_commande} : ${captured.toFixed(2)} € capturés via Stripe`
          : `${commande.numero_commande} : finalisée (capture Stripe non confirmée — vérifier dashboard)`,
      );
      router.replace("/v2/preparation");
      return;
    }
    // Flow legacy (sans Stripe pré-auto)
    const remaining = lignes.filter((l) => l.statut_preparation === "en_attente");
    if (remaining.length > 0) {
      toast.error(`${remaining.length} ligne(s) encore en attente`);
      return;
    }
    await setCommandeStatut(commande.id, "pret");
    await fetch("/api/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "commande_prete",
        payload: {
          commande: commande.numero_commande,
          client: commande.client_nom,
          telephone: commande.client_telephone,
        },
      }),
    });
    // Send "commande prête" email — fire-and-forget
    if (commande.client_email) {
      fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: commande.client_email,
          subject: "Votre commande Salamarket est prête !",
          html: buildCommandePreteEmail({
            id: commande.id,
            numero_commande: commande.numero_commande,
            client_nom: commande.client_nom,
          }),
        }),
      }).catch(() => {});
    }
    toast.success(`Commande ${commande.numero_commande} prête. Client notifié.`);
    router.replace("/v2/preparation");
  }

  const totalCount = lignes.length;
  // Une ligne weight est "préparée" si elle a été pesée (saved=true OU
  // quantite_reelle_pesee renseignée) ; pour les lignes unit, le critère
  // historique reste statut_preparation !== en_attente.
  const prepCount = lignes.filter((l) => {
    if (isWeightLine(l)) {
      return l.saved === true || l.quantite_reelle_pesee != null;
    }
    return l.statut_preparation !== "en_attente";
  }).length;
  const isStripeFlow = commande?.statut_paiement === "autorise";
  const sumReelEur = lignes.reduce((s, l) => {
    if (isWeightLine(l)) {
      const m =
        l.montant_reel_ttc ?? computeMontantReel(l) ?? l.prix_unitaire * l.quantite;
      return s + m;
    }
    return s + l.prix_unitaire * l.quantite;
  }, 0);

  if (!commande) {
    return (
      <V2Shell hideNav>
        <div className="px-5 pt-10 text-center text-text-secondary">
          Commande introuvable.
        </div>
      </V2Shell>
    );
  }

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Préparation</p>
        <h1 className="h1 text-text-primary mt-1">
          {commande.numero_commande}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          {commande.client_nom} · retrait à {formatHeure(commande.creneau_retrait)}
        </p>
      </header>

      <section className="px-5 mt-4">
        <button
          onClick={() => setScannerOpen(true)}
          className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-center gap-2"
        >
          <ScanBarcode className="w-5 h-5" />
          <span className="font-bold">Scanner le produit collecté</span>
        </button>
      </section>

      <section className="px-5 mt-5 space-y-4">
        {groupedByZone.map((group) => (
          <div key={group.zone}>
            <p className="label-caps text-text-tertiary mb-2 inline-flex items-center gap-1">
              <span aria-hidden>{ZONE_EMOJI[group.zone]}</span>
              {ZONE_LABEL[group.zone]} · {group.items.length} produit
              {group.items.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {group.items.map((l, i) => {
                const cold = COLD_CATEGORIES.has(l.produit?.categorie ?? "");
                const done = l.statut_preparation !== "en_attente";
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-white border rounded-2xl p-3 flex items-center gap-3 ${
                      done ? "opacity-60 border-rule" : "border-rule"
                    }`}
                  >
                    <ProductThumbnail
                      nom={l.produit?.nom ?? "?"}
                      categorie={l.produit?.categorie}
                      size={48}
                      rounded="xl"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${done ? "line-through" : ""}`}>
                        {l.produit?.nom ?? "Produit"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <ClientTypeBadge
                          size="sm"
                          type={
                            (l.produit?.client_type as ClientType | undefined) ??
                            (l.zone_preparation === "professionnel"
                              ? "pro"
                              : l.zone_preparation === "traiteur"
                                ? "traiteur"
                                : "particulier")
                          }
                        />
                        <span className="text-[11px] text-text-tertiary inline-flex items-center gap-1">
                          Qté {l.quantite}
                          {cold && (
                            <span className="inline-flex items-center gap-0.5 text-blue-600 ml-1">
                              <Snowflake className="w-3 h-3" />
                              Frais
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    {/* — Ligne UNIT : scan / manquant / Check classique — */}
                    {!isWeightLine(l) && l.statut_preparation === "prepare" && (
                      <span className="text-success">
                        <Check className="w-5 h-5" />
                      </span>
                    )}
                    {!isWeightLine(l) && l.statut_preparation === "manquant" && (
                      <span className="badge badge-danger text-[10px]">Manquant</span>
                    )}
                    {!isWeightLine(l) && l.statut_preparation === "en_attente" && (
                      <button
                        onClick={() => setMissingPhotoFor(l.id)}
                        className="text-xs font-bold text-danger px-2 py-1.5 rounded-lg bg-danger-soft inline-flex items-center gap-1"
                      >
                        <PackageMinus className="w-3 h-3" />
                        Manquant
                      </button>
                    )}
                    {/* — Ligne WEIGHT/BRACKET : pesée Stripe — */}
                    {isWeightLine(l) && (
                      <WeightLineRow
                        ligne={l}
                        onChange={(patch) =>
                          setLignes((prev) =>
                            prev.map((x) =>
                              x.id === l.id ? { ...x, ...patch } : x,
                            ),
                          )
                        }
                        onSave={() => saveWeightLigne(l)}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
          <button
            onClick={finalize}
            disabled={prepCount < totalCount}
            className="w-full bg-primary text-white rounded-[22px] px-5 py-4 flex items-center justify-between shadow-card-lg disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
                {isStripeFlow ? "Finaliser & capturer" : "Marquer prêt"}
              </p>
              <p className="text-[15px] font-extrabold mt-0.5">
                {isStripeFlow
                  ? `${sumReelEur.toFixed(2)} €`
                  : `${prepCount}/${totalCount} préparés`}
              </p>
            </div>
            <span className="bg-white/15 backdrop-blur-sm rounded-full p-2.5">
              {isStripeFlow ? (
                <CreditCard className="w-5 h-5" />
              ) : (
                <ShoppingBag className="w-5 h-5" />
              )}
            </span>
          </button>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(c) => handleScanRef.current?.(c)}
      />
      <PhotoCapture
        open={!!missingPhotoFor}
        onClose={() => setMissingPhotoFor(null)}
        onCapture={(photo) => {
          if (missingPhotoFor) {
            void markMissing(missingPhotoFor, photo);
            setMissingPhotoFor(null);
          }
        }}
      />
    </V2Shell>
  );
}

// ─── Composant pesée drive au poids (palette V2) ─────────────────────
function WeightLineRow({
  ligne,
  onChange,
  onSave,
}: {
  ligne: EnrichedLigne;
  onChange: (patch: Partial<EnrichedLigne>) => void;
  onSave: () => Promise<void> | void;
}) {
  const ut = ligne.produit?.unit_type ?? "unit";
  const estimeTtc =
    ligne.montant_estime_ttc ?? ligne.prix_unitaire * ligne.quantite;
  const reelTtcLive =
    ut === "weight"
      ? (() => {
          const kg = parseFloat(ligne.weighedKg ?? "");
          if (!Number.isFinite(kg) || kg <= 0) return null;
          const ppk = ligne.produit?.price_per_kg ?? 0;
          return ppk > 0 ? ppk * kg : null;
        })()
      : ut === "weight_bracket"
        ? ligne.prix_unitaire
        : null;
  const pct =
    reelTtcLive != null && estimeTtc > 0
      ? computeEcartPct(estimeTtc, reelTtcLive)
      : 0;
  const eurEcart =
    reelTtcLive != null ? Number((reelTtcLive - estimeTtc).toFixed(2)) : 0;
  const action: EcartAction | null =
    reelTtcLive != null ? determineEcartAction(pct, eurEcart) : null;

  return (
    <div className="flex flex-col items-end gap-1.5 min-w-[140px]">
      {/* Champ saisie selon le type */}
      {ut === "weight" && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="kg"
            value={ligne.weighedKg ?? ""}
            onChange={(e) => onChange({ weighedKg: e.target.value })}
            className="w-20 px-2 py-1 rounded-lg border border-rule text-[13px] text-right tabular bg-cream focus:outline-none focus:border-primary"
            aria-label={`Poids pesé ${ligne.produit?.nom ?? ""}`}
          />
          <span className="text-[10px] text-text-tertiary">kg</span>
        </div>
      )}
      {ut === "weight_bracket" && (
        <div className="text-[11px] text-text-secondary text-right">
          <span className="font-semibold text-primary">
            {ligne.produit?.poids_min_kg}-{ligne.produit?.poids_max_kg} kg
          </span>
          <span className="ml-1">· {ligne.prix_unitaire.toFixed(2)} €</span>
        </div>
      )}

      {/* Badge écart live */}
      {action && (
        <span
          className={
            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full " +
            (action === "auto_accept"
              ? "bg-success-soft text-success"
              : action === "preparator_decision"
                ? "bg-gold-soft text-primary-dark"
                : action === "client_notify"
                  ? "bg-warning-soft text-warning"
                  : "bg-danger-soft text-danger")
          }
          title={`Écart ${pct.toFixed(1)}% (${eurEcart >= 0 ? "+" : ""}${eurEcart} €) — action ${action}`}
        >
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(1)}%
        </span>
      )}

      {/* Bouton Enregistrer / état saved */}
      {ligne.saved ? (
        <span className="text-[10px] text-success inline-flex items-center gap-1">
          <Check className="w-3 h-3" />
          Pesée enregistrée
        </span>
      ) : (
        <button
          onClick={() => void onSave()}
          disabled={ligne.saving || reelTtcLive == null}
          className="text-[11px] font-bold text-white bg-primary px-2 py-1 rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
        >
          {ligne.saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Scale className="w-3 h-3" />
          )}
          Enregistrer
        </button>
      )}
    </div>
  );
}

function formatHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCommandePreteEmail(commande: {
  id: string;
  numero_commande?: string | null;
  client_nom?: string | null;
}): string {
  const ref = commande.numero_commande || commande.id.slice(0, 8).toUpperCase();
  const greeting = commande.client_nom ? ` ${commande.client_nom}` : "";
  return `<div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background: linear-gradient(180deg, #0E3B2E 0%, #082A20 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #C9A227; font-size: 20px; margin: 0;">Salamarket Drive</h1>
  </div>
  <div style="background: #FAF7EE; padding: 24px; border-radius: 0 0 12px 12px;">
    <h2 style="color: #0E3B2E; font-size: 18px;">Votre commande est prête !</h2>
    <p style="color: #0F1A14; font-size: 14px; line-height: 1.6;">
      Bonjour${greeting},<br><br>
      Votre commande <strong>${ref}</strong> est prête à être retirée.
    </p>
    <div style="background: white; border: 1px solid #E8E4D8; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; font-size: 13px; color: #6B7280;">📍 Retrait au</p>
      <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #0E3B2E;">8 av. Larrieu-Thibaud, 31100 Toulouse</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #6B7280;">Lun-Sam 10h-19h30 · Dimanche 10h-18h</p>
    </div>
    <p style="color: #0F1A14; font-size: 14px;">À très vite !</p>
    <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">L'équipe Salamarket</p>
  </div>
</div>`;
}
