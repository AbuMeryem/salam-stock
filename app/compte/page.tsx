"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellRing,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  ScrollText,
  Settings2,
  Sparkles,
  UserCircle2,
  Boxes,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Avatar } from "@/components/shared/Avatar";

const persoItems = [
  { label: "Accueil", href: "/dashboard", icon: Home },
  { label: "Mon compte", href: "/compte", icon: UserCircle2 },
  { label: "Mes notifications", href: "/alertes", icon: BellRing },
];

export default function ComptePage() {
  const router = useRouter();
  const user = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);

  if (!user) return null;

  const isManager = user.role !== "employe";

  const proItems = [
    { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, show: isManager },
    { label: "Réception fournisseurs", href: "/reception", icon: PackageCheck, show: true },
    { label: "Inventaire tournant", href: "/inventaire", icon: ClipboardList, show: true },
    { label: "Catalogue produits", href: "/catalogue", icon: Boxes, show: true },
    { label: "Centre d'alertes", href: "/alertes", icon: BellRing, show: true },
    { label: "Assistant IA", href: "/assistant", icon: Sparkles, show: true },
    { label: "Réglages admin", href: "/compte", icon: Settings2, show: user.role === "directeur" },
  ];

  return (
    <PageWrapper>
      <PageHeader label="ESPACE" title="Mon compte" subtitle="Gérez votre profil et vos préférences" />

      <div className="px-5 mt-4">
        <div className="bg-white rounded-[24px] shadow-card p-5 flex items-center gap-4">
          <Avatar initials={user.initials} size="lg" online />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-text-primary truncate">{user.name}</p>
            <p className="text-sm text-text-secondary truncate">{user.email}</p>
            <span className="badge badge-gold mt-2 inline-flex">
              {user.role === "directeur"
                ? "Directeur"
                : user.role === "manager"
                ? "Manager"
                : "Employé"}
            </span>
          </div>
        </div>
      </div>

      <section className="px-5 mt-7">
        <h2 className="label-caps-md text-primary mb-3">PERSONNEL</h2>
        <div className="bg-white rounded-[20px] shadow-card divide-y divide-line-light overflow-hidden">
          {persoItems.map((it) => (
            <Link
              key={it.label}
              href={it.href}
              className="flex items-center gap-3 px-4 py-3.5 active:bg-cream/60"
            >
              <span className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center text-primary">
                <it.icon className="w-4 h-4" />
              </span>
              <span className="flex-1 text-sm font-semibold text-text-primary">
                {it.label}
              </span>
              <ChevronRight className="w-4 h-4 text-text-tertiary" />
            </Link>
          ))}
        </div>
      </section>

      <section className="px-5 mt-7">
        <h2 className="label-caps-md text-primary mb-3">ESPACE PRO</h2>
        <div className="bg-white rounded-[20px] shadow-card divide-y divide-line-light overflow-hidden">
          {proItems
            .filter((i) => i.show)
            .map((it) => (
              <Link
                key={it.label}
                href={it.href}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-cream/60"
              >
                <span className="w-9 h-9 rounded-xl bg-gold-soft flex items-center justify-center text-[#8B6F0E]">
                  <it.icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-text-primary">
                  {it.label}
                </span>
                <ChevronRight className="w-4 h-4 text-text-tertiary" />
              </Link>
            ))}
        </div>
      </section>

      <section className="px-5 mt-7">
        <Link
          href="/reception/historique"
          className="flex items-center gap-3 bg-white rounded-[20px] shadow-card px-4 py-3.5"
        >
          <span className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center text-primary">
            <ScrollText className="w-4 h-4" />
          </span>
          <span className="flex-1 text-sm font-semibold text-text-primary">
            Historique des réceptions
          </span>
          <ChevronRight className="w-4 h-4 text-text-tertiary" />
        </Link>
      </section>

      <section className="px-5 mt-7 mb-4">
        <button
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="w-full flex items-center gap-3 bg-white rounded-[20px] shadow-card px-4 py-3.5 text-danger"
        >
          <span className="w-9 h-9 rounded-xl bg-danger-soft flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </span>
          <span className="flex-1 text-left text-sm font-bold">Se déconnecter</span>
          <ChevronRight className="w-4 h-4 text-danger/60" />
        </button>
      </section>

      <p className="px-5 text-center text-[11px] text-text-tertiary mt-2 pb-2">
        Salam Stock · Démonstration v0.1 · à connecter à Odoo en V2
      </p>
    </PageWrapper>
  );
}
