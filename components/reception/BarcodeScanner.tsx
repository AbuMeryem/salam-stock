"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Flashlight,
  ImagePlus,
  RefreshCw,
  ScanBarcode,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * Scanner v7.1 — facingMode environment + zoom 2× + Vision Apple
 *
 * V1 (html5-qrcode auto) ne marche PAS sur iPhone 14 triple-cam : iOS
 * choisit l'ultra-wide 0.5×, code-barre 2× plus petit, html5-qrcode
 * en JS pur trop lent. v7 avec deviceId enumerate échouait avec
 * NotFoundError (iOS régénère les deviceId).
 *
 * v7.1 : pas de deviceId, on laisse iOS choisir. On compense via
 *   - track.applyConstraints zoom 2× → rapproche virtuellement
 *   - focusMode continuous → autofocus permanent
 *   - BarcodeDetector natif Safari iOS 17+ (Vision Framework)
 *   - Contrôles live zoom +/- / torche / refocus
 */

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}
function getNativeDetector(): BarcodeDetectorCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
}

interface CamCaps {
  focusMode?: string[];
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
}

export function BarcodeScanner({
  open,
  onClose,
  onScan,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const onScanRef = useRef(onScan);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5Ref = useRef<any>(null);

  const [phase, setPhase] = useState<"starting" | "scanning" | "error">(
    "starting"
  );
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "html5" | null>(null);
  const [zoom, setZoom] = useState(3);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number } | null>(
    null
  );
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  /** Décode une image (File) via BarcodeDetector natif si dispo, sinon
   *  ZXing browser. Utilisé par le bouton "Photo Caméra iOS" qui ouvre
   *  l'app Caméra Apple native (focus + zoom parfaits, contourne tous
   *  les bugs WebRTC). */
  async function decodeImageFile(file: File): Promise<string | null> {
    const Detector = getNativeDetector();
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return null;

    if (Detector) {
      try {
        const det = new Detector({
          formats: [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "code_128",
            "code_39",
            "itf",
          ],
        });
        // BarcodeDetector accepte ImageBitmap
        const codes = await (det as unknown as {
          detect(b: ImageBitmap): Promise<Array<{ rawValue: string }>>;
        }).detect(bitmap);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          return String(codes[0].rawValue);
        }
      } catch (e) {
        console.warn("[Scanner] BarcodeDetector image fail, fallback ZXing:", e);
      }
    }
    // Fallback ZXing
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(url);
        return result?.getText() ?? null;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn("[Scanner] ZXing image fail:", e);
      return null;
    }
  }

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset pour permettre re-pick same file
    if (!file) return;
    setPhotoBusy(true);
    try {
      const code = await decodeImageFile(file);
      if (code) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(40);
        }
        onScanRef.current(code.trim());
        void stopAll();
      } else {
        setError(
          "Aucun code-barre détecté sur la photo. Reprends en cadrant le code bien droit, le plus près possible."
        );
        setPhase("error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("Décodage échoué : " + msg);
      setPhase("error");
    } finally {
      setPhotoBusy(false);
    }
  }

  function fireScan(code: string) {
    if (stoppedRef.current) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(40);
    }
    onScanRef.current(code.trim());
    void stopAll();
  }

  async function stopAll() {
    stoppedRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (html5Ref.current) {
      try {
        if (html5Ref.current.isScanning) await html5Ref.current.stop();
        await html5Ref.current.clear();
      } catch {
        /* ignore */
      }
      html5Ref.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    trackRef.current = null;
    setEngine(null);
    setHasTorch(false);
    setTorchOn(false);
  }

  useEffect(() => {
    if (open) {
      stoppedRef.current = false;
      setError(null);
      setManualInput("");
      setPhase("starting");
      void startCamera();
    } else {
      void stopAll();
    }
    return () => void stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function startCamera() {
    setPhase("starting");
    setError(null);
    stoppedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      console.log("[Scanner] track label:", track.label);

      const caps = (
        track.getCapabilities ? track.getCapabilities() : {}
      ) as CamCaps;
      console.log("[Scanner] capabilities:", caps);

      const advanced: MediaTrackConstraintSet[] = [];
      if (caps.focusMode?.includes("continuous")) {
        advanced.push({
          focusMode: "continuous",
        } as unknown as MediaTrackConstraintSet);
      }
      if (caps.zoom) {
        const z = Math.min(zoom, caps.zoom.max);
        advanced.push({ zoom: z } as unknown as MediaTrackConstraintSet);
        setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max });
        setZoom(z);
      }
      if (advanced.length > 0) {
        try {
          await track.applyConstraints({
            advanced,
          } as MediaTrackConstraints);
        } catch (e) {
          console.warn("[Scanner] applyConstraints partial fail:", e);
        }
      }
      if (caps.torch) setHasTorch(true);

      if (!videoRef.current) throw new Error("video element manquant");
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.setAttribute("muted", "true");
      videoRef.current.setAttribute("autoplay", "true");
      await videoRef.current.play();

      const Detector = getNativeDetector();
      if (Detector) {
        await runNativeLoop(Detector);
      } else {
        await runHtml5Fallback();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Scanner] start error:", e);
      setError(humanError(msg));
      setPhase("error");
      void stopAll();
    }
  }

  async function runNativeLoop(Detector: BarcodeDetectorCtor) {
    let detector: BarcodeDetectorLike;
    try {
      detector = new Detector({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "itf",
        ],
      });
    } catch {
      detector = new Detector();
    }
    setEngine("native");
    setPhase("scanning");

    const loop = async () => {
      if (stoppedRef.current || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          fireScan(String(codes[0].rawValue));
          return;
        }
      } catch {
        /* frame skip */
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  async function runHtml5Fallback() {
    const { Html5Qrcode } = await import("html5-qrcode");
    if (!videoRef.current) throw new Error("video element manquant");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const SCAN_ID = "salam-barcode-html5";
    let host = document.getElementById(SCAN_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = SCAN_ID;
      videoRef.current.parentElement?.appendChild(host);
    }
    const reader = new Html5Qrcode(SCAN_ID, { verbose: false });
    html5Ref.current = reader;
    await reader.start(
      { facingMode: { ideal: "environment" } },
      { fps: 15, qrbox: { width: 280, height: 160 }, aspectRatio: 1.4 },
      (decoded) => fireScan(decoded),
      () => {
        /* per-frame */
      }
    );
    setEngine("html5");
    setPhase("scanning");
  }

  async function applyZoom(target: number) {
    const t = trackRef.current;
    if (!t || !zoomCaps) return;
    const z = Math.min(zoomCaps.max, Math.max(zoomCaps.min, target));
    setZoom(z);
    try {
      await t.applyConstraints({
        advanced: [{ zoom: z } as unknown as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
    } catch (e) {
      console.warn("[Scanner] zoom apply fail:", e);
    }
  }

  async function toggleTorch() {
    const t = trackRef.current;
    if (!t) return;
    const next = !torchOn;
    try {
      await t.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setTorchOn(next);
    } catch (e) {
      console.warn("[Scanner] torch fail:", e);
    }
  }

  async function tapToFocus() {
    const t = trackRef.current;
    if (!t) return;
    try {
      await t.applyConstraints({
        advanced: [
          { focusMode: "continuous" } as unknown as MediaTrackConstraintSet,
        ],
      } as MediaTrackConstraints);
    } catch {
      /* ignore */
    }
  }

  function submitManual() {
    const c = manualInput.trim().replace(/\D/g, "");
    if (c.length >= 4) {
      onScanRef.current(c);
      setManualInput("");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="safe-top flex items-center justify-between px-5 pb-3 text-white">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-5 h-5 text-gold" />
          <span className="font-semibold">Scanner un code-barre</span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"
        onClick={() => void tapToFocus()}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {phase === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="animate-spin w-10 h-10 border-2 border-gold border-t-transparent rounded-full mb-3" />
            <p className="text-white text-sm">Démarrage caméra…</p>
          </div>
        )}

        {phase === "scanning" && (
          <>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="relative w-[80%] max-w-[320px] aspect-[2/1] border-2 border-gold rounded-2xl">
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-white rounded-br-2xl" />
              </div>
            </div>

            <div className="absolute bottom-16 inset-x-0 z-10 px-4">
              <div className="mx-auto max-w-[420px] flex items-center justify-center gap-2">
                {zoomCaps && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void applyZoom(zoom - 0.5);
                      }}
                      className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
                      aria-label="Zoom −"
                    >
                      <ZoomOut className="w-5 h-5" />
                    </button>
                    <span className="px-3 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-mono tabular">
                      {zoom.toFixed(1)}×
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void applyZoom(zoom + 0.5);
                      }}
                      className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
                      aria-label="Zoom +"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                  </>
                )}
                {hasTorch && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleTorch();
                    }}
                    className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center ${
                      torchOn
                        ? "bg-gold-bright text-primary-dark"
                        : "bg-black/70 text-white"
                    }`}
                    aria-label="Torche"
                  >
                    <Flashlight className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void tapToFocus();
                  }}
                  className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
                  aria-label="Re-focus"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="absolute bottom-3 inset-x-0 z-10 px-4 pointer-events-none">
              <div className="mx-auto max-w-[420px] bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 text-[11px] text-white/85 font-mono text-center">
                Moteur :{" "}
                <b className="text-gold">
                  {engine === "native" ? "Vision Apple" : "html5-qrcode"}
                </b>{" "}
                · Tap écran = re-focus
              </div>
            </div>
          </>
        )}

        {phase === "error" && error && (
          <div className="absolute inset-x-0 top-1/4 mx-auto max-w-sm px-6 text-center text-white z-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <p className="font-bold text-lg">Caméra indisponible</p>
            <p className="text-sm text-white/80 mt-2 whitespace-pre-line">
              {error}
            </p>
            <button
              onClick={() => void startCamera()}
              className="mt-4 bg-white/15 text-white font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 text-sm"
            >
              <Camera className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pb-safe pt-3 bg-black/95 border-t border-white/10 space-y-3">
        {/* Photo Caméra iOS native — focus + zoom natif Apple, contourne
            tous les bugs WebRTC. Si ça plante, ça plante nulle part. */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={photoBusy}
          className="w-full bg-gold-bright text-primary-dark rounded-2xl py-3 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {photoBusy ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Décodage en cours…
            </>
          ) : (
            <>
              <ImagePlus className="w-5 h-5" />
              Photo via Caméra iOS native
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void onPhotoPicked(e)}
          className="hidden"
        />

        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60 mb-2">
          Ou saisie manuelle
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
            placeholder="EAN ex. 3274080005003"
            className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-3 text-base font-mono tabular outline-none focus:bg-white/15 focus:ring-2 focus:ring-gold"
            maxLength={14}
          />
          <button
            onClick={submitManual}
            disabled={manualInput.length < 4}
            className="bg-gold-bright text-primary-dark font-bold rounded-xl px-5 py-3 disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function humanError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("permission") || m.includes("notallowed")) {
    return "Caméra refusée. Réglages iPhone → Salam Stock → Caméra → Autoriser, puis recharge.";
  }
  if (m.includes("notreadable") || m.includes("trackstart")) {
    return "Caméra utilisée par une autre app. Ferme les autres apps caméra.";
  }
  if (m.includes("notfound")) {
    return "Caméra introuvable. Vérifie l'app Caméra iOS d'abord, puis recharge la PWA.";
  }
  if (m.includes("overconstrained")) {
    return "La caméra ne supporte pas le mode demandé.";
  }
  return "Caméra indisponible : " + raw;
}
