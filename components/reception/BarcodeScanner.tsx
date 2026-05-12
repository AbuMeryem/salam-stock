"use client";

import { useEffect, useRef, useState } from "react";
import { X, ScanBarcode, Camera, AlertTriangle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

const SCANNER_ID = "salam-barcode-reader";

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setError(null);
      try {
        const reader = new Html5Qrcode(SCANNER_ID, { verbose: false });
        scannerRef.current = reader;
        await reader.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.4,
          },
          (decoded) => {
            if (cancelled) return;
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate?.(40);
            }
            onScan(decoded);
          },
          () => {
            /* ignore per-frame fail */
          }
        );
        startedRef.current = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Impossible d'accéder à la caméra.";
        setError(msg);
      }
    }

    start();
    return () => {
      cancelled = true;
      const r = scannerRef.current;
      if (r && startedRef.current) {
        r.stop()
          .catch(() => {})
          .finally(() => {
            r.clear();
            startedRef.current = false;
          });
      }
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="safe-top flex items-center justify-between px-5 pb-4 text-white">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-5 h-5 text-gold" />
          <span className="font-semibold">Scanner un code-barres</span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <div id={SCANNER_ID} className="w-full max-w-[460px] aspect-[3/4] bg-black overflow-hidden" />
        {!error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[260px] h-[160px] border-2 border-gold rounded-2xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-gold rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-gold rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-gold rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-gold rounded-br-2xl" />
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-x-0 top-1/3 mx-auto max-w-sm px-6 text-center text-white">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <p className="font-semibold text-lg">Caméra inaccessible</p>
            <p className="text-sm text-white/70 mt-2">{error}</p>
            <p className="text-xs text-white/50 mt-3">
              Autorise l&apos;accès à la caméra dans les réglages du navigateur puis réessaie.
            </p>
            <button
              onClick={onClose}
              className="mt-5 inline-flex items-center gap-2 bg-white text-primary-dark font-semibold px-5 py-2.5 rounded-full"
            >
              <Camera className="w-4 h-4" />
              Saisir manuellement
            </button>
          </div>
        )}
      </div>

      <div className="px-5 py-5 text-center">
        <p className="text-white/70 text-sm">
          Placez le code-barres dans le cadre. Détection automatique.
        </p>
      </div>
    </div>
  );
}
