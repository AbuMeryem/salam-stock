"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface RecognitionResult {
  produit_reconnu: boolean;
  nom_suggere: string;
  marque_suggeree: string;
  categorie_suggeree: string;
  sous_categorie_suggeree: string;
  description_courte: string;
  quantite_carton_estimee: number;
  confiance: number;
  mock?: boolean;
}

interface Props {
  open: boolean;
  /** Initial guess of carton quantity (from previous step), used as fallback. */
  fallbackQuantite?: number;
  onClose: () => void;
  /** User accepted the IA-suggested values. */
  onAccept: (result: RecognitionResult) => void;
}

type Step = "camera" | "loading" | "result" | "error";

export function ProductRecognitionModal({
  open,
  fallbackQuantite,
  onClose,
  onAccept,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("camera");
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setStep("camera");
    setPhoto(null);
    setResult(null);
    setErrorMsg("");

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        // user denied or no camera — gallery picker still works
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(w, 1280);
    canvas.height = Math.round((canvas.width / w) * h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPhoto(dataUrl);
    void analyze(dataUrl);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      if (typeof url === "string") {
        setPhoto(url);
        void analyze(url);
      }
    };
    reader.readAsDataURL(file);
  }

  async function analyze(dataUrl: string) {
    setStep("loading");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const r = await fetch("/api/vision-product-recognition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photo_data_url: dataUrl }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as RecognitionResult;
      setResult(j);
      setStep("result");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur d'analyse");
      setStep("error");
    }
  }

  function accept() {
    if (!result) return;
    const final: RecognitionResult = {
      ...result,
      quantite_carton_estimee:
        result.quantite_carton_estimee > 0
          ? result.quantite_carton_estimee
          : (fallbackQuantite ?? 0),
    };
    onAccept(final);
  }

  function retry() {
    setPhoto(null);
    setResult(null);
    setStep("camera");
    // re-open camera
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {}
    })();
  }

  if (!open) return null;

  const confidencePct = Math.round((result?.confiance ?? 0) * 100);
  const goodConfidence = (result?.confiance ?? 0) >= 0.6;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black flex flex-col"
      >
        {/* Header */}
        <div className="safe-top flex items-center justify-between px-5 pb-4 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold" />
            <span className="font-semibold">Reconnaissance IA</span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {step === "camera" && (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[280px] h-[180px] border-2 border-gold/80 rounded-2xl" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFilePick}
              />
            </>
          )}

          {step === "loading" && (
            <div className="text-center text-white">
              {photo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photo}
                  alt="Analyse"
                  className="w-44 h-44 object-cover rounded-2xl mx-auto mb-6 border border-white/20"
                />
              )}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/20 mb-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 rounded-full border-2 border-gold border-t-transparent"
                />
              </div>
              <p className="text-sm font-bold">Claude analyse le carton…</p>
              <p className="text-xs text-white/60 mt-1">2 à 4 secondes</p>
            </div>
          )}

          {step === "result" && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-[420px] px-5"
            >
              <div className="bg-white rounded-3xl p-5 shadow-card-lg">
                {photo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo}
                    alt="Analyse"
                    className="w-full aspect-video object-cover rounded-2xl mb-4"
                  />
                )}
                <div className="flex items-center gap-2 mb-3">
                  {result.produit_reconnu ? (
                    <>
                      <Sparkles className="w-4 h-4 text-gold" />
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Produit identifié
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-warning" />
                      <span className="text-xs font-bold uppercase tracking-wider text-warning">
                        Faible confiance — vérifie
                      </span>
                    </>
                  )}
                  <span
                    className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      goodConfidence
                        ? "bg-success-soft text-success"
                        : "bg-warning-soft text-warning"
                    }`}
                  >
                    Confiance {confidencePct}%
                  </span>
                </div>
                <p className="text-lg font-bold text-text-primary leading-tight">
                  {result.nom_suggere || "Nom non identifié"}
                </p>
                {result.marque_suggeree && (
                  <p className="text-sm text-text-secondary mt-0.5">
                    {result.marque_suggeree}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {result.categorie_suggeree && (
                    <span className="bg-cream border border-rule rounded-full px-2 py-0.5 font-semibold text-primary">
                      {result.categorie_suggeree}
                    </span>
                  )}
                  {result.sous_categorie_suggeree && (
                    <span className="bg-cream border border-rule rounded-full px-2 py-0.5 text-text-secondary">
                      {result.sous_categorie_suggeree}
                    </span>
                  )}
                  {result.quantite_carton_estimee > 0 && (
                    <span className="bg-gold/10 text-primary-dark rounded-full px-2 py-0.5 font-bold">
                      × {result.quantite_carton_estimee} / carton
                    </span>
                  )}
                </div>
                {result.description_courte && (
                  <p className="text-xs text-text-secondary mt-3 italic">
                    {result.description_courte}
                  </p>
                )}
                {result.mock && (
                  <p className="text-[10px] text-text-tertiary mt-3">
                    (Mode mock — ANTHROPIC_API_KEY non configurée)
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button
                    onClick={retry}
                    className="bg-cream text-text-primary rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold border border-rule"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reprendre
                  </button>
                  <button
                    onClick={accept}
                    className="bg-primary text-white rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <Check className="w-4 h-4" />
                    Utiliser ces infos
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="w-full mt-2 text-xs text-text-secondary font-semibold py-2"
                >
                  Saisir manuellement →
                </button>
              </div>
            </motion.div>
          )}

          {step === "error" && (
            <div className="text-center text-white px-6">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-danger" />
              </div>
              <p className="font-bold">L&apos;analyse a échoué</p>
              <p className="text-sm text-white/70 mt-2">{errorMsg}</p>
              <button
                onClick={retry}
                className="mt-5 bg-gold-bright text-primary-dark rounded-full px-5 py-2.5 font-bold text-sm"
              >
                Reprendre la photo
              </button>
            </div>
          )}
        </div>

        {/* Camera shutter */}
        {step === "camera" && (
          <div className="px-5 pb-8 pt-5 flex items-center justify-center gap-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center"
              aria-label="Choisir une photo"
            >
              <Camera className="w-6 h-6" />
            </button>
            <button
              onClick={snap}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30"
              aria-label="Prendre la photo"
            />
            <div className="w-14" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
