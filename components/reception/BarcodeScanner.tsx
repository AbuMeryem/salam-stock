"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Keyboard,
  ScanBarcode,
  X,
} from "lucide-react";

/**
 * Scanner code-barre v5 — TRIPLE FALLBACK pour iOS 26 PWA
 *
 * Moteur 1 : BarcodeDetector natif (Safari iOS 17+) → ~80ms/frame, ultra rapide
 * Moteur 2 : ZXing browser (TS pur, marche partout) → ~250ms/frame
 * Moteur 3 : Saisie manuelle TOUJOURS visible → secours absolu démo
 *
 * Choix d'API stable : on garde la signature {open, onClose, onScan} qui est
 * importée par 5 pages — seul l'engine de décodage change.
 */

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

type Phase = "idle" | "starting" | "scanning" | "error";
type Engine = "native" | "zxing" | null;

function hasNativeBarcodeDetector(): boolean {
  if (typeof window === "undefined") return false;
  return "BarcodeDetector" in window;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const onScanRef = useRef(onScan);
  const stoppedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [engine, setEngine] = useState<Engine>(null);
  const [manualInput, setManualInput] = useState("");

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

  // Réinitialise à chaque ouverture, cleanup à chaque fermeture.
  useEffect(() => {
    if (open) {
      stoppedRef.current = false;
      setErrorMsg(null);
      setManualInput("");
    } else {
      stopAll();
    }
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      // 1. Liste devices pour choisir la caméra arrière. Labels visibles
      //    uniquement après une 1re permission, donc on choisit la dernière
      //    par défaut (généralement la back wide).
      let cameraId: string | undefined;
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const videos = all.filter((d) => d.kind === "videoinput");
        const rear = videos.find((d) =>
          /back|rear|environment|arrière|arriere/i.test(d.label)
        );
        cameraId = rear?.deviceId || videos[videos.length - 1]?.deviceId;
      } catch {
        /* iOS pré-permission : on tombera sur facingMode */
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

      // 2. Moteur 1 — BarcodeDetector natif (Safari iOS 17+)
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
          // Certains Safari refusent certains formats : retry sans liste
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

      // 3. Moteur 2 — ZXing fallback
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
      onScanRef.current(code);
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
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* État 1 — idle, demande user gesture pour iOS */}
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

        {/* État 2 — starting */}
        {phase === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="animate-spin w-12 h-12 border-4 border-gold border-t-transparent rounded-full mb-3" />
            <p className="text-white text-sm">Démarrage caméra…</p>
          </div>
        )}

        {/* État 3 — scanning : viseur */}
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

        {/* État 4 — erreur */}
        {phase === "error" && errorMsg && (
          <div className="absolute inset-x-0 top-1/4 mx-auto max-w-sm px-6 text-center text-white z-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <p className="font-bold text-lg">Caméra indisponible</p>
            <p className="text-sm text-white/80 mt-2 whitespace-pre-line">{errorMsg}</p>
            <button
              onClick={() => void startCamera()}
              className="mt-4 bg-white/15 text-white font-semibold rounded-full px-5 py-2 inline-flex items-center gap-2 text-sm"
            >
              <Camera className="w-4 h-4" />
              Réessayer
            </button>
            <p className="text-[11px] text-white/50 mt-3">
              Utilise la saisie manuelle en bas si le scan refuse.
            </p>
          </div>
        )}

        {/* Debug bar en bas du viseur — visible pendant scan */}
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

      {/* FALLBACK SAISIE MANUELLE — TOUJOURS visible */}
      <div className="px-5 pb-safe pt-3 bg-black/95 border-t border-white/10">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60 inline-flex items-center gap-1.5 mb-2">
          <Keyboard className="w-3 h-3" />
          Saisie manuelle
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
            placeholder="EAN ex. 3661234567893"
            className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-3 text-base font-mono tabular tracking-wide outline-none focus:bg-white/15 focus:ring-2 focus:ring-gold"
            maxLength={14}
            aria-label="Saisir le code-barre manuellement"
          />
          <button
            onClick={submitManual}
            disabled={manualInput.length < 4}
            className="bg-gold-bright text-primary-dark font-bold rounded-xl px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Valider
          </button>
        </div>
        <p className="text-[11px] text-white/50 mt-2 text-center">
          Place le code dans le cadre, ou tape l&apos;EAN si la caméra refuse.
        </p>
      </div>
    </div>
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
    return "Cette caméra ne supporte pas le mode demandé. Utilise la saisie manuelle.";
  }
  if (m.includes("secure context") || m.includes("https")) {
    return "Le scan nécessite une connexion HTTPS sécurisée.";
  }
  return "Scanner indisponible : " + raw + ".\nUtilise la saisie manuelle.";
}
