"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Keyboard,
  ScanBarcode,
  X,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

const SCANNER_ID = "salam-barcode-reader";

/**
 * Scanner code-barre — modale plein écran avec :
 * — user gesture explicite ("Activer la caméra") pour respecter iOS Safari.
 *   Sans tap utilisateur, Safari refuse parfois getUserMedia même HTTPS.
 * — fallback saisie manuelle TOUJOURS visible : si la caméra refuse,
 *   l'opérateur tape l'EAN au clavier numérique iPhone et la prépa
 *   continue. Le workflow magasin n'est jamais bloqué.
 * — facingMode "ideal" (pas "exact") → fallback caméra frontale si
 *   l'iPhone n'a pas de back camera (rare mais arrive sur SE/iPad).
 * — formats explicites EAN-13/8 + UPC + Code128/39 + ITF → détection
 *   plus rapide qu'avec la lib en mode "tout".
 */
export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  /** Capture la dernière onScan pour éviter de restart le scanner si le
   *  parent recrée la fn à chaque render. */
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Reset état à chaque ouverture
  useEffect(() => {
    if (open) {
      setStarted(false);
      setError(null);
      setManualInput("");
    }
  }, [open]);

  async function startCamera() {
    setError(null);
    try {
      const reader = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      scannerRef.current = reader;
      await reader.start(
        { facingMode: { ideal: "environment" } },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
          aspectRatio: 1.7,
          // Hints qualité — focus continu + zoom léger améliore lecture
          // des EAN-13 imprimés petit (canettes, sachets).
          // focusMode + zoom : supportés Safari iOS 17+ mais hors de la def
          // standard MediaTrackConstraints. Cast pour éviter le bruit TS.
          videoConstraints: {
            facingMode: { ideal: "environment" },
            focusMode: "continuous",
            advanced: [{ zoom: 1.5 }],
          } as unknown as MediaTrackConstraints,
        },
        (decoded) => {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(40);
          }
          // appel via ref pour ignorer les re-créations de fn parent
          onScanRef.current(decoded);
        },
        () => {
          // per-frame "NotFound" : silencieux
        }
      );
      startedRef.current = true;
      setStarted(true);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(humanError(raw));
    }
  }

  async function stopCamera() {
    const r = scannerRef.current;
    if (r && startedRef.current) {
      try {
        await r.stop();
        await r.clear();
      } catch {
        /* ignore stop errors — souvent un double-stop bénin */
      }
    }
    startedRef.current = false;
    setStarted(false);
  }

  // Cleanup robuste : à la fermeture ou au démontage du composant.
  useEffect(() => {
    if (!open) {
      void stopCamera();
    }
    return () => {
      void stopCamera();
    };
  }, [open]);

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
      <div className="flex-1 relative flex items-center justify-center">
        <div
          id={SCANNER_ID}
          className="w-full max-w-[460px] aspect-[3/4] bg-black overflow-hidden"
        />

        {/* État 1 : pas démarré, demande user gesture (iOS) */}
        {!started && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
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

        {/* État 2 : actif → afficher cadre de visée */}
        {started && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[280px] h-[140px] border-2 border-gold rounded-2xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-gold rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-gold rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-gold rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-gold rounded-br-2xl" />
            </div>
          </div>
        )}

        {/* État 3 : erreur */}
        {error && (
          <div className="absolute inset-x-0 top-1/4 mx-auto max-w-sm px-6 text-center text-white">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <p className="font-bold text-lg">Caméra indisponible</p>
            <p className="text-sm text-white/80 mt-2">{error}</p>
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

      {/* FALLBACK SAISIE MANUELLE — toujours visible */}
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

/** Traduit les erreurs getUserMedia / Html5Qrcode en messages FR
 *  actionnables pour un employé magasin (pas un dev). */
function humanError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("permission") || m.includes("notallowed")) {
    return "Permission caméra refusée. Réglages iPhone → Safari → Caméra → Autoriser, puis recharge la page.";
  }
  if (m.includes("notfound") || m.includes("devicenotfound")) {
    return "Aucune caméra détectée sur cet appareil.";
  }
  if (m.includes("notreadable") || m.includes("trackstart")) {
    return "Caméra occupée par une autre app. Ferme les autres apps et réessaie.";
  }
  if (m.includes("overconstrained")) {
    return "Cette caméra ne supporte pas le mode demandé. Utilise la saisie manuelle ci-dessous.";
  }
  if (m.includes("secure context") || m.includes("https")) {
    return "Le scan nécessite une connexion HTTPS sécurisée.";
  }
  return "Scanner indisponible : " + raw + ". Utilise la saisie manuelle.";
}
