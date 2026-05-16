/* Salam Stock V2 — DB row types matching supabase/migrations/0001_init.sql */

export type DepotType = "point_vente" | "entrepot";
export type EmployeRole =
  | "reception"
  | "caisse"
  | "preparation"
  | "manager"
  | "admin";

export type SortieType =
  | "casse_manipulation"
  | "casse_client"
  | "perime_dlc"
  | "perime_ddm"
  | "defaut_fournisseur"
  | "demarque_inconnue"
  | "autre";

export type ReceptionStatus = "en_cours" | "validee";
export type InventaireStatus = "assigne" | "compte" | "valide";
export type CommandeDriveStatus =
  | "a_preparer"
  | "en_preparation"
  | "pret"
  | "retire"
  | "annule";
export type LignePreparationStatus = "en_attente" | "prepare" | "manquant";
export type ZonePreparationDrive = "particulier" | "professionnel" | "traiteur";
export type ModePaiement = "stripe" | "en_magasin";

/** Drive au poids — type catalogue (cf. migration 0029_drive_au_poids). */
export type ProduitUnitType = "unit" | "weight" | "weight_bracket";

/** Drive au poids — statut Stripe manual capture (cf. 0029). */
export type StatutPaiementDrive =
  | "autorise" // PI créé, capture pas encore faite
  | "capture" // capture finalisée après pesée
  | "libere" // annulation, pré-auto libérée
  | "echec"; // payment_failed côté Stripe

export interface Depot {
  id: string;
  nom: string;
  type: DepotType;
  adresse: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Produit {
  id: string;
  ean: string | null;
  nom: string;
  marque: string | null;
  categorie: string | null;
  sous_categorie: string | null;
  image_url: string | null;
  description: string | null;
  requires_barcode_print: boolean;
  est_traiteur: boolean;
  /** Type de client cible — détermine le badge sur les commandes Drive. */
  client_type?: "particulier" | "pro" | "traiteur" | null;
  // ── Drive au poids variable (migration 0029, optionnel pour
  //    rétro-compatibilité avec les produits unit historiques) ────
  /** Si absent ou 'unit' : prix forfait classique (price = price_cents). */
  unit_type?: ProduitUnitType | null;
  /** EUR/kg pour unit_type='weight'. */
  price_per_kg?: number | null;
  /** Estimation poids unitaire en kg (pour info UI). */
  estimated_weight_kg?: number | null;
  /** Bornes du bracket pour unit_type='weight_bracket'. */
  poids_min_kg?: number | null;
  poids_max_kg?: number | null;
  created_at: string;
  updated_at: string;
}

export interface StockParDepot {
  id: string;
  produit_id: string;
  depot_id: string;
  quantite: number;
  prix_vente: number | null;
  is_visible: boolean;
  updated_at: string;
}

/** Joined view we use throughout the app. */
export interface ProduitInDepot extends Produit {
  stock_id: string;
  depot_id: string;
  quantite: number;
  prix_vente: number | null;
  is_visible: boolean;
}

export interface CodeBarreCarton {
  id: string;
  ean_carton: string;
  produit_id: string;
  quantite_par_carton: number;
  fournisseur: string | null;
  created_at: string;
  learned_by: string | null;
}

export interface Employe {
  id: string;
  nom: string;
  prenom: string | null;
  role: EmployeRole;
  depot_principal_id: string | null;
  is_active: boolean;
  pin_code: string;
}

export interface Reception {
  id: string;
  depot_id: string;
  employe_id: string;
  fournisseur: string | null;
  numero_bl: string | null;
  photo_url: string;
  statut: ReceptionStatus;
  reception_vide: boolean;
  created_at: string;
}

export interface ReceptionLigne {
  id: string;
  reception_id: string;
  produit_id: string;
  code_scanne: string | null;
  quantite_scannee: number;
  quantite_calculee: number;
}

export interface SortieStock {
  id: string;
  depot_id: string;
  employe_id: string;
  produit_id: string;
  type: SortieType;
  motif_libre: string | null;
  quantite: number;
  photo_url: string;
  ia_coherence_score: number | null;
  ia_coherence_notes: string | null;
  created_at: string;
}

export interface TransfertInterDepot {
  id: string;
  depot_source_id: string;
  depot_destination_id: string;
  produit_id: string;
  quantite: number;
  employe_id: string;
  photo_url: string | null;
  created_at: string;
}

export interface InventaireTournant {
  id: string;
  depot_id: string;
  produit_id: string;
  employe_assigne_id: string;
  date_assignation: string;
  quantite_attendue: number | null;
  quantite_comptee: number | null;
  ecart: number;
  statut: InventaireStatus;
  created_at: string;
  completed_at: string | null;
}

export interface CommandeDrive {
  id: string;
  numero_commande: string;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  creneau_retrait: string;
  statut: CommandeDriveStatus;
  total_ttc: number;
  mode_paiement: ModePaiement;
  created_at: string;
  // ── Drive au poids — Stripe manual capture (migration 0029) ────────
  // Optionnels : commandes legacy (paiement en magasin / Checkout
  // hosted classique) n'ont pas ces colonnes peuplées.
  stripe_payment_intent_id?: string | null;
  montant_autorise_ttc?: number | null;
  montant_capture_ttc?: number | null;
  statut_paiement?: StatutPaiementDrive | null;
  autorisation_expire_at?: string | null;
}

export interface CommandeDriveLigne {
  id: string;
  commande_id: string;
  produit_id: string;
  depot_id: string;
  /** Zone physique de préparation (≠ dépôt de stock). Sodrune ne fait
   *  jamais partie d'une commande drive — voir 0004_zones_drive.sql. */
  zone_preparation: ZonePreparationDrive;
  quantite: number;
  prix_unitaire: number;
  statut_preparation: LignePreparationStatus;
  prepare_par_employe_id: string | null;
  prepare_at: string | null;
  // ── Drive au poids — pesée + écarts (migration 0029) ───────────────
  quantite_estimee?: number | null;
  quantite_reelle_pesee?: number | null;
  montant_estime_ttc?: number | null;
  montant_reel_ttc?: number | null;
  pese_par?: string | null;
  pese_at?: string | null;
}
