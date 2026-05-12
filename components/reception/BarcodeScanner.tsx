"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Flashlight,
  RefreshCw,
  ScanBarcode,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/**
 * Scanner code-barre v7 — calé pour iPhone 14 PWA
 *
 * Diagnostic Mohamed (12/05) : V1 html5-qrcode pris la caméra
 * ultra-wide 0.5× où les codes-barres sont 2× plus petits → décodeur
 * JS lent + focus pas piloté = jamais de scan.
 *
 * Solution :
 *   1. Permission warm-up (sans contraintes)
 *   2. Re-enumerate devices pour récupérer les labels caméras
 *   3. Choix HEURISTIQUE : caméra "wide" (PAS ultra-wide PAS telephoto)
 *      → c'est la caméra principale 1× de l'iPhone
 *   4. Stream HD (1920×1080) avec applyConstraints :
 *      - focusMode: continuous → focus auto permanent
 *      - zoom: 2× → rapproche virtuellement le code-barre
 *   5. Décodage : BarcodeDetector natif Safari iOS 17+ (Vision Framework
 *      Apple, ultra rapide), fallback html5-qrcode si absent
 *   6. Contrôles live : zoom +/-, torche, focus tap
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

/** Heuristique : choisit la caméra "wide" principale (pas ultra-wide,
 *  pas telephoto). iPhone 14 = back triple : ultra (0.5×) / wide (1×) /
 *  tele (3×). On veut la wide → meilleur pour codes-barres standards. */
function chooseBackCamera(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  const back = devices.filter(
    (d) =>
      d.kind === "videoinput" &&
      /back|rear|environment|arrière|arriere/i.test(d.label)
  );
  if (back.length === 0) return null;

  // 1. Évite ultra-wide (mots-clés courants)
  const notUltra = back.filter(
    (d) => !/ultra|0\.5|wide angle|wideangle/i.test(d.label)
  );
  // 2. Évite telephoto
  const notTele = (notUltra.length > 0 ? notUltra : back).filter(
    (d) => !/tele|3x|2x/i.test(d.label)
  );
  // 3. Préférence "back camera" sans qualifier (iOS l'appelle souvent juste ça)
  const plain = notTele.find((d) => /^back camera$/i.test(d.label.trim()));
  if (plain) return plain;
  return notTele[0] ?? notUltra[0] ?? back[0];
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

  const [phase, setPhase] = useState<
    "idle" | "starting" | "scanning" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "html5" | null>(null);
  const [zoom, setZoom] = useState(2);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInput, setManualInput] = useState("");

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
    setPhase("idle");
    setEngine(null);
    setHasTorch(false);
    setTorchOn(false);
  }

  useEffect(() => {
    if (open) {
      stoppedRef.current = false;
      setError(null);
      setManualInput("");
      // démarrage AUTO comme V1, pas de user-gesture (évite friction)
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
      // 1. Warm-up permission (sans contraintes spécifiques pour ne pas
      //    déclencher Overconstrained avant de lire les labels)
      const tmp = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      tmp.getTracks().forEach((t) => t.stop());

      // 2. Re-enumerate avec labels accessibles
      const all = await navigator.mediaDevices.enumerateDevices();
      const chosen = chooseBackCamera(all);
      console.log(
        "[Scanner] Caméras détectées:",
        all.filter((d) => d.kind === "videoinput").map((d) => d.label)
      );
      console.log("[Scanner] Caméra choisie:", chosen?.label);

      // 3. Stream HD sur la wide
      const constraints: MediaStreamConstraints = {
        video: chosen
          ? {
              deviceId: { exact: chosen.deviceId },
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
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // 4. Capabilities → focus continu + zoom 2× + torch
      const caps = (
        track.getCapabilities ? track.getCapabilities() : {}
      ) as CamCaps;
      console.log("[Scanner] Track capabilities:", caps);

      const advanced: MediaTrackConstraintSet[] = [];
      if (caps.focusMode?.includes("continuous")) {
        advanced.push({
          focusMode: "continuous",
        } as unknown as MediaTrackConstraintSet);
      }
      if (caps.zoom) {
        const z = Math.min(zoom, caps.zoom.max);
        advanced.push({
          zoom: z,
        } as unknown as MediaTrackConstraintSet);
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

      // 5. Branche video
      if (!videoRef.current) throw new Error("video element manquant");
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.setAttribute("muted", "true");
      videoRef.current.setAttribute("autoplay", "true");
      await videoRef.current.play();

      // 6. Décodage : BarcodeDetector natif > html5-qrcode fallback
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
    // Stop le stream qu'on a ouvert et délègue à html5-qrcode (qui ouvre
    // le sien). On perd le contrôle zoom/focus mais on garde la
    // détection pure JS.
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
    // Re-applique focusMode pour forcer un re-trigger autofocus
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
      {/* HEADER */}
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

      {/* VIEWFINDER */}
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
            <p className="text-white text-sm">Démarrage caméra HD…</p>
            <p className="text-white/50 text-xs mt-1">
              Caméra wide + focus continu + zoom 2×
            </p>
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

            {/* Contrôles live */}
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

            {/* Debug bar */}
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

      {/* SAISIE MANUELLE — ultime fallback (Mohamed déteste mais utile) */}
      <div className="px-5 pb-safe pt-3 bg-black/95 border-t border-white/10">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60 mb-2">
          Si vraiment ça ne lit pas — saisie manuelle
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
  if (m.includes("overconstrained")) {
    return "La caméra ne supporte pas le mode demandé. Réessaie.";
  }
  return "Caméra indisponible : " + raw;
}
