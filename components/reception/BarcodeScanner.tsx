"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Flashlight,
  ImagePlus,
  RefreshCw,
  ScanBarcode,
  Target,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * Scanner v8 — Tap-to-Snap
 *
 * Live preview (caméra arrière, zoom 4×, focus continu) MAIS aucun
 * decode en boucle. Mohamed pointe le code-barre, attend que la mise
 * au point se fasse (visible à l'œil), tap n'importe où sur le viseur
 * → on capture une image haute résolution + decode immédiat avec
 * BarcodeDetector natif (Vision Framework Apple) ou ZXing fallback.
 *
 * 1 tap = 1 essai = 1 résultat. Comme un appareil photo numérique.
 *
 * Filets de sécurité (toujours visibles en bas) :
 *   - Bouton "Photo Caméra iOS native" (input file capture environment)
 *   - Saisie manuelle EAN au clavier
 */

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

interface BarcodeDetectorLike {
  detect(
    source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement
  ): Promise<Array<{ rawValue: string }>>;
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

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
];

export function BarcodeScanner({
  open,
  onClose,
  onScan,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const stoppedRef = useRef(false);
  const onScanRef = useRef(onScan);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"starting" | "ready" | "snapping" | "error">(
    "starting"
  );
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2.5);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number } | null>(
    null
  );
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [snapResult, setSnapResult] = useState<"miss" | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    trackRef.current = null;
    setHasTorch(false);
    setTorchOn(false);
  }

  useEffect(() => {
    if (open) {
      stoppedRef.current = false;
      setError(null);
      setManualInput("");
      setPhase("starting");
      setSnapResult(null);
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
      console.log("[Scanner] track:", track.label);

      const caps = (
        track.getCapabilities ? track.getCapabilities() : {}
      ) as CamCaps;
      console.log("[Scanner] caps:", caps);

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

      setPhase("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Scanner] start error:", e);
      setError(humanError(msg));
      setPhase("error");
      void stopAll();
    }
  }

  /** Capture une frame haute-rés du <video> et tente le décode. */
  async function decodeFromVideo(video: HTMLVideoElement): Promise<string | null> {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    // Dessine sur canvas — full résolution caméra
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);

    // 1. BarcodeDetector natif (Vision Apple) sur canvas
    const Detector = getNativeDetector();
    if (Detector) {
      try {
        const det = new Detector({ formats: FORMATS });
        const codes = await det.detect(canvas);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          return String(codes[0].rawValue);
        }
      } catch (e) {
        console.warn("[Scanner] Vision detect KO:", e);
      }
    }

    // 2. Fallback ZXing sur canvas → blob → image url
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const result = await reader.decodeFromImageUrl(url);
        return result?.getText() ?? null;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.warn("[Scanner] ZXing image KO:", e);
      return null;
    }
  }

  /** Tap-to-snap : capture + decode immédiat. Burst de 3 essais
   *  rapprochés (50ms entre chaque) pour maximiser les chances. */
  async function tapSnap() {
    if (phase !== "ready" || !videoRef.current) return;
    setPhase("snapping");
    setSnapResult(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    try {
      // Burst 3 essais rapides
      for (let i = 0; i < 3; i++) {
        const code = await decodeFromVideo(videoRef.current);
        if (code) {
          fireScan(code);
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      // Aucun des 3 essais n'a décodé → toast miss
      setSnapResult("miss");
      setPhase("ready");
      setTimeout(() => setSnapResult(null), 2000);
    } catch (e) {
      console.error("[Scanner] snap error:", e);
      setPhase("ready");
    }
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
      console.warn("[Scanner] zoom KO:", e);
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
      console.warn("[Scanner] torch KO:", e);
    }
  }

  async function refocus() {
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

  /** Décode une image File via BarcodeDetector ou ZXing. */
  async function decodeImageFile(file: File): Promise<string | null> {
    const Detector = getNativeDetector();
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return null;
    if (Detector) {
      try {
        const det = new Detector({ formats: FORMATS });
        const codes = await det.detect(bitmap);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          return String(codes[0].rawValue);
        }
      } catch {
        /* ZXing fallback */
      }
    }
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
    } catch {
      return null;
    }
  }

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const code = await decodeImageFile(file);
      if (code) {
        fireScan(code);
      } else {
        setError(
          "Aucun code détecté sur la photo. Reprends en cadrant le code-barre droit, le plus près possible."
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
      {/* HEADER */}
      <div className="safe-top flex items-center justify-between px-5 pb-3 text-white">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-5 h-5 text-gold" />
          <span className="font-semibold">Tap pour scanner</span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* VIEWFINDER — toute la zone est cliquable pour Tap-to-Snap */}
      <div
        className="flex-1 relative flex items-center justify-center bg-black overflow-hidden"
        onClick={() => void tapSnap()}
        role="button"
        aria-label="Tap pour capturer le code-barre"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Flash blanc bref à la capture */}
        {flash && (
          <div className="absolute inset-0 bg-white/70 z-30 pointer-events-none animate-pulse" />
        )}

        {phase === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="animate-spin w-10 h-10 border-2 border-gold border-t-transparent rounded-full mb-3" />
            <p className="text-white text-sm">Démarrage caméra…</p>
          </div>
        )}

        {(phase === "ready" || phase === "snapping") && (
          <>
            {/* Viseur */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="relative w-[80%] max-w-[320px] aspect-[2/1] border-2 border-gold rounded-2xl">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                {/* Réticule center */}
                <Target className="absolute inset-0 m-auto w-8 h-8 text-gold/60" />
              </div>
            </div>

            {/* Hint texte */}
            <div className="absolute top-3 inset-x-0 z-10 px-4 pointer-events-none">
              <div className="mx-auto max-w-[420px] bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 text-[12px] text-white/95 font-bold text-center">
                {phase === "snapping"
                  ? "📸 Décodage…"
                  : snapResult === "miss"
                    ? "❌ Non lu — re-cadre + tap"
                    : "👆 Tap n'importe où pour scanner"}
              </div>
            </div>

            {/* Contrôles caméra (zoom / torche / refocus) */}
            <div className="absolute bottom-20 inset-x-0 z-10 px-4">
              <div className="mx-auto max-w-[420px] flex items-center justify-center gap-2">
                {zoomCaps && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void applyZoom(zoom - 1);
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
                        void applyZoom(zoom + 1);
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
                    void refocus();
                  }}
                  className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center"
                  aria-label="Re-focus"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Gros bouton circulaire central — UX appareil photo */}
            <div className="absolute bottom-3 inset-x-0 z-10 flex justify-center pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void tapSnap();
                }}
                disabled={phase === "snapping"}
                aria-label="Capturer maintenant"
                className="pointer-events-auto w-16 h-16 rounded-full bg-white border-4 border-gold flex items-center justify-center shadow-card-lg active:scale-95 disabled:opacity-50"
              >
                <span className="w-12 h-12 rounded-full bg-gold-bright" />
              </button>
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
              onClick={(e) => {
                e.stopPropagation();
                void startCamera();
              }}
              className="mt-4 bg-white/15 text-white font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 text-sm"
            >
              <Camera className="w-4 h-4" />
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* FOOTER — filets de sécurité */}
      <div className="px-5 pb-safe pt-3 bg-black/95 border-t border-white/10 space-y-3">
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

        <details className="text-white/70">
          <summary className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60 cursor-pointer">
            Saisie manuelle EAN
          </summary>
          <div className="flex gap-2 mt-2">
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
        </details>
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
    return "Caméra utilisée par une autre app.";
  }
  if (m.includes("notfound")) {
    return "Caméra introuvable. Vérifie l'app Caméra iOS d'abord.";
  }
  if (m.includes("overconstrained")) {
    return "La caméra ne supporte pas le mode demandé.";
  }
  return "Caméra indisponible : " + raw;
}
