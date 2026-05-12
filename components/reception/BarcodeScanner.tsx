"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Keyboard,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";

/**
 * Scanner code-barre v6 — QUADRUPLE FALLBACK pour iOS 26 PWA
 *
 *   1. BarcodeDetector natif (Safari iOS 17+) → ~80ms/frame, ultra rapide
 *   2. ZXing browser (TS pur, marche partout) → ~250ms/frame
 *   3. Saisie manuelle EAN au clavier numérique
 *   4. Recherche produit par nom (filet de sécurité ultime — la démo ne
 *      peut PAS planter même si toutes les caméras refusent)
 *
 * Signature préservée {open, onClose, onScan} pour les 5 callers.
 * `products` est optionnelle : si absente, l'onglet "Par nom" affiche un
 * message demandant à l'appelant de fournir le catalogue.
 */

interface ProductItem {
  id: string;
  nom: string;
  ean?: string | null;
  /** alias si schéma drive `code_barre` */
  code_barre?: string | null;
  categorie?: string | null;
}

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  products?: ProductItem[];
}

type Phase = "idle" | "starting" | "scanning" | "error";
type Engine = "native" | "zxing" | null;
type Tab = "camera" | "manual" | "search";

function hasNativeBarcodeDetector(): boolean {
  if (typeof window === "undefined") return false;
  return "BarcodeDetector" in window;
}

export function BarcodeScanner({
  open,
  onClose,
  onScan,
  products = [],
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const onScanRef = useRef(onScan);
  const stoppedRef = useRef(false);

  const [tab, setTab] = useState<Tab>("camera");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [engine, setEngine] = useState<Engine>(null);
  const [manualInput, setManualInput] = useState("");
  const [productSearch, setProductSearch] = useState("");
  /** Catalogue auto-fetché depuis Supabase si l'appelant n'a pas passé
   *  `products` — évite de toucher les 5 callers pour cette feature. */
  const [autoProducts, setAutoProducts] = useState<ProductItem[]>([]);
  const [autoFetching, setAutoFetching] = useState(false);
  const autoFetchedRef = useRef(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopAll = () => {
    stoppedRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        /* ignore */
      }
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
    setPhase("idle");
    setFramesAnalyzed(0);
    setEngine(null);
  };

  // Reset à chaque ouverture, cleanup à chaque fermeture.
  useEffect(() => {
    if (open) {
      stoppedRef.current = false;
      setErrorMsg(null);
      setManualInput("");
      setProductSearch("");
      setTab("camera");
    } else {
      stopAll();
    }
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Quand on change de tab, on coupe la caméra (économie batterie + libère
  // le periph). Sauf si on revient à camera avec phase active.
  useEffect(() => {
    if (tab !== "camera") {
      stopAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-fetch catalog la première fois qu'on ouvre l'onglet "Par nom" —
  // si le caller n'a pas passé `products`. Cache en local pour la session.
  useEffect(() => {
    if (tab !== "search") return;
    if (products.length > 0) return;
    if (autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    setAutoFetching(true);
    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const sb = supabase();
        if (!sb) {
          setAutoFetching(false);
          return;
        }
        const { data, error } = await sb
          .from("produits")
          .select("id, nom, ean, categorie")
          .order("nom", { ascending: true })
          .limit(2000);
        if (error) {
          console.warn("[Scanner] auto-fetch produits KO:", error.message);
        } else if (data) {
          setAutoProducts(data as ProductItem[]);
        }
      } catch (e) {
        console.warn("[Scanner] auto-fetch exception:", e);
      } finally {
        setAutoFetching(false);
      }
    })();
  }, [tab, products.length]);

  function vibrateOk() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(40);
    }
  }

  function handleDetected(value: string) {
    if (stoppedRef.current) return;
    vibrateOk();
    onScanRef.current(value.trim());
    stopAll();
  }

  async function startCamera() {
    setPhase("starting");
    setErrorMsg(null);
    setFramesAnalyzed(0);
    stoppedRef.current = false;

    try {
      let cameraId: string | undefined;
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const videos = all.filter((d) => d.kind === "videoinput");
        const rear = videos.find((d) =>
          /back|rear|environment|arrière|arriere/i.test(d.label)
        );
        cameraId = rear?.deviceId || videos[videos.length - 1]?.deviceId;
      } catch {
        /* iOS pré-permission */
      }

      const constraints: MediaStreamConstraints = {
        video: cameraId
          ? {
              deviceId: { exact: cameraId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      };

      const stream =
        await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error("Video element manquant");
      }
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.setAttribute("autoplay", "true");
      videoRef.current.setAttribute("muted", "true");
      await videoRef.current.play();

      // Moteur 1 — BarcodeDetector natif (Safari iOS 17+)
      if (hasNativeBarcodeDetector()) {
        setEngine("native");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BD = (window as any).BarcodeDetector;
        try {
          detectorRef.current = new BD({
            formats: [
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "code_128",
              "code_39",
              "itf",
              "qr_code",
            ],
          });
        } catch {
          detectorRef.current = new BD();
        }

        const loop = async () => {
          if (stoppedRef.current || !videoRef.current || !detectorRef.current) {
            return;
          }
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            setFramesAnalyzed((f) => f + 1);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              handleDetected(String(codes[0].rawValue));
              return;
            }
          } catch {
            /* frame skip */
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        setPhase("scanning");
        return;
      }

      // Moteur 2 — ZXing fallback
      setEngine("zxing");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      detectorRef.current = reader;

      const controls = await reader.decodeFromVideoDevice(
        cameraId,
        videoRef.current,
        (result, err) => {
          if (result && !stoppedRef.current) {
            handleDetected(result.getText());
            return;
          }
          if (!err) return;
          setFramesAnalyzed((f) => f + 1);
        }
      );
      zxingControlsRef.current = controls;
      setPhase("scanning");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setErrorMsg(humanError(raw));
      setPhase("error");
      stopAll();
    }
  }

  function submitManual() {
    const code = manualInput.trim().replace(/\D/g, "");
    if (code.length >= 4) {
      vibrateOk();
      onScanRef.current(code);
      setManualInput("");
    }
  }

  function selectProduct(p: ProductItem) {
    const code = p.ean ?? p.code_barre ?? p.id;
    if (!code) return;
    vibrateOk();
    onScanRef.current(String(code));
    setProductSearch("");
  }

  if (!open) return null;

  const effectiveProducts = products.length > 0 ? products : autoProducts;
  const filteredProducts = (() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return effectiveProducts.slice(0, 30);
    return effectiveProducts
      .filter((p) => {
        const ean = (p.ean ?? p.code_barre ?? "").toLowerCase();
        return (
          p.nom.toLowerCase().includes(q) ||
          ean.includes(q) ||
          (p.categorie ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* HEADER */}
      <div className="safe-top flex items-center justify-between px-5 pb-3 text-white">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-5 h-5 text-gold" />
          <span className="font-semibold">Scanner un produit</span>
        </div>
        <button
          onClick={() => {
            stopAll();
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* TABS — toujours visibles */}
      <div className="px-3 pb-2">
        <div className="bg-white/10 rounded-full p-1 flex gap-1">
          <TabBtn
            active={tab === "camera"}
            label="Caméra"
            icon={<Camera className="w-4 h-4" />}
            onClick={() => setTab("camera")}
          />
          <TabBtn
            active={tab === "manual"}
            label="EAN manuel"
            icon={<Keyboard className="w-4 h-4" />}
            onClick={() => setTab("manual")}
          />
          <TabBtn
            active={tab === "search"}
            label="Par nom"
            icon={<Search className="w-4 h-4" />}
            onClick={() => setTab("search")}
          />
        </div>
      </div>

      {/* BODY — un seul tab visible à la fois */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* === TAB CAMÉRA === */}
        {tab === "camera" && (
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {phase === "idle" && !errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6 z-10 bg-black/40">
                <div className="w-16 h-16 rounded-2xl bg-gold/20 flex items-center justify-center mb-4">
                  <Camera className="w-8 h-8 text-gold" />
                </div>
                <p className="font-bold text-lg mb-1">Caméra prête</p>
                <p className="text-sm text-white/70 mb-5">
                  Appuie pour autoriser et démarrer le scan.
                </p>
                <button
                  onClick={() => void startCamera()}
                  className="bg-gold-bright text-primary-dark font-bold rounded-full px-6 py-3 inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Activer la caméra
                </button>
              </div>
            )}

            {phase === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                <div className="animate-spin w-12 h-12 border-4 border-gold border-t-transparent rounded-full mb-3" />
                <p className="text-white text-sm">Démarrage caméra…</p>
              </div>
            )}

            {phase === "scanning" && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-[80%] max-w-[320px] aspect-[2/1] border-2 border-gold rounded-2xl">
                  <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                  <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                  <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-white rounded-br-2xl" />
                </div>
              </div>
            )}

            {phase === "error" && errorMsg && (
              <div className="absolute inset-x-0 top-1/4 mx-auto max-w-sm px-6 text-center text-white z-10">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-7 h-7 text-danger" />
                </div>
                <p className="font-bold text-lg">Caméra indisponible</p>
                <p className="text-sm text-white/80 mt-2 whitespace-pre-line">
                  {errorMsg}
                </p>
                <div className="mt-4 flex gap-2 justify-center">
                  <button
                    onClick={() => void startCamera()}
                    className="bg-white/15 text-white font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 text-sm"
                  >
                    <Camera className="w-4 h-4" />
                    Réessayer
                  </button>
                  <button
                    onClick={() => setTab("search")}
                    className="bg-gold-bright text-primary-dark font-semibold rounded-full px-5 py-2 text-sm"
                  >
                    Recherche par nom
                  </button>
                </div>
              </div>
            )}

            {phase === "scanning" && (
              <div className="absolute bottom-3 inset-x-0 z-10 px-4 pointer-events-none">
                <div className="mx-auto max-w-[420px] bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 text-[11px] text-white/85 font-mono flex items-center justify-between">
                  <span>
                    Moteur :{" "}
                    <b className="text-gold">
                      {engine === "native" ? "Safari natif" : "ZXing"}
                    </b>
                  </span>
                  <span>Frames : {framesAnalyzed}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === TAB EAN MANUEL === */}
        {tab === "manual" && (
          <div className="flex-1 px-5 pt-6 text-white">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60 mb-2">
              Tape l&apos;EAN du produit
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={manualInput}
                onChange={(e) =>
                  setManualInput(e.target.value.replace(/\D/g, "").slice(0, 14))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManual();
                }}
                autoFocus
                placeholder="3661234567893"
                className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-3 text-lg font-mono tabular tracking-wide outline-none focus:bg-white/15 focus:ring-2 focus:ring-gold"
                maxLength={14}
                aria-label="Saisir le code-barre manuellement"
              />
              <button
                onClick={submitManual}
                disabled={manualInput.length < 4}
                className="bg-gold-bright text-primary-dark font-bold rounded-xl px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
            <p className="text-[11px] text-white/50 mt-3 leading-snug">
              EAN-13 = 13 chiffres · EAN-8 = 8 · UPC-A = 12 · Code-barres
              internes étiquette = 13 chiffres aussi.
            </p>
          </div>
        )}

        {/* === TAB RECHERCHE PAR NOM (filet de sécurité ultime) === */}
        {tab === "search" && (
          <div className="flex-1 px-5 pt-6 text-white flex flex-col min-h-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60 mb-2">
              Cherche par nom, marque ou EAN
            </p>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              autoFocus
              placeholder="Coca, yaourt, merguez, dattes…"
              className="bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-3 text-base outline-none focus:bg-white/15 focus:ring-2 focus:ring-gold"
            />
            {effectiveProducts.length === 0 && !autoFetching && (
              <p className="text-[11.5px] text-warning mt-3 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Catalogue indisponible — utilise EAN manuel.
              </p>
            )}
            {autoFetching && (
              <p className="text-[11px] text-white/50 mt-2">
                Chargement du catalogue…
              </p>
            )}
            <div className="mt-3 flex-1 overflow-y-auto bg-white/5 rounded-2xl">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-white/50 p-6 text-center">
                  {productSearch.trim()
                    ? `Aucun produit pour "${productSearch}"`
                    : "Tape pour chercher"}
                </p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {filteredProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => selectProduct(p)}
                        className="w-full text-left px-4 py-3 active:bg-white/10"
                      >
                        <p className="text-sm font-bold text-white">{p.nom}</p>
                        <p className="text-[11px] text-white/60 font-mono mt-0.5">
                          {p.ean ?? p.code_barre ?? "?"}
                          {p.categorie && (
                            <span className="text-white/40">
                              {" · "}
                              {p.categorie}
                            </span>
                          )}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-bold transition-colors ${
        active ? "bg-white text-primary-dark" : "text-white/80"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Erreurs getUserMedia → message FR actionnable employé magasin */
function humanError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("permission") || m.includes("notallowed")) {
    return (
      "Permission caméra refusée.\n" +
      "iPhone : Réglages → Apps → Safari → Caméra → Autoriser.\n" +
      "PWA installée : Réglages → Salam Stock → Caméra.\n" +
      "Puis recharge la page."
    );
  }
  if (m.includes("notfound") || m.includes("devicenotfound")) {
    return "Aucune caméra détectée sur cet appareil.";
  }
  if (m.includes("notreadable") || m.includes("trackstart")) {
    return "Caméra utilisée par une autre app. Ferme les autres apps caméra.";
  }
  if (m.includes("overconstrained")) {
    return "Cette caméra ne supporte pas le mode demandé.";
  }
  if (m.includes("secure context") || m.includes("https")) {
    return "Le scan nécessite une connexion HTTPS sécurisée.";
  }
  return "Scanner indisponible : " + raw + ".";
}
