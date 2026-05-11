"use client";

/**
 * Typographic product thumbnail.
 * Replaces remote image URLs with a brand-coloured tile + 2-letter initials.
 * Color is derived from the product category — see CATEGORY_COLOR.
 */

interface ProductThumbnailProps {
  /** Product name — used to extract the 2-letter glyph. */
  nom: string;
  /** Product category — drives the background color. */
  categorie?: string | null;
  /** Pixel size of the square (default 48). */
  size?: number;
  /** Tailwind classes for sizing — overrides `size` when provided. */
  className?: string;
  /** Visual rounding ; defaults to 8px (rounded-lg). */
  rounded?: "lg" | "xl" | "2xl" | "full";
}

const CATEGORY_COLOR: Record<string, string> = {
  // Palette Salam C2-E : couleurs vives, pas pastel.
  Boucherie: "#A8231A",       // bordeaux
  Frais: "#5BC85B",           // vert frais
  Charcuterie: "#5BC85B",     // vert frais (catégorie froide claire)
  Épicerie: "#C9A227",        // or
  "Épicerie sèche": "#C9A227",
  "Produits du Maghreb": "#0E3B2E", // sapin
  Maghreb: "#0E3B2E",
  Conserves: "#0E3B2E",
  Surgelés: "#4A90E2",        // bleu froid
  Traiteur: "#0A2A20",        // sapin foncé pour la zone traiteur
  "Fruits & Légumes": "#6CAB44",
  "F&L": "#6CAB44",
  Boissons: "#525252",
  Hygiène: "#525252",
  Autre: "#525252",
};

const FALLBACK = "#525252";

const ROUND_CLS: Record<NonNullable<ProductThumbnailProps["rounded"]>, string> = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

function getInitials(nom: string): string {
  const trimmed = nom.trim();
  if (!trimmed) return "?";
  // Try first 2 word-initials; fall back to first 2 chars.
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function ProductThumbnail({
  nom,
  categorie,
  size = 48,
  className,
  rounded = "lg",
}: ProductThumbnailProps) {
  const bg = (categorie && CATEGORY_COLOR[categorie]) || FALLBACK;
  const initials = getInitials(nom);
  // Font size scales with tile size — but caps so big tiles don't over-blow.
  const fontPx = Math.max(10, Math.min(28, Math.round(size * 0.4)));
  const style = className
    ? { backgroundColor: bg }
    : { backgroundColor: bg, width: size, height: size, fontSize: fontPx };

  return (
    <div
      role="img"
      aria-label={`Vignette ${nom}`}
      className={
        className
          ? `${className} ${ROUND_CLS[rounded]} shrink-0 inline-flex items-center justify-center text-white font-bold tracking-tight select-none`
          : `${ROUND_CLS[rounded]} shrink-0 inline-flex items-center justify-center text-white font-bold tracking-tight select-none`
      }
      style={style}
    >
      {initials}
    </div>
  );
}
