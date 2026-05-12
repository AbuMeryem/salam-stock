"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Calculator,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PackageX,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

interface AdminMenuProps {
  /** N'affiche le bouton que si role = "admin". */
  role: string | undefined;
}

interface MenuEntry {
  href: string;
  label: string;
  desc: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  accent?: "danger" | "gold" | "primary";
}

/** Toutes les pages admin V2 — réservées au menu hamburger admin. */
const ADMIN_ENTRIES: MenuEntry[] = [
  {
    href: "/v2/admin",
    label: "Dashboard global",
    desc: "Vue 3 dépôts + KPIs + alertes",
    icon: LayoutDashboard,
    accent: "primary",
  },
  {
    href: "/v2/admin/alertes",
    label: "Alertes IA",
    desc: "Sorties suspectes, démarque, surplus",
    icon: AlertOctagon,
    accent: "danger",
  },
  {
    href: "/v2/admin/activite",
    label: "Activité complète",
    desc: "Réceptions, sorties, transferts horodatés",
    icon: BarChart3,
  },
  {
    href: "/v2/admin/alertes-surplus",
    label: "Surplus fournisseurs",
    desc: "À accepter ou refuser",
    icon: AlertTriangle,
  },
  {
    href: "/v2/admin/recap-fiscal",
    label: "Récap fiscal du jour",
    desc: "TVA, ventes, ticket Z",
    icon: Calculator,
    accent: "gold",
  },
  {
    href: "/v2/admin/rapport-mensuel",
    label: "Rapport mensuel",
    desc: "CA, top produits, comparatifs",
    icon: BarChart3,
  },
  {
    href: "/v2/admin/import-cashmag",
    label: "Import Cashmag",
    desc: "Charger les ventes caisse",
    icon: FileSpreadsheet,
  },
  {
    href: "/v2/admin/assistant-ia",
    label: "Assistant IA business",
    desc: "Chat avec ton stock",
    icon: MessageSquare,
    accent: "gold",
  },
  {
    href: "/v2/inventaire/historique",
    label: "Historique inventaire",
    desc: "Tournants validés",
    icon: ClipboardCheck,
  },
  {
    href: "/v2/stock/sans-ean",
    label: "Articles sans code-barre",
    desc: "Produits sans EAN ou EAN illisible",
    icon: PackageX,
  },
];

export function AdminMenu({ role }: AdminMenuProps) {
  const [open, setOpen] = useState(false);

  // Ferme avec Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (role !== "admin") return null;

  // Le drawer est portalé sur <body> pour échapper au stacking-context
  // du parent relative de V2Shell. Sans ça, sur certains rendus iOS le
  // drawer se rendait derrière le contenu malgré z-[80].
  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="admin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[200] bg-primary-dark/55 backdrop-blur-[6px]"
          />
          <motion.aside
            key="admin-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin"
            className="fixed inset-y-0 right-0 z-[201] w-[88%] max-w-[380px] bg-white shadow-card-lg flex flex-col"
          >
              {/* HEADER */}
              <div className="safe-top px-5 pb-3 flex items-center justify-between border-b border-rule">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gold-soft text-primary-dark flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                      Admin
                    </p>
                    <p className="text-sm font-bold text-text-primary leading-tight">
                      Outils complets
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-text-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* LISTE */}
              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                {ADMIN_ENTRIES.map((e) => {
                  const Icon = e.icon;
                  return (
                    <Link
                      key={e.href}
                      href={e.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-cream transition-colors"
                    >
                      <span
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          e.accent === "danger"
                            ? "bg-danger-soft text-danger"
                            : e.accent === "gold"
                              ? "bg-gold-soft text-primary-dark"
                              : "bg-cream text-primary"
                        }`}
                      >
                        <Icon className="w-5 h-5" strokeWidth={2.1} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {e.label}
                        </p>
                        <p className="text-[11px] text-text-secondary truncate">
                          {e.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="px-5 pb-[calc(var(--safe-bottom)+12px)] pt-3 border-t border-rule">
                <p className="text-[10.5px] text-text-tertiary inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-gold" />
                  Visible uniquement pour les admins
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-full bg-primary text-white border border-primary flex items-center justify-center"
        aria-label="Menu admin"
        title="Menu admin"
      >
        <Menu className="w-4 h-4" />
      </button>
      {typeof document !== "undefined" && createPortal(drawer, document.body)}
    </>
  );
}
