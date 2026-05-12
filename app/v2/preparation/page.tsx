"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
} from "lucide-react";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { PriceTag } from "@/components/v2/PriceTag";
import { ClientTypeBadgeGroup, type ClientType } from "@/components/v2/ClientTypeBadge";
import { listCommandesDrive, listLignesPourCommande, listDepots } from "@/lib/db";
import type {
  CommandeDrive,
  CommandeDriveLigne,
  Depot,
  ZonePreparationDrive,
} from "@/lib/types/db";

interface CommandeWithLignes extends CommandeDrive {
  lignes: CommandeDriveLigne[];
}

type ZonePrep = ZonePreparationDrive;
const ZONE_LABEL: Record<ZonePrep, string> = {
  particulier: "Particulier",
  professionnel: "Pro",
  traiteur: "Traiteur",
};
const ZONE_EMOJI: Record<ZonePrep, string> = {
  particulier: "🛒",
  professionnel: "🏢",
  traiteur: "🍽️",
};

export default function V2PreparationPage() {
  const router = useRouter();
  const [commandes, setCommandes] = useState<CommandeWithLignes[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      listCommandesDrive("en_preparation"),
      listDepots(),
    ]).then(async ([cmds, deps]) => {
      const enriched = await Promise.all(
        cmds.map(async (c) => ({
          ...c,
          lignes: await listLignesPourCommande(c.id),
        }))
      );
      setCommandes(enriched);
      setDepots(deps);
      setLoading(false);
    });
  }, []);

  return (
    <V2Shell>
      <PageAccentStripe accent="sapin-or" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Préparation drive</p>
        <h1 className="h1 text-text-primary mt-1">
          {commandes.length} commande{commandes.length > 1 ? "s" : ""} à préparer
        </h1>
      </header>

      <section className="px-5 mt-6 space-y-3">
        {loading ? (
          <p className="text-center text-text-secondary py-8">Chargement…</p>
        ) : commandes.length === 0 ? (
          <div className="bg-cream border border-rule rounded-2xl p-6 text-center text-sm text-text-secondary">
            Aucune commande en attente.
          </div>
        ) : (
          commandes.map((cmd) => {
            const byZone = new Map<string, CommandeDriveLigne[]>();
            cmd.lignes.forEach((l) => {
              const z = l.zone_preparation ?? "particulier";
              const existing = byZone.get(z) ?? [];
              existing.push(l);
              byZone.set(z, existing);
            });
            const totalLignes = cmd.lignes.length;
            const prepares = cmd.lignes.filter(
              (l) => l.statut_preparation === "prepare"
            ).length;
            return (
              <Link
                key={cmd.id}
                href={`/v2/preparation/${cmd.id}`}
                className="block bg-white border border-rule rounded-2xl p-4 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-text-primary">
                      {cmd.numero_commande}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {cmd.client_nom}
                    </p>
                  </div>
                  <span className="badge badge-warning inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatHeure(cmd.creneau_retrait)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-text-tertiary flex-wrap">
                  <ClientTypeBadgeGroup
                    size="sm"
                    types={Array.from(byZone.keys()).map((z) => {
                      // Mapping zone_preparation → client_type
                      if (z === "professionnel") return "pro" as ClientType;
                      if (z === "traiteur") return "traiteur" as ClientType;
                      return "particulier" as ClientType;
                    })}
                  />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule">
                  <p className="text-xs text-text-secondary inline-flex items-center gap-1">
                    {prepares}/{totalLignes} préparés
                    <PriceTag amount={cmd.total_ttc} decimals={0} className="ml-1" fallback={null} />
                  </p>
                  <span className="text-primary inline-flex items-center gap-1 text-sm font-bold">
                    {prepares === 0 ? "Démarrer" : "Continuer"}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </V2Shell>
  );
}

function formatHeure(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
