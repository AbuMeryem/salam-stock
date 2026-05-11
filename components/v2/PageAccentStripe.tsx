"use client";

/**
 * Filet 4px de couleur en tout en haut de chaque page V2.
 * Permet à Otmane de reconnaître la fonction de la page d'un coup d'œil.
 *
 * Couleurs Salam strictes :
 *   - sapin   #0E3B2E (réception, étiquettes)
 *   - bordeaux #A8231A (sortie)
 *   - or      #C9A227 (transfert, inventaire)
 *   - foncé   #0A2A20 (stock)
 *   - sapin+or gradient (preparation, admin)
 */
type Accent =
  | "sapin"
  | "bordeaux"
  | "or"
  | "fonce"
  | "sapin-or"
  | "or-sapin";

const STYLE: Record<Accent, React.CSSProperties> = {
  sapin: { background: "#0E3B2E" },
  bordeaux: { background: "#A8231A" },
  or: { background: "#C9A227" },
  fonce: { background: "#0A2A20" },
  "sapin-or": {
    background: "linear-gradient(90deg, #C9A227 0%, #0E3B2E 100%)",
  },
  "or-sapin": {
    background: "linear-gradient(90deg, #0A2A20 0%, #C9A227 100%)",
  },
};

export function PageAccentStripe({ accent }: { accent: Accent }) {
  return (
    <div
      aria-hidden
      className="h-1 w-full"
      style={STYLE[accent]}
    />
  );
}
