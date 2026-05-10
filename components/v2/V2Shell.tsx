"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ClipboardList,
  Home,
  LogOut,
  PackageSearch,
  Repeat2,
  ShoppingBag,
} from "lucide-react";
import { useV2 } from "@/lib/v2-store";
import { dataMode } from "@/lib/db";
import { DepotSwitcher } from "./DepotSwitcher";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/v2", icon: Home, exact: true },
  { label: "Réception", href: "/v2/reception", icon: ArrowDownToLine },
  { label: "Sortie", href: "/v2/sortie", icon: ArrowUpRight },
  { label: "Transfert", href: "/v2/transfert", icon: Repeat2 },
  { label: "Stock", href: "/v2/stock", icon: PackageSearch },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Préparation", href: "/v2/preparation", icon: ShoppingBag },
  { label: "Inventaire", href: "/v2/inventaire", icon: ClipboardList },
  { label: "Dashboard", href: "/v2/admin", icon: Home },
];

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

  useEffect(() => {
    setMode(dataMode());
  }, []);

  useEffect(() => {
    if (hydrated && !employe) router.replace("/v2/login");
  }, [hydrated, employe, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!employe) return null;

  const isAdmin = employe.role === "admin" || employe.role === "manager";
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-[460px] min-h-screen relative bg-cream">
        {/* HEADER */}
        <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur-md border-b border-rule">
          <div className="flex items-center justify-between gap-2 px-4 py-3 safe-top">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">🧪</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                  Salam Stock
                </p>
                <p className="text-[11px] text-text-tertiary truncate">
                  {employe.prenom} {employe.nom} · {employe.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DepotSwitcher />
              <button
                onClick={logout}
                className="w-9 h-9 rounded-full bg-white border border-rule flex items-center justify-center text-text-secondary"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
          className={`${className} ${hideNav ? "pb-10" : "pb-32"}`}
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

        {/* BOTTOM NAV */}
        {!hideNav && (
          <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe pointer-events-none">
            <div className="mx-auto max-w-[460px] px-3 pb-2 pointer-events-auto">
              <div className="bg-white/96 backdrop-blur-xl rounded-[24px] shadow-card-lg border border-rule px-2 py-2 flex items-center justify-between overflow-x-auto scrollbar-none">
                {items.map((it) => {
                  const Icon = it.icon;
                  const active = it.exact
                    ? pathname === it.href
                    : pathname.startsWith(it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className="relative flex flex-col items-center justify-center px-2 py-1.5 min-w-[58px]"
                    >
                      {active && (
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gold" />
                      )}
                      <Icon
                        className={`w-[20px] h-[20px] transition-colors ${
                          active ? "text-primary" : "text-text-tertiary"
                        }`}
                        strokeWidth={active ? 2.4 : 1.8}
                      />
                      <span
                        className={`text-[10px] font-semibold tracking-wide mt-0.5 transition-colors ${
                          active ? "text-primary" : "text-text-tertiary"
                        }`}
                      >
                        {it.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
