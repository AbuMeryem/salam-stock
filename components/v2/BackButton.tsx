"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Bouton "Retour" canonique pour toutes les pages V2.
 *
 * Comportement de navigation :
 *  - Toujours `router.back()` quand il y a un historique → respecte
 *    l'attente "le bouton retour revient à la page précédente".
 *  - `href` n'est PAS un push direct, c'est un FALLBACK pour les
 *    deep-links (utilisateur qui arrive directement sur la page sans
 *    historique, ex : Share Sheet iOS qui ouvre une URL fraîche). Sans
 *    historique, on push vers href ; sinon on ignore href.
 *  - Cette logique évite l'effet "retour-retour fait des allers-retours"
 *    quand on utilise router.push à la place de back (qui empile au lieu
 *    de dépiler l'historique).
 *
 * Spec visuelle :
 *  - Pill 40px de haut → min tap-target 44pt PRODUCT.md avec touch-zone.
 *  - bg-white + border-rule + shadow-card → visible sur tout background.
 *  - active:scale-[0.97] feedback tactile <100ms.
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

  function handleClick() {
    // Si on a un historique (au moins l'entrée actuelle + une autre),
    // on dépile. Sinon (deep-link entry directe), on push vers href ou
    // vers le hub par défaut.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(href ?? "/v2");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
