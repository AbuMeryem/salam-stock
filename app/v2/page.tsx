"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
    desc: "Scan carton, unité, photo, validation",
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
    href: "/v2/admin",
    title: "Dashboard global",
    desc: "Vue 3 dépôts, alertes IA",
    icon: Sparkles,
  },
  {
    href: "/v2/preparation",
    title: "Préparation drive",
    desc: "Commandes à préparer",
    icon: ShoppingBag,
  },
  {
    href: "/v2/inventaire",
    title: "Inventaire tournant",
    desc: "5 à 10 produits par jour",
    icon: ClipboardList,
  },
  {
    href: "/v2/etiquettes",
    title: "Imprimer étiquettes",
    desc: "EAN-13 Brother QL-820",
    icon: Tag,
  },
] as const;

/** C2-A — palette Salam strictement appliquée sur les cards principales. */
const accentClass: Record<string, string> = {
  // Nouvelle réception → sapin plein, icône blanche
  primary: "bg-[#0E3B2E] text-white",
  // Transfert inter-dépôt → or plein, icône blanche
  gold: "bg-[#C9A227] text-white",
  // Déclarer une sortie → rouge bordeaux plein, icône blanche
  danger: "bg-[#A8231A] text-white",
  // Voir le stock → sapin foncé, icône or
  neutral: "bg-[#0A2A20] text-[#C9A227]",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default function V2HomePage() {
  const employe = useV2((s) => s.currentEmploye);
  const depot = useV2((s) => s.currentDepot);
  const isManager = employe?.role === "manager" || employe?.role === "admin";

  const greet = greeting();
  const firstName = employe?.prenom ?? employe?.nom ?? "";

  return (
    <V2Shell>
      <header className="px-5 pt-7">
        <p className="section-eyebrow">
          {depot ? `Dépôt actif · ${depot.nom}` : "Dépôt non sélectionné"}
        </p>
        <h1 className="h1 text-text-primary mt-2">
          {greet} <span className="text-primary">{firstName}</span>
        </h1>
        <p className="body-md text-text-secondary mt-1.5">
          Choisis une action pour démarrer.
        </p>
      </header>

      <section className="px-5 mt-7 space-y-3">
        {ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.div
              key={a.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.22,
                ease: [0.22, 0.61, 0.36, 1],
                delay: i * 0.04,
              }}
            >
              <Link
                href={a.href}
                className="bg-white rounded-[20px] shadow-card border border-rule p-4 flex items-center gap-4 card-tappable focus-visible:outline-2 focus-visible:outline-primary block"
              >
                <span
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accentClass[a.accent]}`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-text-primary leading-tight">
                    {a.title}
                  </p>
                  <p className="text-[12.5px] text-text-secondary mt-1 leading-snug">
                    {a.desc}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-tertiary shrink-0" />
              </Link>
            </motion.div>
          );
        })}
      </section>

      {isManager && (
        <section className="px-5 mt-9">
          <p className="section-eyebrow mb-3">Espace manager</p>
          <div className="grid grid-cols-2 gap-3">
            {ADMIN_ACTIONS.map((a, i) => {
              const Icon = a.icon;
              const isAdmin = a.href === "/v2/admin";
              const isEtiquettes = a.href === "/v2/etiquettes";
              const isPrep = a.href === "/v2/preparation";
              const isInventaire = a.href === "/v2/inventaire";
              return (
                <motion.div
                  key={a.href}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    ease: [0.22, 0.61, 0.36, 1],
                    delay: 0.18 + i * 0.04,
                  }}
                >
                  <Link
                    href={a.href}
                    className={`relative rounded-[20px] shadow-card border p-4 card-tappable focus-visible:outline-2 focus-visible:outline-primary block h-full ${
                      isAdmin
                        ? "border-transparent text-white"
                        : "bg-white border-rule"
                    }`}
                    style={
                      isAdmin
                        ? {
                            background:
                              "linear-gradient(135deg, #0E3B2E 0%, #14523F 55%, #C9A227 130%)",
                          }
                        : undefined
                    }
                  >
                    <span
                      className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-3 ${
                        isAdmin
                          ? "bg-white/15 text-white backdrop-blur-sm"
                          : isEtiquettes
                            ? "bg-[#E0B83A] text-[#0E3B2E]"
                            : isPrep
                              ? "bg-[#C9A227] text-[#0E3B2E]"
                              : isInventaire
                                ? "bg-[#C9A227] text-[#0E3B2E]"
                                : "bg-cream text-primary"
                      }`}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.2} />
                    </span>
                    <p
                      className={`text-[14px] font-bold leading-tight ${
                        isAdmin ? "text-white" : "text-text-primary"
                      }`}
                    >
                      {a.title}
                    </p>
                    <p
                      className={`text-[11.5px] mt-1 leading-snug ${
                        isAdmin ? "text-white/85" : "text-text-tertiary"
                      }`}
                    >
                      {a.desc}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-center text-[11px] text-text-tertiary mt-12">
        Salam Stock V2 · multi-dépôts Toulouse
      </p>
    </V2Shell>
  );
}
