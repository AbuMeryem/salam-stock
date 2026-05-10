"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ArrowRight,
  ClipboardList,
  PackageSearch,
  Repeat2,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";
import { useV2 } from "@/lib/v2-store";
import { V2Shell } from "@/components/v2/V2Shell";

const ACTIONS = [
  {
    href: "/v2/reception",
    title: "Nouvelle réception",
    desc: "Scan carton/unité, photo, validation",
    icon: ArrowDownToLine,
    accent: "primary",
  },
  {
    href: "/v2/sortie",
    title: "Déclarer une sortie",
    desc: "Casse, périmé, défaut, photo + IA",
    icon: ArrowUpRight,
    accent: "danger",
  },
  {
    href: "/v2/transfert",
    title: "Transfert inter-dépôt",
    desc: "Bouger du stock entre dépôts",
    icon: Repeat2,
    accent: "gold",
  },
  {
    href: "/v2/stock",
    title: "Voir le stock",
    desc: "Catalogue produits du dépôt",
    icon: PackageSearch,
    accent: "neutral",
  },
] as const;

const ADMIN_ACTIONS = [
  {
    href: "/v2/preparation",
    title: "Préparation Drive",
    desc: "Commandes en attente",
    icon: ShoppingBag,
  },
  {
    href: "/v2/inventaire",
    title: "Inventaire tournant",
    desc: "5-10 produits du jour",
    icon: ClipboardList,
  },
  {
    href: "/v2/etiquettes",
    title: "Imprimer étiquettes",
    desc: "EAN-13 internes Brother QL-820",
    icon: Tag,
  },
  {
    href: "/v2/admin",
    title: "Dashboard global",
    desc: "Vue 3 dépôts + alertes IA",
    icon: Sparkles,
  },
] as const;

const accentClass = {
  primary: "bg-primary text-white",
  gold: "bg-gold text-primary-dark",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-cream text-primary",
};

export default function V2HomePage() {
  const employe = useV2((s) => s.currentEmploye);
  const depot = useV2((s) => s.currentDepot);
  const isManager = employe?.role === "manager" || employe?.role === "admin";

  return (
    <V2Shell>
      <header className="px-5 pt-6">
        <p className="label-caps text-primary">
          {depot ? `Dépôt actif · ${depot.nom}` : "Dépôt non sélectionné"}
        </p>
        <h1 className="h1 text-text-primary mt-1">
          Bonjour {employe?.prenom ?? employe?.nom} 👋
        </h1>
        <p className="body-md text-text-secondary mt-1.5">
          Choisis une action pour commencer ta journée.
        </p>
      </header>

      <section className="px-5 mt-6 grid grid-cols-1 gap-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="bg-white rounded-2xl shadow-card border border-rule p-4 flex items-center gap-4 active:scale-[0.99] transition-transform"
            >
              <span
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accentClass[a.accent]}`}
              >
                <Icon className="w-5 h-5" strokeWidth={2.2} />
              </span>
              <div className="flex-1">
                <p className="text-base font-bold text-text-primary">
                  {a.title}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{a.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-tertiary" />
            </Link>
          );
        })}
      </section>

      {isManager && (
        <section className="px-5 mt-8">
          <p className="label-caps text-primary mb-3">Espace manager</p>
          <div className="grid grid-cols-2 gap-3">
            {ADMIN_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="bg-white rounded-2xl shadow-card border border-rule p-4 active:scale-[0.99] transition-transform"
                >
                  <span className="inline-flex w-10 h-10 rounded-xl bg-cream items-center justify-center text-primary mb-2">
                    <Icon className="w-4 h-4" />
                  </span>
                  <p className="text-sm font-bold text-text-primary leading-tight">
                    {a.title}
                  </p>
                  <p className="text-[11px] text-text-tertiary mt-1 line-clamp-2">
                    {a.desc}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-center text-[11px] text-text-tertiary mt-10">
        Salam Stock V2 · multi-dépôts
      </p>
    </V2Shell>
  );
}
