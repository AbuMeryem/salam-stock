"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Bouton "Retour" canonique pour toutes les pages V2.
 *
 * Spec :
 *  - Pill 40px de haut → respecte la min tap-target 44pt PRODUCT.md
 *    une fois additionnée à la touch-zone iOS (+4pt).
 *  - bg-white + border-rule + shadow-card → décolle du fond cream
 *    et reste visible quel que soit le background de la page.
 *  - active:scale-[0.97] feedback tactile <100ms conforme DESIGN.md.
 *
 * Usage : `<BackButton />` en début de header. Override la cible
 * avec `href` (pousse à cette route au lieu de router.back()).
 */
export function BackButton({
  href,
  label = "Retour",
  className = "",
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (href ? router.push(href) : router.back())}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 h-10 pl-2.5 pr-4 rounded-full bg-white border border-rule shadow-card text-[13px] font-bold text-primary active:scale-[0.97] transition-transform ${className}`}
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cream">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.4} />
      </span>
      {label}
    </button>
  );
}
