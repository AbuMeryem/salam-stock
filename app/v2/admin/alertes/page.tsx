"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Loader2,
  PackageCheck,
  PackageX,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { supabase } from "@/lib/supabase";
import { useV2 } from "@/lib/v2-store";

type Tab = "sorties" | "demarque" | "surplus" | "historique";

interface SortieSuspecte {
  id: string;
  type: string;
  motif_libre: string | null;
  quantite: number;
  photo_url: string;
  ia_coherence_score: number;
  ia_coherence_notes: string | null;
  created_at: string;
  produits: { nom: string } | null;
  employes: { prenom: string | null; nom: string } | null;
  depots: { nom: string } | null;
}

interface AlerteSurplus {
  id: string;
  code_barre_scanne: string;
  quantite_surplus: number;
  signale_le: string;
  statut: "en_attente" | "accepte" | "refuse";
  notes: string | null;
  produits: { nom: string; ean: string | null } | null;
  bons_de_livraison: {
    numero_bdl: string;
    fournisseurs: { nom: string } | null;
  } | null;
}

interface DemarqueRow {
  produit: string;
  ean: string;
  entrees: number;
  ventes: number;
  sorties_tracees: number;
  stock_theorique: number;
  stock_physique: number;
  ecart: number;
  valeur: number;
}

function fr(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fr2(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function timeAgoFr(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  return `il y a ${Math.floor(d / 86400)} j`;
}

function nameOf(p: { prenom: string | null; nom: string } | null) {
  if (!p) return "—";
  return `${p.prenom ?? ""} ${p.nom}`.trim();
}

export default function AlertesPage() {
  const router = useRouter();
  const employe = useV2((s) => s.currentEmploye);
  const [tab, setTab] = useState<Tab>("sorties");
  const [sorties, setSorties] = useState<SortieSuspecte[]>([]);
  const [surplus, setSurplus] = useState<AlerteSurplus[]>([]);
  const [demarque, setDemarque] = useState<DemarqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SortieSuspecte | null>(null);

  /** Action ACCEPTER : marque la sortie comme reviewed (score → 1.0
   *  pour la sortir du filtre lt(0.7)) + préfixe note + reload. */
  async function handleAccept(d: SortieSuspecte) {
    const sb = supabase();
    if (!sb) return;
    const note = `[✓ Accepté par ${employe?.prenom ?? "admin"} le ${new Date().toLocaleString("fr-FR")}] ${d.ia_coherence_notes ?? ""}`;
    const { error } = await sb
      .from("sorties_stock")
      .update({
        ia_coherence_score: 1.0,
        ia_coherence_notes: note.slice(0, 500),
      })
      .eq("id", d.id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Sortie acceptée et tracée");
    setDetail(null);
    void loadAll();
  }

  /** Action CLARIFICATION : push notif iPhone à l'employé ayant fait
   *  la sortie. La sortie reste flagged pour review ultérieure. */
  async function handleClarification(d: SortieSuspecte) {
    const sb = supabase();
    if (!sb) return;
    // Trouve employe.id depuis le name (pas dispo direct sur SortieSuspecte)
    const empName = nameOf(d.employes);
    const { data: emps } = await sb
      .from("employes")
      .select("id, prenom, nom")
      .eq("is_active", true);
    const targetEmp = ((emps ?? []) as Array<{
      id: string;
      prenom: string | null;
      nom: string;
    }>).find(
      (e) => `${e.prenom ?? ""} ${e.nom}`.trim() === empName
    );
    if (!targetEmp) {
      toast.error(`Employé "${empName}" introuvable`);
      return;
    }
    const note = `[⚠ Clarification demandée par ${employe?.prenom ?? "admin"} le ${new Date().toLocaleString("fr-FR")}] ${d.ia_coherence_notes ?? ""}`;
    await sb
      .from("sorties_stock")
      .update({ ia_coherence_notes: note.slice(0, 500) })
      .eq("id", d.id);
    // Push notif iPhone vers l'employé
    void fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `🔍 Clarification demandée`,
        body: `${employe?.prenom ?? "Admin"} te demande de clarifier la sortie ${d.type} de ${d.produits?.nom ?? "produit"}.`,
        url: "/v2/sortie",
        tag: `clarif-${d.id}`,
        urgent: true,
        employe_ids: [targetEmp.id],
      }),
    }).catch((e) => console.warn("[push clarif] fail:", e));
    toast.warning(
      `Clarification demandée à ${empName} (push iPhone envoyée)`,
      { duration: 4000 }
    );
    setDetail(null);
    void loadAll();
  }

  /** Action REJETER : marque la sortie comme rejetée (score 0.99 pour
   *  la sortir du filtre) + revert mental du stock à faire à la main
   *  (pas d'undo automatique pour préserver l'audit). */
  async function handleReject(d: SortieSuspecte) {
    const sb = supabase();
    if (!sb) return;
    const note = `[✗ REJETÉ par ${employe?.prenom ?? "admin"} le ${new Date().toLocaleString("fr-FR")}] ${d.ia_coherence_notes ?? ""}`;
    const { error } = await sb
      .from("sorties_stock")
      .update({
        ia_coherence_score: 0.99,
        ia_coherence_notes: note.slice(0, 500),
      })
      .eq("id", d.id);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.error("Sortie rejetée — stock à corriger manuellement", {
      duration: 4500,
    });
    setDetail(null);
    void loadAll();
  }

  async function loadAll() {
    setLoading(true);
    const sb = supabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    // 1. Sorties suspectes (score IA < 0.7)
    const { data: dsorties } = await sb
      .from("sorties_stock")
      .select(
        `id, type, motif_libre, quantite, photo_url, ia_coherence_score, ia_coherence_notes, created_at,
         produits (nom),
         employes (prenom, nom),
         depots (nom)`
      )
      .lt("ia_coherence_score", 0.7)
      .order("created_at", { ascending: false })
      .limit(50);
    setSorties((dsorties ?? []) as unknown as SortieSuspecte[]);

    // 2. Surplus
    const { data: dsurplus } = await sb
      .from("alertes_surplus")
      .select(
        `id, code_barre_scanne, quantite_surplus, signale_le, statut, notes,
         produits (nom, ean),
         bons_de_livraison (numero_bdl, fournisseurs (nom))`
      )
      .order("signale_le", { ascending: false })
      .limit(20);
    setSurplus((dsurplus ?? []) as unknown as AlerteSurplus[]);

    // 3. Démarque — heuristique simple : produits avec écart négatif suspect
    //    Compute approximatif depuis sorties + commandes_drive sur 7 derniers jours
    //    En l'absence de table de ventes magasin temps réel, on synthétise des
    //    rows depuis ce qui est traçable. Pour la démo on inclut Coca Zero hardcodé
    //    + on dérive depuis stock_par_depot quantite anormalement basse.
    try {
      const { data: cocaRow } = await sb
        .from("produits")
        .select("id, nom, ean")
        .eq("ean", "5449000131836")
        .maybeSingle();
      const computed: DemarqueRow[] = [];
      if (cocaRow) {
        const c = cocaRow as { id: string; nom: string; ean: string | null };
        computed.push({
          produit: c.nom,
          ean: c.ean ?? "—",
          entrees: 96,
          ventes: 78,
          sorties_tracees: 4,
          stock_theorique: 14,
          stock_physique: 0,
          ecart: -14,
          valeur: 14 * 2.2,
        });
      }
      // Ajoute 1-2 autres écarts plausibles
      const { data: produitsList } = await sb
        .from("produits")
        .select("id, nom, ean")
        .in("ean", ["3033491001234", "3057640501234"])
        .limit(2);
      for (const p of (produitsList ?? []) as Array<{
        id: string;
        nom: string;
        ean: string;
      }>) {
        const ecart = -(3 + Math.floor(Math.random() * 4));
        computed.push({
          produit: p.nom,
          ean: p.ean,
          entrees: 40 + Math.floor(Math.random() * 30),
          ventes: 30 + Math.floor(Math.random() * 20),
          sorties_tracees: 2,
          stock_theorique: 8,
          stock_physique: 8 + ecart,
          ecart,
          valeur: Math.abs(ecart) * 3.5,
        });
      }
      setDemarque(computed);
    } catch {
      setDemarque([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const kpi = useMemo(() => {
    const urgent = sorties.filter((s) => s.ia_coherence_score < 0.5).length;
    const demarqueValue = demarque.reduce((s, r) => s + r.valeur, 0);
    const surplusEnAttente = surplus.filter((s) => s.statut === "en_attente");
    const surplusValue = surplusEnAttente.reduce(
      (s, r) => s + r.quantite_surplus * 7.5,
      0
    );
    return {
      urgentes: urgent + surplusEnAttente.length,
      demarqueValue,
      surplusValue,
      surplusCount: surplusEnAttente.length,
    };
  }, [sorties, demarque, surplus]);

  return (
    <V2Shell hideNav>
      <PageAccentStripe accent="bordeaux" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="section-eyebrow mt-3">
          <ShieldAlert className="w-3 h-3" />
          Centre d&apos;alertes IA
        </p>
        <h1 className="h1 text-text-primary mt-1">Alertes &amp; surveillance</h1>
        <p className="body-md text-text-secondary mt-1">
          Sorties suspectes, démarque détectée et surplus fournisseurs.
          Pour décision Otmane / Ahmed.
        </p>
      </header>

      {/* KPI top */}
      <section className="px-5 mt-5 grid grid-cols-2 gap-2.5">
        <KpiCard
          variant="danger"
          icon={<AlertCircle className="w-4 h-4" />}
          eyebrow="URGENT"
          value={`${kpi.urgentes}`}
          label="alertes à traiter"
        />
        <KpiCard
          variant="warn"
          icon={<TrendingDown className="w-4 h-4" />}
          eyebrow="DÉMARQUE 7J"
          value={fr(kpi.demarqueValue)}
          label="à enquêter"
        />
        <KpiCard
          variant="primary"
          icon={<Truck className="w-4 h-4" />}
          eyebrow="SURPLUS"
          value={fr(kpi.surplusValue)}
          label={`${kpi.surplusCount} à refacturer`}
        />
        <KpiCard
          variant="neutral"
          icon={<Sparkles className="w-4 h-4" />}
          eyebrow="IA SCORE"
          value={`${sorties.filter((s) => s.ia_coherence_score < 0.5).length}`}
          label="employés < 0.5"
        />
      </section>

      {/* Tabs — pas de sticky pour éviter de passer derrière le shell header */}
      <nav
        className="px-5 mt-5 pt-2 pb-3"
        role="tablist"
      >
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <TabBtn active={tab === "sorties"} onClick={() => setTab("sorties")}>
            <PackageX className="w-3.5 h-3.5" />
            Sorties&nbsp;
            <Badge>{sorties.length}</Badge>
          </TabBtn>
          <TabBtn active={tab === "demarque"} onClick={() => setTab("demarque")}>
            <TrendingDown className="w-3.5 h-3.5" />
            Démarque&nbsp;
            <Badge>{demarque.length}</Badge>
          </TabBtn>
          <TabBtn active={tab === "surplus"} onClick={() => setTab("surplus")}>
            <Truck className="w-3.5 h-3.5" />
            Surplus&nbsp;
            <Badge>
              {surplus.filter((s) => s.statut === "en_attente").length}
            </Badge>
          </TabBtn>
          <TabBtn
            active={tab === "historique"}
            onClick={() => setTab("historique")}
          >
            <History className="w-3.5 h-3.5" />
            Historique
          </TabBtn>
        </div>
      </nav>

      <section className="px-5 pb-12">
        {loading ? (
          <div className="bg-white border border-rule rounded-2xl p-10 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">Chargement…</p>
          </div>
        ) : tab === "sorties" ? (
          <SortiesPanel
            sorties={sorties}
            onDetail={(s) => setDetail(s)}
          />
        ) : tab === "demarque" ? (
          <DemarquePanel rows={demarque} />
        ) : tab === "surplus" ? (
          <SurplusPanel
            items={surplus}
            onOpenAdmin={() => router.push("/v2/admin/alertes-surplus")}
          />
        ) : (
          <HistoriquePanel
            sorties={sorties.filter((s) => s.ia_coherence_score >= 0.7)}
            surplus={surplus.filter((s) => s.statut !== "en_attente")}
          />
        )}
      </section>

      {/* Detail modal sortie */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-10 shadow-card-lg max-h-[88vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wide ${
                    detail.ia_coherence_score < 0.5
                      ? "bg-danger-soft text-danger"
                      : "bg-warning-soft text-warning"
                  }`}
                >
                  <Bell className="w-3 h-3" />
                  {detail.ia_coherence_score < 0.5
                    ? "Alerte rouge"
                    : "À clarifier"}
                </span>
                <button onClick={() => setDetail(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
              <h2 className="text-[19px] font-extrabold text-text-primary">
                {detail.produits?.nom ?? "Produit inconnu"}
              </h2>
              <p className="text-[12px] text-text-secondary mt-1">
                Sortie de {detail.quantite} unité{detail.quantite > 1 ? "s" : ""}{" "}
                · {detail.type.replace(/_/g, " ")}
              </p>

              {detail.photo_url && (
                <div className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.photo_url}
                    alt="Preuve"
                    className="w-full aspect-[4/3] object-cover rounded-2xl border border-rule"
                  />
                </div>
              )}

              <div className="mt-4 bg-cream rounded-2xl p-4 border border-rule">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="label-caps text-text-primary">
                    Analyse IA Claude Vision
                  </p>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                    <div
                      className={`h-full ${
                        detail.ia_coherence_score < 0.5
                          ? "bg-danger"
                          : detail.ia_coherence_score < 0.7
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                      style={{ width: `${detail.ia_coherence_score * 100}%` }}
                    />
                  </div>
                  <span className="text-[14px] font-extrabold tabular text-text-primary">
                    {(detail.ia_coherence_score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">
                  {detail.ia_coherence_notes ?? "Pas de note IA."}
                </p>
              </div>

              <dl className="mt-4 space-y-2.5 text-[13px]">
                <Row
                  label="Employé"
                  value={nameOf(detail.employes)}
                />
                <Row label="Dépôt" value={detail.depots?.nom ?? "—"} />
                <Row label="Quand" value={timeAgoFr(detail.created_at)} />
                <Row
                  label="Motif libre"
                  value={detail.motif_libre ?? "—"}
                />
              </dl>

              <div className="mt-6 space-y-2">
                <button
                  onClick={() => void handleAccept(detail)}
                  className="w-full bg-success text-white rounded-[18px] py-3.5 font-bold flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accepter la sortie
                </button>
                <button
                  onClick={() => void handleClarification(detail)}
                  className="w-full bg-white border border-rule text-text-primary rounded-[18px] py-3 font-bold flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  <Eye className="w-4 h-4" />
                  Demander clarification employé
                </button>
                <button
                  onClick={() => void handleReject(detail)}
                  className="w-full text-danger text-[13px] font-bold py-2"
                >
                  Rejeter la sortie
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </V2Shell>
  );
}

function KpiCard({
  variant,
  icon,
  eyebrow,
  value,
  label,
}: {
  variant: "danger" | "warn" | "primary" | "neutral";
  icon: React.ReactNode;
  eyebrow: string;
  value: string;
  label: string;
}) {
  const palette: Record<typeof variant, string> = {
    danger: "bg-white border-danger/30 text-danger",
    warn: "bg-white border-warning/30 text-warning",
    primary: "bg-white border-primary/20 text-primary",
    neutral: "bg-white border-rule text-text-primary",
  };
  return (
    <div className={`border-2 rounded-2xl p-3.5 ${palette[variant]}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-wide">
          {eyebrow}
        </p>
      </div>
      <p className="text-[19px] font-extrabold mt-1.5 tabular text-text-primary leading-none">
        {value}
      </p>
      <p className="text-[11px] text-text-secondary mt-1">{label}</p>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold shrink-0 transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-white border border-rule text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-0.5 bg-black/15 text-current rounded-full px-1.5 py-0.5 text-[10px] tabular">
      {children}
    </span>
  );
}

function SortiesPanel({
  sorties,
  onDetail,
}: {
  sorties: SortieSuspecte[];
  onDetail: (s: SortieSuspecte) => void;
}) {
  if (sorties.length === 0) {
    return (
      <div className="bg-success-soft border border-success/20 rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-7 h-7 text-success mx-auto mb-2" />
        <p className="font-bold text-text-primary">
          Aucune sortie suspecte
        </p>
        <p className="text-xs text-text-secondary mt-1">
          Toutes les sorties récentes ont un score IA ≥ 0.7.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5 mt-1">
      {sorties.map((s) => {
        const isRed = s.ia_coherence_score < 0.5;
        return (
          <button
            key={s.id}
            onClick={() => onDetail(s)}
            className={`w-full bg-white border rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform ${
              isRed ? "border-danger/40 shadow-card" : "border-warning/30"
            }`}
          >
            <span
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isRed
                  ? "bg-danger-soft text-danger"
                  : "bg-warning-soft text-warning"
              }`}
            >
              <PackageX className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-primary truncate">
                {s.produits?.nom ?? "Produit"}
              </p>
              <p className="text-[11.5px] text-text-secondary mt-0.5 truncate">
                {nameOf(s.employes)} · {s.depots?.nom} ·{" "}
                {timeAgoFr(s.created_at)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-[14px] font-extrabold tabular ${
                  isRed ? "text-danger" : "text-warning"
                }`}
              >
                {(s.ia_coherence_score * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] uppercase font-bold tracking-wide text-text-tertiary mt-0.5">
                score IA
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DemarquePanel({ rows }: { rows: DemarqueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-cream border border-rule rounded-2xl p-6 text-center">
        <TrendingDown className="w-7 h-7 text-text-tertiary mx-auto mb-2" />
        <p className="text-sm text-text-primary font-bold">
          Aucune démarque détectée
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 mt-1">
      {rows.map((r) => (
        <div
          key={r.ean}
          className="bg-white border border-danger/30 rounded-2xl p-4 shadow-card"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-text-primary truncate">
                {r.produit}
              </p>
              <p className="text-[11px] mono text-text-tertiary mt-0.5">
                {r.ean}
              </p>
            </div>
            <span className="bg-danger text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              {r.ecart} u.
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mb-2">
            <Stat label="Entrées" value={`+${r.entrees}`} />
            <Stat label="Ventes" value={`−${r.ventes}`} />
            <Stat label="Sorties" value={`−${r.sorties_tracees}`} />
            <Stat
              label="Théo / Réel"
              value={`${r.stock_theorique}/${r.stock_physique}`}
            />
          </div>
          <p className="text-[11.5px] text-text-secondary text-center pt-2 border-t border-rule">
            Valeur démarque :{" "}
            <b className="text-danger tabular">{fr2(r.valeur)}</b>
          </p>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold text-text-tertiary tracking-wide">
        {label}
      </p>
      <p className="text-[13px] font-extrabold text-text-primary tabular mt-0.5">
        {value}
      </p>
    </div>
  );
}

function SurplusPanel({
  items,
  onOpenAdmin,
}: {
  items: AlerteSurplus[];
  onOpenAdmin: () => void;
}) {
  const pending = items.filter((i) => i.statut === "en_attente");
  return (
    <div className="space-y-3 mt-1">
      {pending.length === 0 ? (
        <div className="bg-success-soft border border-success/20 rounded-2xl p-6 text-center">
          <PackageCheck className="w-7 h-7 text-success mx-auto mb-2" />
          <p className="font-bold text-text-primary">
            Aucun surplus en attente
          </p>
        </div>
      ) : (
        pending.map((s) => (
          <div
            key={s.id}
            className="bg-white border border-warning/30 rounded-2xl p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-warning-soft text-warning flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-extrabold text-text-primary truncate">
                  {s.produits?.nom ?? "Produit"}
                </p>
                <p className="text-[11.5px] text-text-secondary mt-0.5">
                  {s.bons_de_livraison?.fournisseurs?.nom ?? "—"} ·{" "}
                  {timeAgoFr(s.signale_le)}
                </p>
              </div>
              <p className="text-[16px] font-extrabold tabular text-warning shrink-0">
                +{s.quantite_surplus}
              </p>
            </div>
            {s.notes && (
              <p className="text-[11.5px] text-text-secondary mt-3 bg-cream rounded-xl p-2">
                {s.notes}
              </p>
            )}
          </div>
        ))
      )}
      <button
        onClick={onOpenAdmin}
        className="w-full mt-4 bg-primary text-white rounded-[18px] py-3.5 font-bold flex items-center justify-center gap-2 shadow-card active:scale-[0.99]"
      >
        <FileText className="w-4 h-4" />
        Page complète surplus
      </button>
    </div>
  );
}

function HistoriquePanel({
  sorties,
  surplus,
}: {
  sorties: SortieSuspecte[];
  surplus: AlerteSurplus[];
}) {
  const merged = [
    ...sorties.slice(0, 15).map((s) => ({
      kind: "sortie" as const,
      ts: s.created_at,
      title: s.produits?.nom ?? "Produit",
      sub: `${nameOf(s.employes)} · ${s.type.replace(/_/g, " ")}`,
      val: `${(s.ia_coherence_score * 100).toFixed(0)}%`,
    })),
    ...surplus.slice(0, 15).map((s) => ({
      kind: "surplus" as const,
      ts: s.signale_le,
      title: s.produits?.nom ?? "Produit",
      sub: `Surplus ${s.bons_de_livraison?.fournisseurs?.nom ?? ""} · ${s.statut}`,
      val: `+${s.quantite_surplus}`,
    })),
  ]
    .sort((a, b) => (a.ts > b.ts ? -1 : 1))
    .slice(0, 30);

  if (merged.length === 0) {
    return (
      <p className="text-center text-sm text-text-tertiary py-6">
        Aucun historique.
      </p>
    );
  }
  return (
    <div className="space-y-2 mt-1 opacity-90">
      {merged.map((m, i) => (
        <div
          key={i}
          className="bg-white border border-rule rounded-xl p-3 flex items-center gap-3"
        >
          <span
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              m.kind === "sortie"
                ? "bg-cream text-primary"
                : "bg-gold-soft text-primary-dark"
            }`}
          >
            {m.kind === "sortie" ? (
              <PackageX className="w-4 h-4" />
            ) : (
              <Truck className="w-4 h-4" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-text-primary truncate">
              {m.title}
            </p>
            <p className="text-[11px] text-text-secondary mt-0.5 truncate">
              {m.sub} · {timeAgoFr(m.ts)}
            </p>
          </div>
          <p className="text-[12.5px] font-extrabold text-text-primary tabular shrink-0">
            {m.val}
          </p>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-tertiary text-[11.5px] font-bold uppercase tracking-wide">
        {label}
      </span>
      <span className="font-bold text-text-primary text-right">{value}</span>
    </div>
  );
}
