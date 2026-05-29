"use client";

/**
 * Layout staff — garde d'accès aux pages /staff/*
 *
 * Le repo salam-stock n'utilise pas (encore) Supabase Auth : la session
 * est gérée par le store Zustand `useStore` (cf. lib/store.ts). On garde
 * donc la cohérence en faisant le check côté client. Quand Supabase Auth
 * sera branché, ce layout sera converti en server component avec
 * `supabase-server.ts` + `profiles.role`.
 *
 * Mapping rôle local → rôle staff attendu par l'API /api/stripe/* :
 *   directeur → admin
 *   manager   → manager
 *   employe   → employee
 */
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, PackageCheck, ScanLine } from "lucide-react";
import { useStore } from "@/lib/store";
import { FullPageLoader } from "@/components/shared/LoadingSpinner";

const ALLOWED_ROLES = new Set(["directeur", "manager", "employe"] as const);

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hasHydrated);
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    if (!ALLOWED_ROLES.has(currentUser.role)) {
      router.replace("/");
    }
  }, [hydrated, currentUser, router]);

  if (!hydrated || !currentUser) return <FullPageLoader />;
  if (!ALLOWED_ROLES.has(currentUser.role)) return <FullPageLoader />;

  return (
    <div className="min-h-screen bg-[#FAF7EE]">
      <header className="sticky top-0 z-30 border-b border-[#E8E4D8] bg-[#FAF7EE]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0E3B2E] text-white">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Salam Drive · Staff
              </p>
              <p className="text-sm font-bold text-[#0F1A14]">
                Préparation commandes
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/staff/preparation"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname?.startsWith("/staff/preparation")
                  ? "bg-[#F4E9C4] text-[#0E3B2E]"
                  : "text-[#6B7280] hover:bg-[#F4E9C4]/50"
              }`}
            >
              <PackageCheck className="mr-1 inline h-4 w-4" />
              Préparation
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[#0F1A14]">
                {currentUser.name}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">
                {currentUser.role}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-lg border border-[#E8E4D8] bg-white p-2 text-[#6B7280] hover:bg-[#FAF7EE] hover:text-[#0F1A14]"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
