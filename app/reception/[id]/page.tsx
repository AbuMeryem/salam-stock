"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Minus,
  Plus,
  ScanBarcode,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import { EcartBadge } from "@/components/reception/EcartBadge";
import { ecartPct, generateInternalEAN } from "@/lib/utils/format";
import type { Reception, ReceptionLine } from "@/lib/types";

interface LineState {
  product_id: string;
  quantite_commandee: number;
  quantite_recue: number;
  scanned: boolean;
  photos: string[];
  generatedBarcode?: string;
}

export default function ReceptionTunnel() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const user = useStore((s) => s.currentUser);
  const addReception = useStore((s) => s.addReception);
  const markOrderReceived = useStore((s) => s.markOrderReceived);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const supplier = order ? suppliers.find((s) => s.id === order.supplier_id) : null;

  const [lines, setLines] = useState<LineState[]>(() =>
    order?.lignes.map((l) => ({
      product_id: l.product_id,
      quantite_commandee: l.quantite_commandee,
      quantite_recue: 0,
      scanned: false,
      photos: [],
    })) ?? []
  );

  useEffect(() => {
    if (order && lines.length === 0) {
      setLines(
        order.lignes.map((l) => ({
          product_id: l.product_id,
          quantite_commandee: l.quantite_commandee,
          quantite_recue: 0,
          scanned: false,
          photos: [],
        }))
      );
    }
  }, [order, lines.length]);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoForLine, setPhotoForLine] = useState<string | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const focusedLineRef = useRef<string | null>(null);

  if (!order) {
    return (
      <PageWrapper hideNav>
        <div className="px-6 py-12 text-center">
          <p className="text-text-secondary">Bon de commande introuvable.</p>
          <button onClick={() => router.replace("/reception")} className="btn-primary mt-6">
            Retour aux réceptions
          </button>
        </div>
      </PageWrapper>
    );
  }

  const totalLines = lines.length;
  const linesWithQty = lines.filter((l) => l.quantite_recue > 0).length;
  const totalPhotos = lines.reduce((s, l) => s + l.photos.length, 0);
  const allFilled = lines.every((l) => l.quantite_recue > 0);

  const totalCommande = lines.reduce((s, l) => s + l.quantite_commandee, 0);
  const totalRecue = lines.reduce((s, l) => s + l.quantite_recue, 0);
  const ecartGlobal = totalCommande > 0 ? ((totalRecue - totalCommande) / totalCommande) * 100 : 0;
  const ecartGlobalAbs = Math.abs(ecartGlobal);

  const canValidate = allFilled && totalPhotos > 0;

  function updateLine(productId: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l) => (l.product_id === productId ? { ...l, ...patch } : l))
    );
  }

  function increment(productId: string, delta: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.product_id === productId
          ? { ...l, quantite_recue: Math.max(0, l.quantite_recue + delta) }
          : l
      )
    );
  }

  function handleScan(code: string) {
    setScannerOpen(false);
    const product = products.find((p) => p.barcode === code);
    if (product) {
      const line = lines.find((l) => l.product_id === product.id);
      if (line) {
        updateLine(product.id, {
          quantite_recue: line.quantite_recue + 1,
          scanned: true,
        });
        toast.success(`${product.name} · +1 unité`, { duration: 1800 });
      } else {
        toast.warning(`Code reconnu, mais ${product.name} n'est pas dans ce BL.`);
      }
    } else {
      setUnknownBarcode(code);
    }
  }

  function generateBarcode(productId: string) {
    const ean = generateInternalEAN();
    updateLine(productId, { generatedBarcode: ean, scanned: true });
    toast.success(`Code-barres interne généré : ${ean}`);
  }

  function openPhoto(productId: string) {
    focusedLineRef.current = productId;
    setPhotoForLine(productId);
  }

  function handleCapture(dataUrl: string) {
    const id = focusedLineRef.current;
    if (!id) return;
    setLines((prev) =>
      prev.map((l) =>
        l.product_id === id ? { ...l, photos: [...l.photos, dataUrl] } : l
      )
    );
    toast.success("Photo enregistrée");
  }

  function tryValidate() {
    if (!canValidate) {
      toast.error("Saisis chaque quantité et au moins une photo de carton.");
      return;
    }
    if (ecartGlobalAbs > 5) {
      setShowJustifyModal(true);
      return;
    }
    void doValidate();
  }

  async function doValidate() {
    if (!order || !user) return;
    setSubmitting(true);
    const recLines: ReceptionLine[] = lines.map((l) => ({
      product_id: l.product_id,
      quantite_commandee: l.quantite_commandee,
      quantite_recue: l.quantite_recue,
      ecart_pct: ecartPct(l.quantite_commandee, l.quantite_recue),
      photos: l.photos,
      scanned: l.scanned,
    }));
    const conformite = Math.max(0, 100 - ecartGlobalAbs);
    const reception: Reception = {
      id: "rec-" + Date.now(),
      order_id: order.id,
      user_id: user.id,
      date: new Date().toISOString(),
      lignes: recLines,
      ecart_global_pct: ecartGlobal,
      photo_carton_count: totalPhotos,
      conformite_pct: conformite,
      justification: justification || undefined,
    };
    addReception(reception);
    markOrderReceived(order.id, ecartGlobalAbs > 0.1 ? "recu_avec_ecart" : "recu_conforme");

    await new Promise((r) => setTimeout(r, 350));

    if (ecartGlobalAbs > 5) {
      toast.success("Réception validée. Ahmed a été notifié des écarts.");
    } else {
      toast.success("Réception validée. Conformité " + conformite.toFixed(1) + "%.");
    }
    setSubmitting(false);
    router.replace("/reception/historique");
  }

  return (
    <PageWrapper hideNav>
      <header className="gradient-header rounded-b-[28px] pt-12 pb-6 px-5 text-text-ondark">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center"
            aria-label="Retour"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="label-caps-md text-gold">RÉCEPTION EN COURS</span>
          <div className="w-10" />
        </div>
        <h1 className="text-xl font-bold leading-tight">{supplier?.name}</h1>
        <p className="text-sm text-text-ondarkmuted mt-0.5">
          {order.reference}
        </p>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-text-ondarkmuted">
              {linesWithQty}/{totalLines} ligne{totalLines > 1 ? "s" : ""} · {totalPhotos} photo{totalPhotos > 1 ? "s" : ""}
            </span>
            <span className="text-gold font-bold">
              {Math.round((linesWithQty / totalLines) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-bright transition-all duration-300"
              style={{ width: `${(linesWithQty / totalLines) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <div className="px-5 mt-4">
        <button
          onClick={() => setScannerOpen(true)}
          className="w-full bg-primary text-white rounded-[20px] py-4 px-5 flex items-center justify-between shadow-card-lg"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gold/20 text-gold flex items-center justify-center">
              <ScanBarcode className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-xs text-gold label-caps">SCANNER</span>
              <span className="block font-semibold text-sm">Lire un code-barres caméra</span>
            </span>
          </span>
          <Sparkles className="w-4 h-4 text-gold" />
        </button>
      </div>

      {ecartGlobalAbs > 0.5 && (
        <div className="px-5 mt-4">
          <div
            className={`rounded-[18px] p-4 flex items-start gap-3 ${
              ecartGlobalAbs > 5 ? "bg-danger-soft" : "bg-warning-soft"
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                ecartGlobalAbs > 5 ? "text-danger" : "text-warning"
              }`}
            />
            <div>
              <p className={`text-sm font-bold ${ecartGlobalAbs > 5 ? "text-danger" : "text-warning"}`}>
                Écart global {ecartGlobal > 0 ? "+" : ""}
                {ecartGlobal.toFixed(1)}%
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {ecartGlobalAbs > 5
                  ? "Justification obligatoire à la validation."
                  : "Vérifie les lignes en écart avant de valider."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 mt-5 space-y-3 pb-40">
        {lines.map((line) => {
          const product = products.find((p) => p.id === line.product_id);
          if (!product) return null;
          const ecart = ecartPct(line.quantite_commandee, line.quantite_recue);
          return (
            <motion.div
              key={line.product_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[20px] shadow-card p-4"
            >
              <div className="flex gap-3">
                <div
                  className="w-16 h-16 rounded-xl bg-cream shrink-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${product.image_url})` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary leading-tight line-clamp-2">
                    {product.name}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5 truncate">
                    {product.brand} · {product.barcode}
                  </p>
                  {line.generatedBarcode && (
                    <p className="text-[10px] text-gold mt-0.5 font-mono">
                      EAN interne {line.generatedBarcode}
                    </p>
                  )}
                </div>
                {line.quantite_recue > 0 && <EcartBadge value={ecart} />}
              </div>

              <div className="flex items-center justify-between mt-4 gap-3">
                <div>
                  <p className="label-caps text-text-tertiary">COMMANDÉ</p>
                  <p className="text-lg font-bold text-text-primary mt-0.5">
                    {line.quantite_commandee} <span className="text-xs font-normal text-text-secondary">{product.unit === "L" ? "L" : product.unit === "kg" ? "kg" : "u"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => increment(line.product_id, -1)}
                    className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-primary"
                    aria-label="Diminuer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    inputMode="numeric"
                    value={line.quantite_recue || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || "0", 10);
                      updateLine(line.product_id, { quantite_recue: isNaN(v) ? 0 : v });
                    }}
                    placeholder="0"
                    className="w-14 text-center text-lg font-bold rounded-xl border border-line-light bg-cream py-1.5 outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => increment(line.product_id, 1)}
                    className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center"
                    aria-label="Augmenter"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => openPhoto(line.product_id)}
                  className="flex-1 py-2.5 px-3 rounded-full bg-cream text-primary text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Photo carton
                </button>
                <button
                  onClick={() => generateBarcode(line.product_id)}
                  className="flex-1 py-2.5 px-3 rounded-full bg-cream text-primary text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ScanBarcode className="w-3.5 h-3.5" />
                  EAN interne
                </button>
              </div>

              {line.photos.length > 0 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-none">
                  {line.photos.map((src, idx) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={idx}
                      src={src}
                      alt={`photo ${idx + 1}`}
                      className="w-14 h-14 rounded-xl object-cover border border-line-light shrink-0"
                    />
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 pb-safe">
        <div className="mx-auto max-w-[460px] px-4 pt-2 pb-3">
          <div className="bg-primary rounded-[24px] shadow-card-lg px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="label-caps text-gold">RÉCEPTION</p>
              <p className="text-white font-semibold text-sm leading-tight">
                {linesWithQty}/{totalLines} lignes · {totalPhotos} photos
              </p>
            </div>
            <button
              disabled={!canValidate || submitting}
              onClick={tryValidate}
              className="btn-gold !py-3 !px-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {submitting ? "Validation…" : "Valider"}
            </button>
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
      <PhotoCapture
        open={!!photoForLine}
        onClose={() => setPhotoForLine(null)}
        onCapture={handleCapture}
      />

      {unknownBarcode && (
        <div className="fixed inset-0 z-[70] fixed-overlay flex items-end justify-center">
          <div className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-10 animate-slide-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-warning-soft flex items-center justify-center mb-3">
              <ImageIcon className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-lg font-bold text-center">Produit inconnu</h3>
            <p className="text-sm text-text-secondary text-center mt-1">
              Le code <span className="font-mono">{unknownBarcode}</span> ne correspond
              à aucun produit du catalogue.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setUnknownBarcode(null)}
                className="btn-ghost flex-1"
              >
                <X className="w-4 h-4" /> Annuler
              </button>
              <button
                onClick={() => {
                  setUnknownBarcode(null);
                  router.push("/catalogue/nouveau");
                }}
                className="btn-primary flex-1"
              >
                <Plus className="w-4 h-4" /> Créer la fiche
              </button>
            </div>
          </div>
        </div>
      )}

      {showJustifyModal && (
        <div className="fixed inset-0 z-[70] fixed-overlay flex items-end justify-center">
          <div className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-10 animate-slide-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger-soft flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <h3 className="text-lg font-bold text-center">Justifier l&apos;écart</h3>
            <p className="text-sm text-text-secondary text-center mt-1">
              L&apos;écart global est de {ecartGlobal > 0 ? "+" : ""}
              {ecartGlobal.toFixed(1)}%. Précise la cause avant validation.
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              placeholder="Ex : palette livreur incomplète, casse, erreur fournisseur…"
              className="input-field mt-4 resize-none"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowJustifyModal(false)}
                className="btn-ghost flex-1"
              >
                Annuler
              </button>
              <button
                disabled={!justification.trim() || submitting}
                onClick={() => {
                  setShowJustifyModal(false);
                  void doValidate();
                }}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Notifier Ahmed
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
