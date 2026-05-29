"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Lock,
  PackageCheck,
  PlayCircle,
  Scale,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { PriceTag } from "@/components/v2/PriceTag";
import {
  ClientTypeBadgeGroup,
  type ClientType,
} from "@/components/v2/ClientTypeBadge";
import {
  listCommandesDrive,
  listLignesPourCommandeAvecUnitType,
  setCommandeStatut,
  type CommandeDriveLigneWithUnitType,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
  CommandeDrive,
  ZonePreparationDrive,
} from "@/lib/types/db";

interface CommandeWithLignes extends CommandeDrive {
  lignes: CommandeDriveLigneWithUnitType[];
}

type KanbanStatut = "a_preparer" | "en_preparation" | "pret" | "retire";
type ViewMode = "kanban" | "batch";

/* ── Batch Pick helpers ─────────────────────────────────────────────── */

interface BatchProduct {
  produit_id: string;
  nom: string;
  categorie: string;
  totalQty: number;
  unit: string; // "kg" or "pcs"
  orderCount: number;
  orders: { numero_commande: string; quantite: number }[];
}

interface BatchCategory {
  categorie: string;
  emoji: string;
  products: BatchProduct[];
  orderCount: number; // unique orders in this category
}

const CATEGORY_EMOJI: Record<string, string> = {
  Boucherie: "\u{1F969}",   // 🥩
  Charcuterie: "\u{1F356}", // 🍖
  "Surgelés": "\u{1F9CA}",  // 🧊
  Frais: "\u{2744}\u{FE0F}",// ❄️
  "Épicerie": "\u{1F6D2}",  // 🛒
  Epicerie: "\u{1F6D2}",    // 🛒
  Boissons: "\u{1F95B}",    // 🥛
  "Fruits & Légumes": "\u{1F966}", // 🥦
};

/** Cold-chain first ordering for batch pick. */
const CATEGORY_ORDER: string[] = [
  "Surgelés",
  "Frais",
  "Boucherie",
  "Charcuterie",
];

function getCategoryEmoji(cat: string): string {
  return CATEGORY_EMOJI[cat] ?? "\u{1F4E6}"; // 📦
}

function buildBatchCategories(
  commandes: CommandeWithLignes[],
): BatchCategory[] {
  const aPreparer = commandes.filter((c) => c.statut === "a_preparer");
  const productMap = new Map<string, BatchProduct>();

  for (const cmd of aPreparer) {
    for (const l of cmd.lignes) {
      const key = l.produit_id;
      const existing = productMap.get(key);
      const isWeight =
        l.produit_unit_type === "weight" ||
        l.produit_unit_type === "weight_bracket";
      if (existing) {
        existing.totalQty += l.quantite;
        existing.orderCount += 1;
        existing.orders.push({
          numero_commande: cmd.numero_commande,
          quantite: l.quantite,
        });
      } else {
        productMap.set(key, {
          produit_id: key,
          nom: l.produit_nom ?? key,
          categorie: l.produit_categorie ?? "Autre",
          totalQty: l.quantite,
          unit: isWeight ? "kg" : "pcs",
          orderCount: 1,
          orders: [
            {
              numero_commande: cmd.numero_commande,
              quantite: l.quantite,
            },
          ],
        });
      }
    }
  }

  // Group by category
  const catMap = new Map<string, BatchProduct[]>();
  for (const p of productMap.values()) {
    const cat = p.categorie;
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(p);
  }

  // Sort products alphabetically within each category
  for (const list of catMap.values()) {
    list.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }

  // Build category list and sort: cold chain first, then alphabetical
  const categories: BatchCategory[] = [];
  for (const [cat, products] of catMap.entries()) {
    const uniqueOrders = new Set(
      products.flatMap((p) => p.orders.map((o) => o.numero_commande)),
    );
    categories.push({
      categorie: cat,
      emoji: getCategoryEmoji(cat),
      products,
      orderCount: uniqueOrders.size,
    });
  }

  categories.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.categorie);
    const bi = CATEGORY_ORDER.indexOf(b.categorie);
    const aIdx = ai >= 0 ? ai : CATEGORY_ORDER.length;
    const bIdx = bi >= 0 ? bi : CATEGORY_ORDER.length;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.categorie.localeCompare(b.categorie, "fr");
  });

  return categories;
}

const COLUMNS: Array<{
  key: KanbanStatut;
  label: string;
  next: KanbanStatut | null;
  nextLabel: string | null;
  accent: string;
  textAccent: string;
}> = [
  {
    key: "a_preparer",
    label: "À préparer",
    next: "en_preparation",
    nextLabel: "Accepter la commande",
    accent: "bg-danger-soft border-danger/30",
    textAccent: "text-danger",
  },
  {
    key: "en_preparation",
    label: "En préparation",
    next: "pret",
    nextLabel: "Marquer prête",
    accent: "bg-warning-soft border-warning/30",
    textAccent: "text-warning",
  },
  {
    key: "pret",
    label: "Prêtes au retrait",
    next: "retire",
    nextLabel: "Marquer retirée",
    accent: "bg-gold-soft border-gold/30",
    textAccent: "text-primary-dark",
  },
  {
    key: "retire",
    label: "Retirées",
    next: null,
    nextLabel: null,
    accent: "bg-success-soft border-success/20",
    textAccent: "text-success",
  },
];

function clientTypeFromZone(z: ZonePreparationDrive | string): ClientType {
  if (z === "professionnel") return "pro";
  if (z === "traiteur") return "traiteur";
  return "particulier";
}

function formatHeure(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export default function V2PreparationKanbanPage() {
  const [commandes, setCommandes] = useState<CommandeWithLignes[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFor, setActionFor] = useState<CommandeWithLignes | null>(null);
  const [updating, setUpdating] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [pickedProducts, setPickedProducts] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(),
  );

  async function reload() {
    // NOTE : /api/sync/drive-pull existe pour syncer les orders du
    // projet Supabase Drive vers Stock, mais nécessite la service-role
    // du projet Drive (RLS bloque l'anon). Tant que cette clé n'est pas
    // configurée en env Vercel (DRIVE_SUPABASE_SERVICE_ROLE_KEY), on ne
    // l'appelle pas — ça reviendrait à un round-trip réseau sans effet.
    if (process.env.NEXT_PUBLIC_HAS_DRIVE_SYNC === "1") {
      try {
        await fetch("/api/sync/drive-pull", { method: "POST" });
      } catch {
        /* échec sync → on continue avec ce qui est déjà en local */
      }
    }

    const cmds = await listCommandesDrive();
    const enriched = await Promise.all(
      cmds.map(async (c) => ({
        ...c,
        lignes: await listLignesPourCommandeAvecUnitType(c.id),
      }))
    );
    // Filtres :
    //  - statut != 'annule' (commande annulée par client ou admin)
    //  - statut_paiement != 'echec' (paiement Stripe a échoué — la
    //    commande existe en DB mais ne doit pas apparaître au préparateur)
    //  - les commandes legacy avec statut_paiement = null restent
    //    visibles (paiement en magasin, Checkout hosted classique,
    //    pas de Drive au poids)
    setCommandes(
      enriched.filter(
        (c) => c.statut !== "annule" && c.statut_paiement !== "echec",
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    void reload();
    // Realtime : suivre les changements de statut/lignes en live.
    // Si Realtime indispo (mode local), fallback polling 12s.
    const sb = supabase();
    if (!sb) {
      const t = setInterval(() => void reload(), 12_000);
      return () => clearInterval(t);
    }
    const ch = sb
      .channel("kanban-drive")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes_drive" },
        () => {
          void reload();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes_drive_lignes" },
        () => {
          void reload();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setIsLive(true);
      });
    return () => {
      ch.unsubscribe();
    };
  }, []);

  const byColumn = useMemo(() => {
    const map = new Map<KanbanStatut, CommandeWithLignes[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const c of commandes) {
      if (
        c.statut === "a_preparer" ||
        c.statut === "en_preparation" ||
        c.statut === "pret" ||
        c.statut === "retire"
      ) {
        map.get(c.statut)!.push(c);
      }
    }
    // Sort each column by créneau ascendant
    for (const list of map.values()) {
      list.sort((a, b) => a.creneau_retrait.localeCompare(b.creneau_retrait));
    }
    return map;
  }, [commandes]);

  const batchCategories = useMemo(
    () => buildBatchCategories(commandes),
    [commandes],
  );

  const totalBatchProducts = useMemo(
    () => batchCategories.reduce((s, c) => s + c.products.length, 0),
    [batchCategories],
  );

  const pickedCount = useMemo(() => {
    let count = 0;
    for (const cat of batchCategories) {
      for (const p of cat.products) {
        if (pickedProducts.has(p.produit_id)) count++;
      }
    }
    return count;
  }, [batchCategories, pickedProducts]);

  function togglePicked(produitId: string) {
    setPickedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(produitId)) next.delete(produitId);
      else next.add(produitId);
      return next;
    });
  }

  function toggleExpanded(produitId: string) {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(produitId)) next.delete(produitId);
      else next.add(produitId);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function advance(cmd: CommandeWithLignes, target: KanbanStatut) {
    setUpdating(true);
    try {
      await setCommandeStatut(cmd.id, target);
      // Send "commande prête" email — fire-and-forget
      if (target === "pret" && cmd.client_email) {
        fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: cmd.client_email,
            subject: "Votre commande Salamarket est prête !",
            html: buildCommandePreteEmail({
              id: cmd.id,
              numero_commande: cmd.numero_commande,
              client_nom: cmd.client_nom,
            }),
          }),
        }).catch(() => {});
      }
      const label =
        target === "en_preparation"
          ? "acceptée · en préparation"
          : target === "pret"
            ? "marquée prête"
            : "marquée retirée";
      toast.success(`${cmd.numero_commande} ${label}`, { duration: 1800 });
      setActionFor(null);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <V2Shell>
      <PageAccentStripe accent="sapin-or" />
      <header className="px-5 pt-7">
        <BackButton />
        <div className="flex items-end justify-between gap-3 mt-3">
          <div>
            <p className="label-caps text-primary">Préparation drive</p>
            <h1 className="h1 text-text-primary mt-1">
              Kanban des commandes
            </h1>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
              isLive
                ? "bg-success-soft text-success"
                : "bg-cream text-text-tertiary"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? "bg-success animate-pulse" : "bg-text-tertiary"
              }`}
            />
            {isLive ? "Temps réel" : "Polling 12s"}
          </span>
        </div>

        {/* View mode toggle */}
        <div className="mt-4 inline-flex rounded-full p-0.5 bg-[#FAF7EE] border border-[#E8E4D8]">
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              viewMode === "kanban"
                ? "bg-[#0E3B2E] text-white"
                : "bg-white text-[#0E3B2E] border border-[#E8E4D8]"
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode("batch")}
            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              viewMode === "batch"
                ? "bg-[#0E3B2E] text-white"
                : "bg-white text-[#0E3B2E] border border-[#E8E4D8]"
            }`}
          >
            Batch Pick
          </button>
        </div>
      </header>

      {loading ? (
        <p className="px-5 py-10 text-center text-text-secondary">Chargement…</p>
      ) : viewMode === "kanban" ? (
        /* ────────────────── KANBAN VIEW ────────────────── */
        <div className="px-5 mt-5 space-y-6 pb-12">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col.key) ?? [];
            return (
              <section key={col.key}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <p className={`label-caps ${col.textAccent}`}>{col.label}</p>
                  <span className="text-[12px] font-extrabold tabular text-text-primary">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div
                    className={`border rounded-2xl p-4 text-center text-[12px] text-text-tertiary ${col.accent}`}
                  >
                    Aucune commande dans cette colonne.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((cmd) => {
                      const totalLignes = cmd.lignes.length;
                      const prepares = cmd.lignes.filter(
                        (l) => l.statut_preparation === "prepare"
                      ).length;
                      const types = Array.from(
                        new Set(
                          cmd.lignes.map((l) =>
                            clientTypeFromZone(l.zone_preparation)
                          )
                        )
                      );
                      const isFinal = col.key === "retire";
                      // Drive au poids — badges Stripe + nb à peser
                      const nbAPeser = cmd.lignes.filter(
                        (l) =>
                          l.produit_unit_type === "weight" ||
                          l.produit_unit_type === "weight_bracket",
                      ).length;
                      const isPreAutorise = cmd.statut_paiement === "autorise";
                      const isCapture = cmd.statut_paiement === "capture";
                      return (
                        <motion.div
                          key={cmd.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                          className={`bg-white border rounded-2xl p-3.5 shadow-card ${col.accent.split(" ")[1]}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[14px] font-extrabold text-text-primary">
                                {cmd.numero_commande}
                              </p>
                              <p className="text-[11.5px] text-text-secondary truncate">
                                {cmd.client_nom}
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide bg-cream text-text-primary px-2 py-1 rounded-full`}
                            >
                              <Clock className="w-3 h-3" />
                              {formatHeure(cmd.creneau_retrait)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            <ClientTypeBadgeGroup size="sm" types={types} />
                            {nbAPeser > 0 && (
                              <span
                                title="Lignes au poids à peser"
                                className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide bg-gold-soft text-primary-dark px-2 py-0.5 rounded-full"
                              >
                                <Scale className="w-3 h-3" aria-hidden />
                                {nbAPeser} à peser
                              </span>
                            )}
                            <span className="text-[11px] text-text-secondary inline-flex items-center gap-1 ml-auto">
                              {prepares}/{totalLignes} préparés
                              {isPreAutorise ? (
                                <span
                                  title="Stripe pré-autorisé, capture après pesée"
                                  className="ml-1 inline-flex items-center gap-1 text-[10.5px] font-bold bg-cream text-primary px-2 py-0.5 rounded-full"
                                >
                                  <Lock className="w-3 h-3" aria-hidden />
                                  Pré-aut. {(cmd.montant_autorise_ttc ?? cmd.total_ttc).toFixed(0)} €
                                </span>
                              ) : isCapture ? (
                                <span
                                  title="Capture Stripe effectuée"
                                  className="ml-1 inline-flex items-center gap-1 text-[10.5px] font-bold bg-success-soft text-success px-2 py-0.5 rounded-full"
                                >
                                  <Check className="w-3 h-3" aria-hidden />
                                  Capt. {(cmd.montant_capture_ttc ?? cmd.total_ttc).toFixed(0)} €
                                </span>
                              ) : (
                                <PriceTag
                                  amount={cmd.total_ttc}
                                  decimals={0}
                                  className="ml-1"
                                />
                              )}
                            </span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Link
                              href={`/v2/preparation/${cmd.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold text-primary bg-cream rounded-full py-2 active:scale-[0.98] transition-transform"
                            >
                              Détail
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                            {!isFinal && (
                              <button
                                onClick={() => setActionFor(cmd)}
                                className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold text-white bg-primary rounded-full py-2 active:scale-[0.98] transition-transform"
                              >
                                Avancer
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        /* ────────────────── BATCH PICK VIEW ────────────────── */
        <div className="px-5 mt-5 pb-28">
          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[13px] font-bold text-[#0F1A14]">
                {pickedCount}/{totalBatchProducts} produits{" "}
                {totalBatchProducts > 0 ? "récupérés" : ""}
              </p>
              <p className="text-[11px] font-bold text-[#6B7280]">
                {totalBatchProducts > 0
                  ? `${Math.round(
                      (pickedCount / totalBatchProducts) * 100,
                    )}%`
                  : "0%"}
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-[#E8E4D8] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#C9A227]"
                initial={{ width: 0 }}
                animate={{
                  width:
                    totalBatchProducts > 0
                      ? `${(pickedCount / totalBatchProducts) * 100}%`
                      : "0%",
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>

          {batchCategories.length === 0 ? (
            <div className="border border-[#E8E4D8] rounded-2xl p-6 text-center text-[13px] text-[#6B7280] bg-[#FAF7EE]">
              Aucune commande en attente de préparation.
            </div>
          ) : (
            <div className="space-y-4">
              {batchCategories.map((cat) => {
                const isCollapsed = collapsedCategories.has(cat.categorie);
                return (
                  <section key={cat.categorie}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(cat.categorie)}
                      className="w-full flex items-center justify-between bg-[#FAF7EE] rounded-lg px-3.5 py-2.5 mb-2"
                    >
                      <span className="text-[13px] font-bold text-[#0F1A14]">
                        {cat.emoji} {cat.categorie} ({cat.products.length}{" "}
                        produit{cat.products.length > 1 ? "s" : ""},{" "}
                        {cat.orderCount} commande
                        {cat.orderCount > 1 ? "s" : ""})
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#6B7280] transition-transform ${
                          isCollapsed ? "-rotate-90" : ""
                        }`}
                      />
                    </button>

                    {/* Product rows */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2">
                            {cat.products.map((product) => {
                              const isPicked = pickedProducts.has(
                                product.produit_id,
                              );
                              const isExpanded = expandedProducts.has(
                                product.produit_id,
                              );
                              return (
                                <div
                                  key={product.produit_id}
                                  className={`bg-white rounded-lg border border-[#E8E4D8] transition-opacity ${
                                    isPicked ? "opacity-50" : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 p-3">
                                    {/* Checkbox */}
                                    <button
                                      onClick={() =>
                                        togglePicked(product.produit_id)
                                      }
                                      className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                        isPicked
                                          ? "bg-[#0E3B2E] border-[#0E3B2E]"
                                          : "border-[#E8E4D8] bg-white"
                                      }`}
                                    >
                                      {isPicked && (
                                        <Check className="w-3.5 h-3.5 text-white" />
                                      )}
                                    </button>

                                    {/* Product info — tap to expand */}
                                    <button
                                      onClick={() =>
                                        toggleExpanded(product.produit_id)
                                      }
                                      className="flex-1 min-w-0 text-left"
                                    >
                                      <p
                                        className={`text-[13px] font-bold text-[#0F1A14] ${
                                          isPicked ? "line-through" : ""
                                        }`}
                                      >
                                        {product.nom}
                                      </p>
                                    </button>

                                    {/* Quantity + orders badge */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span
                                        className={`text-[13px] font-bold tabular-nums text-[#0F1A14] ${
                                          isPicked ? "line-through" : ""
                                        }`}
                                      >
                                        {product.unit === "kg"
                                          ? `${product.totalQty.toFixed(
                                              product.totalQty % 1 === 0
                                                ? 0
                                                : 1,
                                            )} kg`
                                          : `${product.totalQty}`}
                                      </span>
                                      <span className="text-[10.5px] font-bold text-[#6B7280] bg-[#FAF7EE] px-2 py-0.5 rounded-full">
                                        {product.orderCount} cmd
                                        {product.orderCount > 1 ? "s" : ""}
                                      </span>
                                      <ChevronDown
                                        className={`w-3.5 h-3.5 text-[#6B7280] transition-transform ${
                                          isExpanded ? "" : "-rotate-90"
                                        }`}
                                      />
                                    </div>
                                  </div>

                                  {/* Per-order breakdown */}
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{
                                          height: 0,
                                          opacity: 0,
                                        }}
                                        animate={{
                                          height: "auto",
                                          opacity: 1,
                                        }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="px-3 pb-3 pt-0 border-t border-[#E8E4D8]">
                                          <div className="pt-2 space-y-1">
                                            {product.orders.map((o, i) => (
                                              <div
                                                key={i}
                                                className="flex items-center justify-between text-[12px] text-[#6B7280]"
                                              >
                                                <span className="font-medium">
                                                  {o.numero_commande}
                                                </span>
                                                <span className="tabular-nums">
                                                  {product.unit === "kg"
                                                    ? `${o.quantite.toFixed(
                                                        o.quantite % 1 === 0
                                                          ? 0
                                                          : 1,
                                                      )} kg`
                                                    : `${o.quantite}`}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                );
              })}
            </div>
          )}

          {/* Bottom CTA */}
          {totalBatchProducts > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-[#E8E4D8] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setViewMode("kanban")}
                className="w-full bg-[#0E3B2E] text-white rounded-full py-3.5 px-5 flex items-center justify-center gap-2 text-[14px] font-bold active:scale-[0.99] transition-transform"
              >
                Dispatcher par commande
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action sheet */}
      <AnimatePresence>
        {actionFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setActionFor(null)}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-8 shadow-card-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="label-caps text-text-tertiary">Commande</p>
                  <h2 className="text-[18px] font-extrabold text-text-primary mt-0.5">
                    {actionFor.numero_commande}
                  </h2>
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    {actionFor.client_nom}
                  </p>
                </div>
                <button onClick={() => setActionFor(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
              <div className="space-y-2 mt-4">
                {actionFor.statut === "a_preparer" && (
                  <button
                    onClick={() => void advance(actionFor, "en_preparation")}
                    disabled={updating}
                    className="w-full bg-primary text-white rounded-[18px] py-3.5 px-5 flex items-center justify-center gap-2 font-bold shadow-card active:scale-[0.99] disabled:opacity-50"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Accepter et commencer la préparation
                  </button>
                )}
                {actionFor.statut === "en_preparation" && (
                  <button
                    onClick={() => void advance(actionFor, "pret")}
                    disabled={updating}
                    className="w-full bg-gold-bright text-primary-dark rounded-[18px] py-3.5 px-5 flex items-center justify-center gap-2 font-bold shadow-card active:scale-[0.99] disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Marquer prête au retrait
                  </button>
                )}
                {actionFor.statut === "pret" && (
                  <button
                    onClick={() => void advance(actionFor, "retire")}
                    disabled={updating}
                    className="w-full bg-success text-white rounded-[18px] py-3.5 px-5 flex items-center justify-center gap-2 font-bold shadow-card active:scale-[0.99] disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marquer retirée par le client
                  </button>
                )}
                <Link
                  href={`/v2/preparation/${actionFor.id}`}
                  className="w-full bg-white border border-rule text-text-primary rounded-[18px] py-3 px-5 flex items-center justify-center gap-2 font-bold active:scale-[0.99] transition-transform"
                >
                  <PlayCircle className="w-4 h-4 text-primary" />
                  Ouvrir le détail
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </V2Shell>
  );
}

function buildCommandePreteEmail(commande: {
  id: string;
  numero_commande?: string | null;
  client_nom?: string | null;
}): string {
  const ref = commande.numero_commande || commande.id.slice(0, 8).toUpperCase();
  const greeting = commande.client_nom ? ` ${commande.client_nom}` : "";
  return `<div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background: linear-gradient(180deg, #0E3B2E 0%, #082A20 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #C9A227; font-size: 20px; margin: 0;">Salamarket Drive</h1>
  </div>
  <div style="background: #FAF7EE; padding: 24px; border-radius: 0 0 12px 12px;">
    <h2 style="color: #0E3B2E; font-size: 18px;">Votre commande est prête !</h2>
    <p style="color: #0F1A14; font-size: 14px; line-height: 1.6;">
      Bonjour${greeting},<br><br>
      Votre commande <strong>${ref}</strong> est prête à être retirée.
    </p>
    <div style="background: white; border: 1px solid #E8E4D8; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; font-size: 13px; color: #6B7280;">📍 Retrait au</p>
      <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #0E3B2E;">8 av. Larrieu-Thibaud, 31100 Toulouse</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #6B7280;">Lun-Sam 10h-19h30 · Dimanche 10h-18h</p>
    </div>
    <p style="color: #0F1A14; font-size: 14px;">À très vite !</p>
    <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">L'équipe Salamarket</p>
  </div>
</div>`;
}
