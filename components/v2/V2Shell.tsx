"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  PackageSearch,
  Repeat2,
  ShoppingBag,
  Tag,
  X,
} from "lucide-react";
import { useV2 } from "@/lib/v2-store";
import { dataMode } from "@/lib/db";
import { DepotSwitcher } from "./DepotSwitcher";
import { V2Logo } from "./V2Logo";
import { AdminMenu } from "./AdminMenu";
import { AssistantFab } from "./AssistantFab";

interface NavItem {
  label: string;
  fullLabel?: string;
  desc?: string;
  href: string;
  icon: typeof Home;
  exact?: boolean;
}

const ITEMS: Record<string, NavItem> = {
  accueil: { label: "Accueil", href: "/v2", icon: Home, exact: true, desc: "Vue d'ensemble" },
  reception: { label: "Récep.", fullLabel: "Réception", href: "/v2/reception", icon: ArrowDownToLine, desc: "Scan carton/unité + photo" },
  sortie: { label: "Sortie", fullLabel: "Sortie de stock", href: "/v2/sortie", icon: ArrowUpRight, desc: "Casse, périmé, photo + IA" },
  transfert: { label: "Transf.", fullLabel: "Transfert inter-dépôt", href: "/v2/transfert", icon: Repeat2, desc: "Bouger du stock" },
  stock: { label: "Stock", fullLabel: "Stock", href: "/v2/stock", icon: PackageSearch, desc: "Catalogue produits du dépôt" },
  preparation: { label: "Prépa.", fullLabel: "Préparation drive", href: "/v2/preparation", icon: ShoppingBag, desc: "Commandes à préparer" },
  inventaire: { label: "Invent.", fullLabel: "Inventaire tournant", href: "/v2/inventaire", icon: ClipboardList, desc: "5–10 produits du jour" },
  etiquettes: { label: "Étiq.", fullLabel: "Étiquettes EAN-13", href: "/v2/etiquettes", icon: Tag, desc: "Imprimer codes-barres internes" },
  admin: { label: "Admin", fullLabel: "Dashboard admin", href: "/v2/admin", icon: LayoutDashboard, desc: "Vue 3 dépôts + alertes IA" },
};

/** Choose primary nav items shown directly on the bar (max 4) per role. */
function primaryFor(role: string): NavItem[] {
  if (role === "admin") {
    return [ITEMS.accueil, ITEMS.stock, ITEMS.inventaire, ITEMS.admin];
  }
  // manager / reception / preparation / caisse
  return [ITEMS.accueil, ITEMS.reception, ITEMS.sortie, ITEMS.stock];
}

/** All other items go in the "Plus" sheet. Order matters here. */
function secondaryFor(role: string): NavItem[] {
  if (role === "admin") {
    return [
      ITEMS.reception,
      ITEMS.sortie,
      ITEMS.transfert,
      ITEMS.preparation,
      ITEMS.etiquettes,
    ];
  }
  if (role === "manager") {
    return [
      ITEMS.transfert,
      ITEMS.preparation,
      ITEMS.inventaire,
      ITEMS.etiquettes,
      ITEMS.admin,
    ];
  }
  // reception / preparation
  return [
    ITEMS.transfert,
    ITEMS.preparation,
    ITEMS.inventaire,
    ITEMS.etiquettes,
  ];
}

export function V2Shell({
  children,
  hideNav = false,
  className = "",
}: {
  children: ReactNode;
  hideNav?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const hydrated = useV2((s) => s.hydrated);
  const employe = useV2((s) => s.currentEmploye);
  const depot = useV2((s) => s.currentDepot);
  const logout = useV2((s) => s.logoutEmploye);
  const [mode, setMode] = useState<"supabase" | "local">("local");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setMode(dataMode());
  }, []);

  useEffect(() => {
    if (hydrated && !employe) router.replace("/v2/login");
  }, [hydrated, employe, router]);

  // Close the sheet on route change AND on Escape key.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Scroll en haut à chaque navigation. Next 14 le fait par défaut sur
  // <Link>, mais en PWA standalone iOS la position est parfois préservée
  // (et certains layouts intermédiaires retiennent le scroll). On force.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!employe) return null;

  const primary = primaryFor(employe.role);
  const secondary = secondaryFor(employe.role);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-[460px] min-h-screen relative bg-cream">
        {/* HEADER — refonte L99 : 3 zones (logo+identité / dépôt / actions admin),
            une ligne, breathing room, hiérarchie claire (logo-name-role). */}
        <header className="sticky top-0 z-30 bg-gradient-to-b from-[#0E3B2E] to-[#082A20] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-3 safe-top">
            {/* Bloc identité — clickable vers accueil */}
            <Link
              href="/v2"
              className="flex items-center gap-2.5 min-w-0 flex-1 active:opacity-70 transition-opacity"
              aria-label="Accueil Salam Stock"
            >
              <V2Logo size={32} />
              <div className="min-w-0 leading-tight">
                <p className="text-[14px] font-extrabold text-white tracking-tight truncate">
                  {employe.prenom}
                </p>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#C9A227] truncate">
                  {employe.role === "admin"
                    ? "Admin"
                    : employe.role === "manager"
                      ? "Manager"
                      : employe.role}
                  {depot ? ` · ${depot.nom}` : ""}
                </p>
              </div>
            </Link>

            {/* Actions à droite — DepotSwitcher en discret, hamburger admin proéminent, logout neutre */}
            <DepotSwitcher />
            <AdminMenu role={employe.role} />
            <button
              onClick={logout}
              className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white active:scale-95 transition-all"
              aria-label="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {mode === "local" && (
            <div className="bg-warning-soft text-warning text-[10px] font-bold uppercase tracking-wider text-center py-1">
              MODE DÉMO LOCAL · Supabase non connecté
            </div>
          )}
        </header>

        {/* MAIN */}
        <motion.main
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`${className} ${hideNav ? "pb-cta-only" : "pb-nav-stack"} pt-2`}
        >
          {!depot && (
            <div className="px-5 pt-6">
              <div className="bg-warning-soft rounded-2xl p-4 text-warning text-sm font-semibold">
                Sélectionnez un dépôt en haut à droite pour commencer.
              </div>
            </div>
          )}
          {depot && children}
        </motion.main>

        {/* BOTTOM NAV — 4 primary + "Plus"
            Pill 100% opaque pour rester lisible sur n'importe quel
            background de page. WCAG AA : labels en text-secondary
            (#6B7280) → 4.74:1 sur blanc. Shadow tight (8px blur), pas
            le -lg qui crée une lueur halo sapin trop grasse sur cream. */}
        {!hideNav && (
          <nav
            className="fixed bottom-0 inset-x-0 z-40 pb-safe pointer-events-none"
            aria-label="Navigation principale"
          >
            <div className="mx-auto max-w-[460px] px-3 pb-2 pt-2 pointer-events-auto">
              <div
                className="bg-white/95 backdrop-blur-md rounded-[24px] border border-rule px-2 py-2 flex items-center gap-1"
                style={{
                  boxShadow:
                    "0 1px 2px rgba(14,59,46,0.08), 0 6px 16px rgba(14,59,46,0.08)",
                }}
              >
                  {primary.map((it) => {
                    const Icon = it.icon;
                    const active = it.exact
                      ? pathname === it.href
                      : pathname.startsWith(it.href);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className="relative flex flex-col items-center justify-center px-1 py-1.5 flex-1 min-w-0"
                      >
                        {active && (
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-gold" />
                        )}
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                            active ? "bg-[color:var(--accent-gold-soft)]" : ""
                          }`}
                        >
                          <Icon
                            className={`w-[22px] h-[22px] transition-colors ${
                              active ? "text-primary-dark" : "text-text-secondary"
                            }`}
                            strokeWidth={active ? 2.4 : 2}
                          />
                        </span>
                        <span
                          className={`text-[10.5px] leading-tight mt-0.5 transition-colors whitespace-nowrap ${
                            active
                              ? "text-primary-dark font-bold"
                              : "text-text-secondary font-semibold"
                          }`}
                        >
                          {it.label}
                        </span>
                      </Link>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-label="Ouvrir le menu"
                    aria-expanded={sheetOpen}
                    className="relative flex flex-col items-center justify-center px-1 py-1.5 flex-1 min-w-0"
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full">
                      <MoreHorizontal
                        className="w-[22px] h-[22px] text-text-secondary"
                        strokeWidth={2}
                      />
                    </span>
                    <span className="text-[10.5px] font-semibold leading-tight mt-0.5 text-text-secondary whitespace-nowrap">
                      Plus
                    </span>
                  </button>
              </div>
            </div>
          </nav>
        )}

        {/* FAB Assistant IA — admin only, sticky au-dessus du nav */}
        <AssistantFab role={employe.role} hideOnNoNav={hideNav} />

        {/* PLUS SHEET */}
        <AnimatePresence>
          {sheetOpen && (
            <>
              <motion.div
                key="sheet-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setSheetOpen(false)}
                className="fixed inset-0 z-[60] bg-primary-dark/55 backdrop-blur-[6px]"
              />
              <motion.div
                key="sheet-body"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 32, stiffness: 320 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.4 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 90 || info.velocity.y > 500) {
                    setSheetOpen(false);
                  }
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Menu secondaire"
                className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-w-[460px] bg-white rounded-t-[28px] shadow-card-lg max-h-[70vh] flex flex-col"
              >
                <div className="pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
                  <span className="w-10 h-1 rounded-full bg-line-medium" />
                </div>
                <div className="px-5 pb-3 flex items-center justify-between">
                  <p className="text-base font-bold text-text-primary">Plus d&apos;actions</p>
                  <button
                    onClick={() => setSheetOpen(false)}
                    aria-label="Fermer le menu"
                    className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-text-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto px-3 pb-[calc(var(--safe-bottom)+16px)]">
                  {secondary.map((it) => {
                    const Icon = it.icon;
                    const active = pathname.startsWith(it.href);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => setSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors ${
                          active ? "bg-cream" : "active:bg-cream"
                        }`}
                      >
                        <span
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            active
                              ? "bg-primary text-white"
                              : "bg-cream text-primary"
                          }`}
                        >
                          <Icon className="w-5 h-5" strokeWidth={2.1} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary truncate">
                            {it.fullLabel ?? it.label}
                          </p>
                          {it.desc && (
                            <p className="text-[11px] text-text-tertiary truncate">
                              {it.desc}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
