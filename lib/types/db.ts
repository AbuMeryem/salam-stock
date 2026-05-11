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
  | "en_preparation"
  | "pret"
  | "retire"
  | "annule";
export type LignePreparationStatus = "en_attente" | "prepare" | "manquant";
export type ModePaiement = "stripe" | "en_magasin";

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
}

export interface CommandeDriveLigne {
  id: string;
  commande_id: string;
  produit_id: string;
  depot_id: string;
  quantite: number;
  prix_unitaire: number;
  statut_preparation: LignePreparationStatus;
  prepare_par_employe_id: string | null;
  prepare_at: string | null;
}
