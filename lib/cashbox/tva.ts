/**
 * Mapping TVA française par catégorie produit Stock.
 *
 * 5.5% — Produits alimentaires de première nécessité (boucherie,
 *        charcuterie, frais, surgelés, épicerie, fruits & légumes,
 *        produits du Maghreb)
 * 10%  — Traiteur (vente à consommer, restauration), boissons sans
 *        alcool consommables, certaines préparations
 * 20%  — Hygiène, bazar, alcool, tout produit non alimentaire
 *
 * Cf. https://www.economie.gouv.fr/cedef/taux-tva-france
 *
 * Fallback : 5.5% si catégorie inconnue (par défaut alimentaire).
 */
export type TvaRate = 5.5 | 10 | 20;

const RATE_BY_CATEGORY: Record<string, TvaRate> = {
  Traiteur: 10,
  Boissons: 10,
  Hygiène: 20,
  "Hygiene": 20,
  Bazar: 20,
};

/** Catégories explicitement alimentaires → 5.5% */
const FOOD_5_5: ReadonlySet<string> = new Set([
  "Boucherie",
  "Charcuterie",
  "Frais",
  "Surgelés",
  "Surgele",
  "Épicerie",
  "Epicerie",
  "Produits du Maghreb",
  "Maghreb",
  "Fruits & Légumes",
  "Fruits & Legumes",
  "Fruits et légumes",
]);

export function tvaRateForCategory(categorie: string | null | undefined): TvaRate {
  if (!categorie) return 5.5;
  if (FOOD_5_5.has(categorie)) return 5.5;
  if (RATE_BY_CATEGORY[categorie]) return RATE_BY_CATEGORY[categorie];
  // Fallback sécurisé : alimentaire 5.5
  return 5.5;
}

/** Décompose un prix TTC en HT + TVA selon le taux */
export function decomposeTTC(ttc: number, rate: TvaRate): { ht: number; tva: number } {
  const ht = ttc / (1 + rate / 100);
  const tva = ttc - ht;
  return { ht, tva };
}

/** Estime les frais Stripe : 1.4% + 0.25 € par transaction CB EU
 *  https://stripe.com/fr/pricing */
export function estimateStripeFee(ttcEuro: number): number {
  return ttcEuro * 0.014 + 0.25;
}

/** Format français : 1 234,56 € */
export function formatEurFr(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Format date FR : 11/05/2026 */
export function formatDateFr(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Format heure FR : 14h32 */
export function formatHeureFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).replace(":", "h");
}
