"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  Package,
  PackageOpen,
  PackagePlus,
  ScanBarcode,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import {
  addReceptionLigne,
  createReception,
  findCarton,
  findProduitByEan,
  learnCarton,
  searchProduits,
  validateReception,
} from "@/lib/db";
import type { Produit } from "@/lib/types/db";

interface ScanRow {
  id: string;
  produitId: string;
  produitNom: string;
  codeScanne: string;
  quantite: number;
  source: "unit" | "carton";
  cartonInfo?: { ean: string; multiplier: number };
}

type Step = "intake" | "scanning" | "validate";

export default function V2ReceptionPage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const employe = useV2((s) => s.currentEmploye);

  const [step, setStep] = useState<Step>("intake");
  const [fournisseur, setFournisseur] = useState("");
  const [numeroBl, setNumeroBl] = useState("");
  const [photoCarton, setPhotoCarton] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const [receptionId, setReceptionId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Unknown EAN handling (learning workflow)
  const [unknownEan, setUnknownEan] = useState<string | null>(null);
  const [learnMode, setLearnMode] = useState<"select" | "carton-qty" | "carton-unit-scan" | "search">(
    "select"
  );
  const [cartonQty, setCartonQty] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Produit[]>([]);
  const [pendingProduitForCarton, setPendingProduitForCarton] = useState<Produit | null>(null);

  // Avoid stale-closure on the scanner callback
  const scansRef = useRef(scans);
  scansRef.current = scans;
  const receptionIdRef = useRef(receptionId);
  receptionIdRef.current = receptionId;
  const handleScanRef = useRef<((code: string) => void) | undefined>(undefined);

  async function handleScan(code: string) {
    if (!receptionIdRef.current || !depot) return;
    setScannerOpen(false);
    // 1. Try carton
    const carton = await findCarton(code);
    if (carton) {
      const produit = await findProduitByEanInternal(carton.produit_id);
      if (produit) {
        await pushScan({
          code,
          produit,
          quantite: carton.quantite_par_carton,
          source: "carton",
          cartonInfo: { ean: carton.ean_carton, multiplier: carton.quantite_par_carton },
        });
        toast.success(
          `Carton ${produit.nom} · +${carton.quantite_par_carton}`,
          { duration: 2000 }
        );
        return;
      }
    }
    // 2. Try unit
    const produit = await findProduitByEan(code);
    if (produit) {
      await pushScan({ code, produit, quantite: 1, source: "unit" });
      toast.success(`${produit.nom} · +1`, { duration: 1800 });
      return;
    }
    // 3. Unknown — open learning workflow
    setUnknownEan(code);
    setLearnMode("select");
    setCartonQty(0);
    setSearchQuery("");
    setSearchResults([]);
    setPendingProduitForCarton(null);
  }
  handleScanRef.current = handleScan;

  // Helper: lookup produit by id (prefer DB, fallback search)
  async function findProduitByEanInternal(produitId: string): Promise<Produit | null> {
    // Carton stores produit_id, but we don't have a direct getter; re-search by id via search.
    // For local mode, lookup in seed.
    const { SEED_PRODUITS } = await import("@/lib/db/seed-local");
    const local = SEED_PRODUITS.find((p) => p.id === produitId);
    if (local) return local;
    // Supabase: fetch directly
    const { supabase } = await import("@/lib/supabase");
    const sb = supabase();
    if (sb) {
      const { data } = await sb
        .from("produits")
        .select("*")
        .eq("id", produitId)
        .maybeSingle();
      return (data as Produit) ?? null;
    }
    return null;
  }

  async function pushScan(args: {
    code: string;
    produit: Produit;
    quantite: number;
    source: "unit" | "carton";
    cartonInfo?: { ean: string; multiplier: number };
  }) {
    const id = await addReceptionLigne({
      reception_id: receptionIdRef.current!,
      produit_id: args.produit.id,
      code_scanne: args.code,
      quantite_calculee: args.quantite,
    });
    setScans((prev) => [
      ...prev,
      {
        id: id.id,
        produitId: args.produit.id,
        produitNom: args.produit.nom,
        codeScanne: args.code,
        quantite: args.quantite,
        source: args.source,
        cartonInfo: args.cartonInfo,
      },
    ]);
  }

  async function startReception() {
    if (!depot || !employe) {
      toast.error("Dépôt et employé requis");
      return;
    }
    if (!photoCarton) {
      toast.error("Photo du carton/palette obligatoire");
      return;
    }
    try {
      const r = await createReception({
        depot_id: depot.id,
        employe_id: employe.id,
        fournisseur: fournisseur || undefined,
        numero_bl: numeroBl || undefined,
        photo_url: photoCarton,
      });
      setReceptionId(r.id);
      setStep("scanning");
    } catch (e) {
      console.error(e);
      toast.error("Erreur de création de la réception");
    }
  }

  async function finalize() {
    if (!receptionId) {
      toast.error("Réception non initialisée");
      return;
    }
    const isEmpty = scans.length === 0;
    if (isEmpty) {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          "Aucun produit scanné. Valider quand même une réception vide ?\n\n" +
            "Cela enregistrera un bon de livraison fournisseur sans contenu — utile pour signaler une livraison incomplète. Une alerte sera levée sur le dashboard admin."
        );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      await validateReception(receptionId, { vide: isEmpty });
      if (isEmpty) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "reception_vide",
            payload: {
              reception_id: receptionId,
              depot: depot?.nom,
              employe: `${employe?.prenom} ${employe?.nom}`,
              fournisseur: fournisseur || "(non renseigné)",
              numero_bl: numeroBl || "(non renseigné)",
            },
          }),
        }).catch(() => {});
        toast.warning("Réception vide enregistrée. Otmane notifié.");
      } else {
        toast.success("Réception validée. Stock mis à jour.");
      }
      router.replace("/v2");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la validation");
    } finally {
      setSubmitting(false);
    }
  }

  // Search unknown product
  useEffect(() => {
    if (learnMode !== "search" && learnMode !== "carton-unit-scan") return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchProduits(searchQuery);
      setSearchResults(r);
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, learnMode]);

  function handleLearnUnitFor(produit: Produit) {
    if (!unknownEan) return;
    if (pendingProduitForCarton) {
      // We're in carton-unit-scan mode: link the carton to this product.
      void learnCarton({
        ean_carton: pendingProduitForCarton.ean ?? "",
        produit_id: produit.id,
        quantite_par_carton: cartonQty,
        learned_by: employe?.id,
        fournisseur: fournisseur || undefined,
      })
        .then(() =>
          pushScan({
            code: unknownEan,
            produit,
            quantite: cartonQty,
            source: "carton",
            cartonInfo: { ean: unknownEan, multiplier: cartonQty },
          })
        )
        .then(() => {
          toast.success(
            `Carton appris : ${produit.nom} × ${cartonQty}`,
            { duration: 2200 }
          );
          closeLearn();
        });
    } else {
      void pushScan({ code: unknownEan, produit, quantite: 1, source: "unit" }).then(() => {
        toast.success(`${produit.nom} · +1`);
        closeLearn();
      });
    }
  }

  function closeLearn() {
    setUnknownEan(null);
    setSearchQuery("");
    setSearchResults([]);
    setLearnMode("select");
    setPendingProduitForCarton(null);
    setCartonQty(0);
  }

  const totalUnits = useMemo(
    () => scans.reduce((s, r) => s + r.quantite, 0),
    [scans]
  );

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-primary mt-3">Réception fournisseur</p>
        <h1 className="h1 text-text-primary mt-1">
          {step === "intake"
            ? "Nouvelle réception"
            : step === "scanning"
              ? "Scanner les produits"
              : "Valider la réception"}
        </h1>
      </header>

      {step === "intake" && (
        <section className="px-5 mt-6 space-y-4">
          <Field label="Fournisseur (optionnel)">
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Maamora, Doux Halal…"
              className="input-field"
            />
          </Field>
          <Field label="Numéro de bon de livraison (optionnel)">
            <input
              value={numeroBl}
              onChange={(e) => setNumeroBl(e.target.value)}
              placeholder="BL-2026-…"
              className="input-field"
            />
          </Field>

          <div>
            <p className="label-caps text-text-tertiary mb-2">
              Photo du carton / palette
              <span className="text-danger ml-1">*</span>
            </p>
            {photoCarton ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoCarton}
                  alt="Photo carton"
                  className="w-full h-44 object-cover rounded-2xl border border-rule"
                />
                <button
                  onClick={() => setPhotoOpen(true)}
                  className="absolute bottom-2 right-2 bg-white text-primary text-xs font-bold rounded-full px-3 py-1.5 shadow"
                >
                  Reprendre
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPhotoOpen(true)}
                className="w-full bg-cream border-2 border-dashed border-primary/30 rounded-2xl py-8 flex flex-col items-center gap-2 text-primary"
              >
                <Camera className="w-6 h-6" />
                <span className="text-sm font-bold">Prendre la photo</span>
                <span className="text-xs text-text-secondary">Obligatoire</span>
              </button>
            )}
          </div>

          <button
            onClick={startReception}
            disabled={!photoCarton}
            className="btn-primary w-full disabled:opacity-50"
          >
            Démarrer la réception
          </button>
        </section>
      )}

      {step === "scanning" && (
        <>
          <section className="px-5 mt-5">
            <button
              onClick={() => setScannerOpen(true)}
              className="w-full bg-primary text-white rounded-[20px] py-5 px-5 flex items-center justify-between shadow-card-lg active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-gold/20 text-gold flex items-center justify-center">
                  <ScanBarcode className="w-6 h-6" />
                </span>
                <span className="text-left">
                  <span className="block label-caps text-gold">SCANNER</span>
                  <span className="block font-bold">Scanner un code-barres</span>
                </span>
              </span>
              <PackagePlus className="w-5 h-5 text-gold" />
            </button>
          </section>

          <section className="px-5 mt-5 pb-cta-only">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-text-primary">
                {scans.length} ligne{scans.length > 1 ? "s" : ""} scannée
                {scans.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-text-secondary">
                {totalUnits} unité{totalUnits > 1 ? "s" : ""} au total
              </p>
            </div>
            {scans.length === 0 ? (
              <div className="bg-cream border border-rule rounded-2xl p-6 text-center text-text-secondary text-sm">
                Aucun produit scanné. Scanne le premier code-barres.
              </div>
            ) : (
              <div className="space-y-2">
                {scans.map((row) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-rule rounded-xl p-3 flex items-center gap-3"
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        row.source === "carton"
                          ? "bg-gold-soft text-primary-dark"
                          : "bg-cream text-primary"
                      }`}
                    >
                      {row.source === "carton" ? (
                        <Package className="w-4 h-4" />
                      ) : (
                        <PackageOpen className="w-4 h-4" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">
                        {row.produitNom}
                      </p>
                      <p className="text-[11px] text-text-tertiary font-mono">
                        {row.codeScanne}
                        {row.cartonInfo &&
                          ` · carton × ${row.cartonInfo.multiplier}`}
                      </p>
                    </div>
                    <span className="text-base font-extrabold text-primary tabular-nums">
                      +{row.quantite}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
            <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
              <button
                onClick={finalize}
                disabled={submitting}
                className={`w-full rounded-[22px] px-5 py-4 flex items-center justify-between shadow-card-lg disabled:opacity-50 transition-colors ${
                  scans.length === 0
                    ? "bg-warning text-white"
                    : "bg-primary text-white"
                }`}
              >
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
                    {submitting
                      ? "Validation…"
                      : scans.length === 0
                        ? "Valider sans scan"
                        : "Valider la réception"}
                  </p>
                  <p className="text-[15px] font-extrabold mt-0.5">
                    {scans.length === 0
                      ? "Aucun produit · confirmation requise"
                      : `${scans.length} ligne${scans.length > 1 ? "s" : ""} · ${totalUnits} unité${totalUnits > 1 ? "s" : ""}`}
                  </p>
                </div>
                <span className="bg-white/15 backdrop-blur-sm rounded-full p-2.5">
                  <Check className="w-5 h-5" />
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => handleScanRef.current?.(code)}
      />
      <PhotoCapture
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onCapture={(d) => setPhotoCarton(d)}
      />

      {/* UNKNOWN EAN — LEARNING WORKFLOW */}
      {unknownEan && (
        <div className="fixed inset-0 z-[70] fixed-overlay flex items-end justify-center">
          <div className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-10 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-text-primary">
                Code inconnu
              </p>
              <button onClick={closeLearn}>
                <X className="w-4 h-4 text-text-tertiary" />
              </button>
            </div>
            <p className="text-xs font-mono bg-cream rounded-xl px-3 py-2 text-text-primary">
              {unknownEan}
            </p>

            {learnMode === "select" && (
              <>
                <h3 className="text-lg font-bold text-text-primary mt-5">
                  Carton ou unité ?
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Si c&apos;est un carton, on va apprendre combien d&apos;unités sont dedans pour la prochaine fois.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button
                    onClick={() => setLearnMode("carton-qty")}
                    className="bg-gold-soft text-primary-dark rounded-2xl py-5 flex flex-col items-center gap-2 active:scale-95"
                  >
                    <Package className="w-6 h-6" />
                    <span className="font-bold">Carton</span>
                  </button>
                  <button
                    onClick={() => setLearnMode("search")}
                    className="bg-cream text-primary rounded-2xl py-5 flex flex-col items-center gap-2 active:scale-95"
                  >
                    <PackageOpen className="w-6 h-6" />
                    <span className="font-bold">Unité</span>
                  </button>
                </div>
              </>
            )}

            {learnMode === "carton-qty" && (
              <>
                <h3 className="text-lg font-bold text-text-primary mt-5">
                  Combien d&apos;unités dans ce carton ?
                </h3>
                <input
                  type="number"
                  value={cartonQty || ""}
                  onChange={(e) =>
                    setCartonQty(parseInt(e.target.value || "0", 10))
                  }
                  inputMode="numeric"
                  placeholder="ex : 12"
                  className="input-field mt-4 text-2xl font-bold text-center"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (cartonQty > 0) {
                      // We need a fake "produit" to attach: use the unknown EAN as carton EAN, then ask the user to pick the underlying produit.
                      setPendingProduitForCarton({
                        id: "_pending",
                        ean: unknownEan,
                        nom: "(à choisir)",
                        marque: null,
                        categorie: null,
                        sous_categorie: null,
                        image_url: null,
                        description: null,
                        requires_barcode_print: false,
                        est_traiteur: false,
                        created_at: "",
                        updated_at: "",
                      });
                      setLearnMode("carton-unit-scan");
                    }
                  }}
                  disabled={cartonQty <= 0}
                  className="btn-primary w-full mt-5 disabled:opacity-50"
                >
                  Suivant
                </button>
              </>
            )}

            {(learnMode === "search" || learnMode === "carton-unit-scan") && (
              <>
                <h3 className="text-lg font-bold text-text-primary mt-5">
                  {learnMode === "carton-unit-scan"
                    ? "Quel produit est dans le carton ?"
                    : "Quel produit ?"}
                </h3>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom, marque, code…"
                    className="input-field !pl-10"
                    autoFocus
                  />
                </div>
                <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleLearnUnitFor(p)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl active:bg-cream"
                    >
                      <ProductThumbnail
                        nom={p.nom}
                        categorie={p.categorie}
                        size={36}
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {p.nom}
                        </p>
                        <p className="text-xs text-text-tertiary">{p.marque}</p>
                      </div>
                    </button>
                  ))}
                  {searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p className="text-xs text-text-tertiary text-center py-4">
                      Aucun résultat
                    </p>
                  )}
                </div>
              </>
            )}

            <button
              onClick={closeLearn}
              className="text-text-secondary text-sm font-semibold mt-4 mx-auto block"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </V2Shell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-caps text-text-tertiary block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
