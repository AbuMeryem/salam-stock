"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Barre flottante "Téléchargement terminé" qui apparaît après un
 * download/share sur les pages Cashbox.
 *
 * Justification : sur iOS PWA standalone, un download peut emmener
 * l'utilisateur hors de la PWA (Share Sheet, ouverture Safari).
 * Quand il revient, cette barre lui rappelle qu'il a téléchargé X
 * et lui propose de retourner à la page admin OU de fermer la barre.
 */
export function DownloadCompleteBar({
  filename,
  onDismiss,
  backLabel = "Retour à /v2/admin",
  backHref = "/v2/admin",
}: {
  filename: string | null;
  onDismiss: () => void;
  backLabel?: string;
  backHref?: string;
}) {
  const router = useRouter();

  return (
    <AnimatePresence>
      {filename && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 z-[55] pointer-events-none px-3"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          }}
        >
          <div className="pointer-events-auto mx-auto max-w-[460px] bg-white border border-rule rounded-[18px] shadow-card-lg px-3 py-2.5 flex items-center gap-2">
            <span className="inline-flex w-9 h-9 rounded-full bg-success-soft items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-text-primary leading-tight">
                Fichier prêt
              </p>
              <p className="text-[10.5px] text-text-secondary truncate mt-0.5 mono">
                {filename}
              </p>
            </div>
            <button
              onClick={() => router.push(backHref)}
              className="inline-flex items-center gap-1 bg-primary text-white text-[11.5px] font-bold rounded-full px-3 py-1.5 active:scale-95 transition-transform"
              aria-label={backLabel}
            >
              <ArrowLeft className="w-3 h-3" />
              Retour
            </button>
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-full bg-cream flex items-center justify-center text-text-tertiary active:scale-90 transition-transform"
              aria-label="Fermer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
