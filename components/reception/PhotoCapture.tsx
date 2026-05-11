"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertTriangle, RefreshCw, Check, ImageUp } from "lucide-react";

interface PhotoCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export function PhotoCapture({ open, onClose, onCapture }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setError(null);
      setPreview(null);
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Caméra inaccessible";
        setError(msg);
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function takeSnapshot() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(w, 1080);
    canvas.height = Math.round((canvas.width / w) * h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    setPreview(dataUrl);
  }

  function confirm() {
    if (preview) {
      onCapture(preview);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="safe-top flex items-center justify-between px-5 pb-4 text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-gold" />
          <span className="font-semibold">Photo du carton</span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!error && !preview && (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        {preview && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={preview} alt="Aperçu" className="w-full h-full object-contain" />
        )}
        {error && (
          <div className="px-6 text-center text-white">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-danger/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-7 h-7 text-danger" />
            </div>
            <p className="font-semibold text-lg">Caméra inaccessible</p>
            <p className="text-sm text-white/70 mt-2">{error}</p>
            <p className="text-xs text-white/50 mt-3">
              Autorise l&apos;accès à la caméra ou choisis une photo dans la galerie.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 bg-gold-bright text-primary-dark rounded-full px-4 py-2.5 font-bold text-sm"
            >
              <ImageUp className="w-4 h-4" /> Choisir une photo
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFilePick}
        />
      </div>

      <div className="px-5 pb-8 pt-5 flex items-center justify-center gap-6">
        {preview ? (
          <>
            <button
              onClick={() => setPreview(null)}
              className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center"
              aria-label="Reprendre"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
            <button
              onClick={confirm}
              className="w-20 h-20 rounded-full bg-gold-bright text-primary-dark flex items-center justify-center shadow-card-lg"
              aria-label="Valider la photo"
            >
              <Check className="w-9 h-9" strokeWidth={3} />
            </button>
            <div className="w-14" />
          </>
        ) : (
          <button
            disabled={!!error}
            onClick={takeSnapshot}
            className="w-20 h-20 rounded-full bg-white border-4 border-white/30 disabled:opacity-40"
            aria-label="Prendre la photo"
          />
        )}
      </div>
    </div>
  );
}
