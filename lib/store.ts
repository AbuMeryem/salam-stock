"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import productsData from "./data/products.json";
import suppliersData from "./data/suppliers.json";
import ordersData from "./data/purchase-orders.json";
import receptionsData from "./data/receptions.json";
import inventoriesData from "./data/inventories.json";
import usersData from "./data/users.json";
import alertsData from "./data/alerts.json";
import activitiesData from "./data/activities.json";
import type {
  User,
  Product,
  Supplier,
  PurchaseOrder,
  Reception,
  Inventory,
  Alert,
  ActivityEntry,
  ReceptionLine,
  InventoryItem,
} from "./types";

interface StoreState {
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  logout: () => void;

  users: User[];
  products: Product[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  receptions: Reception[];
  inventories: Inventory[];
  alerts: Alert[];
  activities: ActivityEntry[];

  addProduct: (p: Product) => void;
  addReception: (r: Reception) => void;
  addInventory: (i: Inventory) => void;
  markOrderReceived: (orderId: string, status: "recu_conforme" | "recu_avec_ecart") => void;
  markAlertTreated: (id: string) => void;
  addActivity: (a: ActivityEntry) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      currentUser: null,
      setCurrentUser: (u) => set({ currentUser: u }),
      logout: () => set({ currentUser: null }),

      users: usersData as User[],
      products: productsData as Product[],
      suppliers: suppliersData as Supplier[],
      orders: ordersData as PurchaseOrder[],
      receptions: receptionsData as Reception[],
      inventories: inventoriesData as Inventory[],
      alerts: alertsData as Alert[],
      activities: activitiesData as ActivityEntry[],

      addProduct: (p) =>
        set((s) => ({
          products: [p, ...s.products],
          activities: [
            {
              id: "act-" + Date.now(),
              type: "produit",
              label: `Nouveau produit ajouté — ${p.name}`,
              user_id: s.currentUser?.id ?? "u-otmane",
              date: new Date().toISOString(),
            },
            ...s.activities,
          ],
        })),

      addReception: (r) =>
        set((s) => {
          const order = s.orders.find((o) => o.id === r.order_id);
          const supplierName = order
            ? s.suppliers.find((sp) => sp.id === order.supplier_id)?.name
            : "fournisseur";
          return {
            receptions: [r, ...s.receptions],
            activities: [
              {
                id: "act-" + Date.now(),
                type: "reception",
                label: `Réception ${order?.reference ?? ""} validée — ${supplierName} (${r.lignes.length} produits)`,
                user_id: r.user_id,
                date: r.date,
              },
              ...s.activities,
            ],
          };
        }),

      addInventory: (i) =>
        set((s) => ({
          inventories: [i, ...s.inventories],
          activities: [
            {
              id: "act-" + Date.now(),
              type: "inventaire",
              label: `Inventaire tournant — ${i.conformite_pct.toFixed(1)}% conformité (${i.items.length} produits)`,
              user_id: i.user_id,
              date: i.date,
            },
            ...s.activities,
          ],
        })),

      markOrderReceived: (orderId, status) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status } : o
          ),
        })),

      markAlertTreated: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, treated: true } : a)),
        })),

      addActivity: (a) =>
        set((s) => ({ activities: [a, ...s.activities] })),
    }),
    {
      name: "salam-stock-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentUser: s.currentUser,
        products: s.products,
        orders: s.orders,
        receptions: s.receptions,
        inventories: s.inventories,
        alerts: s.alerts,
        activities: s.activities,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export type { ReceptionLine, InventoryItem };
