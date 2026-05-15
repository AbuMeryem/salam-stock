/** Types partagés pour le workflow de préparation Drive. */

export type UnitType = "unit" | "weight" | "weight_bracket";

export interface ProduitDetail {
  id: string;
  nom: string;
  image_url: string | null;
  unit_type: UnitType | null;
  price_per_kg: number | null;
  poids_min_kg: number | null;
  poids_max_kg: number | null;
  /** Pour weight_bracket : tableau de brackets [{ label, poids_kg, prix_ttc }] */
  brackets_poids: BracketPoids[] | null;
}

export interface BracketPoids {
  label: string;
  poids_kg: number;
  prix_ttc: number;
}

export interface CommandeLigneDetail {
  id: string;
  commande_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  quantite_estimee: number | null;
  quantite_reelle_pesee: number | null;
  montant_estime_ttc: number | null;
  montant_reel_ttc: number | null;
  pese_par: string | null;
  pese_at: string | null;
  produits: ProduitDetail | null;
}

export interface CommandeDetail {
  id: string;
  numero_commande: string;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  creneau_retrait: string;
  statut: string;
  statut_paiement: string | null;
  total_ttc: number;
  montant_estime_ttc: number | null;
  montant_autorise_ttc: number | null;
  stripe_payment_intent_id: string | null;
}
