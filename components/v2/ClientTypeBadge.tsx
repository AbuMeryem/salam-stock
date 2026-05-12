"use client";

import { ShoppingBasket, Building2, ChefHat } from "lucide-react";

export type ClientType = "particulier" | "pro" | "traiteur";

/**
 * Badge canon Particulier / Pro / Traiteur.
 *
 * Visuel : pill compact avec icône + label, couleur dédiée par type.
 *  - Particulier : sapin sur cream (vente B2C classique)
 *  - Pro          : or sur sapin-doux (gros conditionnement B2B)
 *  - Traiteur     : bordeaux sur danger-soft (service à la commande)
 */

const STYLE: Record<ClientType, { bg: string; text: string; label: string; Icon: typeof ShoppingBasket }> = {
  particulier: {
    bg: "bg-cream",
    text: "text-primary-dark",
    label: "Particulier",
    Icon: ShoppingBasket,
  },
  pro: {
    bg: "bg-primary",
    text: "text-gold",
    label: "Pro",
    Icon: Building2,
  },
  traiteur: {
    bg: "bg-gold-soft",
    text: "text-primary-dark",
    label: "Traiteur",
    Icon: ChefHat,
  },
};

export function ClientTypeBadge({
  type,
  size = "md",
}: {
  type: ClientType;
  size?: "sm" | "md";
}) {
  const cfg = STYLE[type] ?? STYLE.particulier;
  const Icon = cfg.Icon;
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const iconSize = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text} ${padding} ${textSize}`}
    >
      <Icon className={iconSize} strokeWidth={2.4} />
      {cfg.label}
    </span>
  );
}

/**
 * Affiche les badges agrégés d'une commande. Si toutes les lignes sont
 * du même type → 1 badge. Sinon, 2 ou 3 badges côte à côte.
 */
export function ClientTypeBadgeGroup({
  types,
  size = "sm",
}: {
  types: Array<ClientType | null | undefined>;
  size?: "sm" | "md";
}) {
  const distinct = Array.from(
    new Set(
      types
        .filter((t): t is ClientType => t === "particulier" || t === "pro" || t === "traiteur")
    )
  );
  if (distinct.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {distinct.map((t) => (
        <ClientTypeBadge key={t} type={t} size={size} />
      ))}
    </span>
  );
}
