export type UserRole = "directeur" | "manager" | "employe";

export interface User {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  email: string;
}

export type Category =
  | "Épicerie"
  | "Boucherie"
  | "Charcuterie"
  | "Boissons"
  | "Surgelés"
  | "Frais"
  | "Produits du Maghreb"
  | "Hygiène";

export type Unit = "piece" | "kg" | "L";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  barcode: string;
  supplier_id: string;
  purchase_price: number;
  sale_price: number;
  stock_theoretical: number;
  stock_min: number;
  unit: Unit;
  image_url: string | null;
  last_received_at: string | null;
  last_inventoried_at?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
}

export type OrderStatus =
  | "en_attente_reception"
  | "recu_avec_ecart"
  | "recu_conforme"
  | "annule";

export interface OrderLine {
  product_id: string;
  quantite_commandee: number;
  prix_unitaire: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplier_id: string;
  date_commande: string;
  date_livraison_prevue: string;
  lignes: OrderLine[];
  status: OrderStatus;
  total_ht: number;
  notes?: string;
}

export interface ReceptionLine {
  product_id: string;
  quantite_commandee: number;
  quantite_recue: number;
  ecart_pct: number;
  photos: string[];
  scanned: boolean;
}

export interface Reception {
  id: string;
  order_id: string;
  user_id: string;
  date: string;
  lignes: ReceptionLine[];
  ecart_global_pct: number;
  justification?: string;
  photo_carton_count: number;
  conformite_pct: number;
}

export interface InventoryItem {
  product_id: string;
  stock_theoretical: number;
  stock_compte: number | null;
  ecart: number;
  photo?: string | null;
}

export type InventoryStatus = "en_cours" | "termine";

export interface Inventory {
  id: string;
  date: string;
  user_id: string;
  items: InventoryItem[];
  status: InventoryStatus;
  conformite_pct: number;
}

export type AlertType =
  | "ecart"
  | "anomalie"
  | "vitesse"
  | "suspicion"
  | "conformite"
  | "recommandation";

export type AlertSeverity = "critique" | "recommandation" | "conformite";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  date: string;
  related_id?: string;
  treated?: boolean;
}

export interface ActivityEntry {
  id: string;
  type: "reception" | "inventaire" | "alerte" | "produit";
  label: string;
  user_id: string;
  date: string;
}
