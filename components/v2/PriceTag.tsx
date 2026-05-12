"use client";

import { useV2 } from "@/lib/v2-store";

/**
 * Affiche un montant en euros UNIQUEMENT si l'employé a un rôle admin.
 *
 * Justification PRODUCT.md : Ilyes (préparation drive), Reda (réception
 * entrepôt) n'ont pas à voir le CA jour, le panier total ou le prix
 * unitaire d'un produit. Ces chiffres sont réservés à Otmane et Ahmed.
 *
 * Comportement :
 *  - role === 'admin' → rendu normal (montant formaté euros FR)
 *  - sinon → null (masqué, pas même un placeholder)
 *
 * Pour un fallback texte (ex "Total caché"), passer fallback explicite.
 */
export function PriceTag({
  amount,
  className = "",
  fallback = null,
  decimals = 2,
}: {
  amount: number | null | undefined;
  className?: string;
  fallback?: React.ReactNode;
  decimals?: 0 | 2;
}) {
  const role = useV2((s) => s.currentEmploye?.role);
  if (role !== "admin") return <>{fallback}</>;
  if (amount === null || amount === undefined) return <>{fallback}</>;
  return (
    <span className={`tabular ${className}`}>
      {new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount)}
    </span>
  );
}

/**
 * Hook qui retourne true si l'utilisateur courant a accès aux montants
 * (admin uniquement). Utile pour conditionner des sections entières,
 * pas juste un nombre.
 */
export function useCanSeePrices(): boolean {
  const role = useV2((s) => s.currentEmploye?.role);
  return role === "admin";
}
