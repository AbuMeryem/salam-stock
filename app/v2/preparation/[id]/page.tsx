"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  Clock,
  PackageMinus,
  ScanBarcode,
  ShoppingBag,
  Snowflake,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import {
  findProduitByEan,
  listCommandesDrive,
  listDepots,
  listLignesPourCommande,
  listProduitsInDepot,
  setCommandeStatut,
  updateLignePreparation,
} from "@/lib/db";
import type {
  CommandeDrive,
  CommandeDriveLigne,
  Depot,
  Produit,
} from "@/lib/types/db";

interface EnrichedLigne extends CommandeDriveLigne {
  produit?: Produit;
}

const COLD_CATEGORIES = new Set(["Surgelés", "Frais", "Boucherie", "Charcuterie"]);

const ZONE_LABEL: Record<"particulier" | "professionnel" | "traiteur", string> = {
  particulier: "Zone Particulier",
  professionnel: "Zone Professionnel",
  traiteur: "Zone Traiteur",
};

const ZONE_EMOJI: Record<"particulier" | "professionnel" | "traiteur", string> = {
  particulier: "🛒",
  professionnel: "🏢",
  traiteur: "🍽️",
};

export default function V2PreparationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employe = useV2((s) => s.currentEmploye);

  const [commande, setCommande] = useState<CommandeDrive | null>(null);
  const [lignes, setLignes] = useState<EnrichedLigne[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [missingPhotoFor, setMissingPhotoFor] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    void load(params.id);
  }, [params?.id]);

  async function load(id: string) {
    const [cmds, deps] = await Promise.all([listCommandesDrive(), listDepots()]);
    const cmd = cmds.find((c) => c.id === id) ?? null;
    setCommande(cmd);
    setDepots(deps);
    if (!cmd) return;
    const ls = await listLignesPourCommande(id);
    // Enrich with produits + sort: cold first, then by depot
    const allByDepot = new Map<string, Awaited<ReturnType<typeof listProduitsInDepot>>>();
    const depotIds = Array.from(new Set(ls.map((l) => l.depot_id)));
    for (const dId of depotIds) {
      allByDepot.set(dId, await listProduitsInDepot(dId));
    }
    const enriched: EnrichedLigne[] = ls.map((l) => {
      const stock = allByDepot.get(l.depot_id) ?? [];
      const p = stock.find((x) => x.id === l.produit_id);
      return { ...l, produit: p };
    });
    setLignes(enriched);
  }

  /** Group by zone_preparation (particulier / professionnel / traiteur),
   *  cold-chain products first within each zone. */
  const groupedByZone = useMemo(() => {
    const order: Array<"particulier" | "professionnel" | "traiteur"> = [
      "particulier",
      "professionnel",
      "traiteur",
    ];
    const buckets = new Map<string, EnrichedLigne[]>();
    for (const l of lignes) {
      const zone = l.zone_preparation ?? "particulier";
      const list = buckets.get(zone) ?? [];
      list.push(l);
      buckets.set(zone, list);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => {
        const aCold = COLD_CATEGORIES.has(a.produit?.categorie ?? "") ? 0 : 1;
        const bCold = COLD_CATEGORIES.has(b.produit?.categorie ?? "") ? 0 : 1;
        return aCold - bCold;
      });
    }
    return order
      .map((z) => ({ zone: z, items: buckets.get(z) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [lignes]);

  const handleScanRef = useRef<((c: string) => void) | undefined>(undefined);
  const handleScan = async (code: string) => {
    setScannerOpen(false);
    const p = await findProduitByEan(code);
    if (!p) {
      toast.error("Code inconnu");
      return;
    }
    const ligne = lignes.find(
      (l) => l.produit_id === p.id && l.statut_preparation === "en_attente"
    );
    if (!ligne) {
      toast.warning(`${p.nom} n'est pas (ou plus) à préparer pour cette commande.`);
      return;
    }
    if (!employe) return;
    await updateLignePreparation(ligne.id, {
      statut_preparation: "prepare",
      prepare_par_employe_id: employe.id,
      prepare_at: new Date().toISOString(),
    });
    setLignes((prev) =>
      prev.map((l) =>
        l.id === ligne.id
          ? {
              ...l,
              statut_preparation: "prepare",
              prepare_par_employe_id: employe.id,
              prepare_at: new Date().toISOString(),
            }
          : l
      )
    );
    toast.success(`${p.nom} préparé`);
  };
  handleScanRef.current = handleScan;

  async function markMissing(ligneId: string, photoUrl: string) {
    if (!employe) return;
    await updateLignePreparation(ligneId, {
      statut_preparation: "manquant",
      prepare_par_employe_id: employe.id,
      prepare_at: new Date().toISOString(),
    });
    setLignes((prev) =>
      prev.map((l) =>
        l.id === ligneId
          ? {
              ...l,
              statut_preparation: "manquant",
              prepare_par_employe_id: employe.id,
              prepare_at: new Date().toISOString(),
            }
          : l
      )
    );
    toast.warning("Marqué manquant. Photo de l'étagère enregistrée.");
    void photoUrl;
  }

  async function finalize() {
    if (!commande) return;
    const remaining = lignes.filter((l) => l.statut_preparation === "en_attente");
    if (remaining.length > 0) {
      toast.error(`${remaining.length} ligne(s) encore en attente`);
      return;
    }
    await setCommandeStatut(commande.id, "pret");
    await fetch("/api/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "commande_prete",
        payload: {
          commande: commande.numero_commande,
          client: commande.client_nom,
          telephone: commande.client_telephone,
        },
      }),
    });
    toast.success(`Commande ${commande.numero_commande} prête. Client notifié.`);
    router.replace("/v2/preparation");
  }

  const totalCount = lignes.length;
  const prepCount = lignes.filter((l) => l.statut_preparation !== "en_attente").length;

  if (!commande) {
    return (
      <V2Shell hideNav>
        <div className="px-5 pt-10 text-center text-text-secondary">
          Commande introuvable.
        </div>
      </V2Shell>
    );
  }

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Préparation</p>
        <h1 className="h1 text-text-primary mt-1">
          {commande.numero_commande}
        </h1>
        <p className="body-md text-text-secondary mt-1">
          {commande.client_nom} · retrait à {formatHeure(commande.creneau_retrait)}
        </p>
      </header>

      <section className="px-5 mt-4">
        <button
          onClick={() => setScannerOpen(true)}
          className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-center gap-2"
        >
          <ScanBarcode className="w-5 h-5" />
          <span className="font-bold">Scanner le produit collecté</span>
        </button>
      </section>

      <section className="px-5 mt-5 space-y-4 pb-cta-only">
        {groupedByZone.map((group) => (
          <div key={group.zone}>
            <p className="label-caps text-text-tertiary mb-2 inline-flex items-center gap-1">
              <span aria-hidden>{ZONE_EMOJI[group.zone]}</span>
              {ZONE_LABEL[group.zone]} · {group.items.length} produit
              {group.items.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {group.items.map((l, i) => {
                const cold = COLD_CATEGORIES.has(l.produit?.categorie ?? "");
                const done = l.statut_preparation !== "en_attente";
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-white border rounded-2xl p-3 flex items-center gap-3 ${
                      done ? "opacity-60 border-rule" : "border-rule"
                    }`}
                  >
                    <ProductThumbnail
                      nom={l.produit?.nom ?? "?"}
                      categorie={l.produit?.categorie}
                      size={48}
                      rounded="xl"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${done ? "line-through" : ""}`}>
                        {l.produit?.nom ?? "Produit"}
                      </p>
                      <p className="text-[11px] text-text-tertiary inline-flex items-center gap-1">
                        Qté {l.quantite}
                        {cold && (
                          <span className="inline-flex items-center gap-0.5 text-blue-600 ml-1">
                            <Snowflake className="w-3 h-3" />
                            Frais
                          </span>
                        )}
                      </p>
                    </div>
                    {l.statut_preparation === "prepare" && (
                      <span className="text-success">
                        <Check className="w-5 h-5" />
                      </span>
                    )}
                    {l.statut_preparation === "manquant" && (
                      <span className="badge badge-danger text-[10px]">Manquant</span>
                    )}
                    {l.statut_preparation === "en_attente" && (
                      <button
                        onClick={() => setMissingPhotoFor(l.id)}
                        className="text-xs font-bold text-danger px-2 py-1.5 rounded-lg bg-danger-soft inline-flex items-center gap-1"
                      >
                        <PackageMinus className="w-3 h-3" />
                        Manquant
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
          <button
            onClick={finalize}
            disabled={prepCount < totalCount}
            className="w-full bg-primary text-white rounded-[22px] px-5 py-4 flex items-center justify-between shadow-card-lg disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold">
                Marquer prêt
              </p>
              <p className="text-[15px] font-extrabold mt-0.5">
                {prepCount}/{totalCount} préparés
              </p>
            </div>
            <span className="bg-white/15 backdrop-blur-sm rounded-full p-2.5">
              <ShoppingBag className="w-5 h-5" />
            </span>
          </button>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(c) => handleScanRef.current?.(c)}
      />
      <PhotoCapture
        open={!!missingPhotoFor}
        onClose={() => setMissingPhotoFor(null)}
        onCapture={(photo) => {
          if (missingPhotoFor) {
            void markMissing(missingPhotoFor, photo);
            setMissingPhotoFor(null);
          }
        }}
      />
    </V2Shell>
  );
}

function formatHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
