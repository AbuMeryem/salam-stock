"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  PackageCheck,
  PackagePlus,
  ScanBarcode,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import { useV2 } from "@/lib/v2-store";
import { supabase } from "@/lib/supabase";

interface BdlLigne {
  id: string;
  produit_id: string | null;
  code_barre_attendu: string | null;
  quantite_attendue: number;
  quantite_recue: number;
  statut: "attendu" | "recu" | "manquant" | "surplus";
  produits?: { id: string; nom: string; ean: string | null; categorie: string | null } | null;
}

interface BdlDetail {
  id: string;
  numero_bdl: string;
  numero_bdl_fournisseur: string | null;
  fournisseur_id: string | null;
  depot_destination_id: string | null;
  date_livraison_prevue: string;
  statut: "prevue" | "en_cours" | "receptionnee" | "litige";
  photo_palette_url_1: string | null;
  photo_palette_url_2: string | null;
  photo_bdl_url: string | null;
  notes: string | null;
  fournisseurs: { id: string; nom: string } | null;
  depots: { id: string; nom: string } | null;
  bons_de_livraison_lignes: BdlLigne[];
}

export default function BdlReceptionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bdlId = params?.id;
  const employe = useV2((s) => s.currentEmploye);

  const [bdl, setBdl] = useState<BdlDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoSlot, setPhotoSlot] = useState<1 | 2 | 3 | null>(null);
  const [editingNumFourn, setEditingNumFourn] = useState(false);
  const [numFournDraft, setNumFournDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Carton learning state — flow pour apprendre la liaison carton↔produit
  const [learnCartonModal, setLearnCartonModal] = useState<{
    code: string;
    step: "qty" | "pick";
    qty: number;
  } | null>(null);
  const [cartonScannerOpen, setCartonScannerOpen] = useState(false);
  const [cartonSearchQuery, setCartonSearchQuery] = useState("");
  const [cartonSearchResults, setCartonSearchResults] = useState<
    Array<{ id: string; nom: string; ean: string | null; categorie: string | null }>
  >([]);

  // Surplus modal state — EAN connu du catalogue mais hors BDL
  const [surplusModal, setSurplusModal] = useState<
    | { code: string; produitNom: string; produitId: string }
    | null
  >(null);
  const [surplusQty, setSurplusQty] = useState(1);
  const [surplusPhoto, setSurplusPhoto] = useState<string | null>(null);
  const [surplusPhotoOpen, setSurplusPhotoOpen] = useState(false);
  const [adminIds, setAdminIds] = useState<string[]>([]);

  // Create-product modal state — EAN totalement inconnu (pas en catalogue)
  const [createModal, setCreateModal] = useState<{ code: string } | null>(null);
  const [newProdNom, setNewProdNom] = useState("");
  const [newProdCategorie, setNewProdCategorie] = useState("Épicerie");
  const [newProdPrix, setNewProdPrix] = useState("");
  const [newProdQty, setNewProdQty] = useState(1);
  const [creatingProd, setCreatingProd] = useState(false);

  // Ref pour éviter stale closure dans le scanner
  const bdlRef = useRef<BdlDetail | null>(null);
  bdlRef.current = bdl;

  // ─── Load BDL details ──────────────────────────────────────────
  async function fetchBdl() {
    if (!bdlId) return;
    setLoading(true);
    const sb = supabase();
    if (!sb) {
      toast.error("Supabase indisponible");
      setLoading(false);
      return;
    }
    const { data, error } = await sb
      .from("bons_de_livraison")
      .select(
        `id, numero_bdl, numero_bdl_fournisseur, fournisseur_id, depot_destination_id, date_livraison_prevue, statut, photo_palette_url_1, photo_palette_url_2, photo_bdl_url, notes,
         fournisseurs (id, nom),
         depots (id, nom),
         bons_de_livraison_lignes (
           id, produit_id, code_barre_attendu, quantite_attendue, quantite_recue, statut,
           produits (id, nom, ean, categorie)
         )`
      )
      .eq("id", bdlId)
      .single();
    if (error) {
      console.error(error);
      toast.error("BDL introuvable");
      setLoading(false);
      return;
    }
    setBdl(data as unknown as BdlDetail);
    // Marque comme en_cours si encore "prevue"
    if ((data as unknown as BdlDetail).statut === "prevue") {
      await sb
        .from("bons_de_livraison")
        .update({ statut: "en_cours" })
        .eq("id", bdlId);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchBdl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bdlId]);

  // Récupère les IDs admins (Otmane + Ahmed) pour push surplus.
  useEffect(() => {
    void (async () => {
      const sb = supabase();
      if (!sb) return;
      const { data } = await sb
        .from("employes")
        .select("id, role, prenom")
        .eq("is_active", true);
      const ids = ((data ?? []) as Array<{
        id: string;
        role: string;
        prenom: string | null;
      }>)
        .filter(
          (e) =>
            e.role === "admin" ||
            ["Otmane", "Ahmed"].includes(e.prenom ?? "")
        )
        .map((e) => e.id);
      setAdminIds(ids);
    })().catch((e) => console.warn("[adminIds] fail:", e));
  }, []);

  // Search produits dans modal carton learn step "pick"
  useEffect(() => {
    if (!learnCartonModal || learnCartonModal.step !== "pick") {
      setCartonSearchResults([]);
      return;
    }
    if (!cartonSearchQuery.trim()) {
      setCartonSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const sb = supabase();
      if (!sb) return;
      const q = cartonSearchQuery.trim();
      const { data } = await sb
        .from("produits")
        .select("id, nom, ean, categorie")
        .or(`nom.ilike.%${q}%,marque.ilike.%${q}%,ean.ilike.%${q}%`)
        .limit(15);
      setCartonSearchResults(
        (data ?? []) as Array<{
          id: string;
          nom: string;
          ean: string | null;
          categorie: string | null;
        }>
      );
    }, 220);
    return () => clearTimeout(t);
  }, [cartonSearchQuery, learnCartonModal]);

  // ─── KPI dérivés ───────────────────────────────────────────────
  const progression = useMemo(() => {
    if (!bdl) return { scanned: 0, total: 0, pct: 0 };
    const total = bdl.bons_de_livraison_lignes.reduce(
      (s, l) => s + l.quantite_attendue,
      0
    );
    const scanned = bdl.bons_de_livraison_lignes.reduce(
      (s, l) => s + Math.min(l.quantite_recue, l.quantite_attendue),
      0
    );
    return { scanned, total, pct: total > 0 ? (scanned / total) * 100 : 0 };
  }, [bdl]);

  const allRecu = useMemo(() => {
    if (!bdl) return false;
    return bdl.bons_de_livraison_lignes.every(
      (l) => l.statut === "recu" || l.statut === "manquant"
    );
  }, [bdl]);

  // ─── Scan handler ──────────────────────────────────────────────
  async function handleScan(code: string) {
    setScannerOpen(false);
    const cur = bdlRef.current;
    if (!cur) return;
    const sb = supabase();
    if (!sb) {
      toast.error("Supabase indisponible");
      return;
    }

    // 0. CARTON CONNU ? Lookup la table codes_barres_cartons.
    //    Si trouvé → on récupère le produit lié + multiplier, puis on
    //    re-route comme si on avait scanné l'EAN unitaire N fois.
    const { data: cartonRow } = await sb
      .from("codes_barres_cartons")
      .select("ean_carton, produit_id, quantite_par_carton")
      .eq("ean_carton", code)
      .maybeSingle();
    const carton = cartonRow as {
      ean_carton: string;
      produit_id: string;
      quantite_par_carton: number;
    } | null;
    if (carton) {
      // Trouve la ligne BDL qui matche ce produit
      const matched = cur.bons_de_livraison_lignes.find(
        (l) => l.produit_id === carton.produit_id
      );
      if (matched) {
        const newQte = matched.quantite_recue + carton.quantite_par_carton;
        const newStat: BdlLigne["statut"] =
          newQte >= matched.quantite_attendue ? "recu" : "attendu";
        await sb
          .from("bons_de_livraison_lignes")
          .update({
            quantite_recue: newQte,
            statut: newStat,
            scanne_le: new Date().toISOString(),
            scanne_par: employe?.id ?? null,
          })
          .eq("id", matched.id);
        toast.success(
          `Carton ${matched.produits?.nom ?? "produit"} · +${carton.quantite_par_carton} (${newQte}/${matched.quantite_attendue})`,
          { duration: 1800 }
        );
        void fetchBdl();
        return;
      }
      // Produit du carton hors BDL → modal surplus avec la qty du carton
      const { data: prodNom } = await sb
        .from("produits")
        .select("id, nom")
        .eq("id", carton.produit_id)
        .maybeSingle();
      const pn = prodNom as { id: string; nom: string } | null;
      if (pn) {
        setSurplusModal({
          code,
          produitNom: pn.nom,
          produitId: pn.id,
        });
        setSurplusQty(carton.quantite_par_carton);
        return;
      }
    }

    // Match contre une ligne du BDL ?
    const matched = cur.bons_de_livraison_lignes.find(
      (l) => l.code_barre_attendu === code || l.produits?.ean === code
    );

    if (matched) {
      const nouvelleQte = matched.quantite_recue + 1;
      const nouveauStatut: BdlLigne["statut"] =
        nouvelleQte >= matched.quantite_attendue ? "recu" : "attendu";
      const { error } = await sb
        .from("bons_de_livraison_lignes")
        .update({
          quantite_recue: nouvelleQte,
          statut: nouveauStatut,
          scanne_le: new Date().toISOString(),
          scanne_par: employe?.id ?? null,
        })
        .eq("id", matched.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(
        `${matched.produits?.nom ?? "Produit"} · +1 (${nouvelleQte}/${matched.quantite_attendue})`,
        { duration: 1600 }
      );
      void fetchBdl();
      return;
    }

    // EAN ∉ BDL : lookup produit en catalogue
    const { data: prod } = await sb
      .from("produits")
      .select("id, nom, ean")
      .eq("ean", code)
      .maybeSingle();
    const prodRow = prod as { id?: string; nom?: string } | null;

    if (prodRow?.id) {
      // Produit connu mais hors BDL → modal surplus
      setSurplusModal({
        code,
        produitNom: prodRow.nom ?? "Produit",
        produitId: prodRow.id,
      });
      setSurplusQty(1);
      return;
    }

    // Produit totalement inconnu → modal création
    setCreateModal({ code });
    setNewProdNom("");
    setNewProdCategorie("Épicerie");
    setNewProdPrix("");
    setNewProdQty(1);
  }

  // ─── Create-product submit ─────────────────────────────────────
  async function submitCreateProduct() {
    if (!createModal || !bdl) return;
    const nom = newProdNom.trim();
    if (nom.length < 2) {
      toast.error("Nom du produit requis (≥ 2 caractères)");
      return;
    }
    const prix = parseFloat(newProdPrix.replace(",", "."));
    if (Number.isNaN(prix) || prix <= 0) {
      toast.error("Prix unitaire invalide");
      return;
    }
    const qty = Math.max(1, Math.floor(newProdQty));
    setCreatingProd(true);
    const sb = supabase();
    if (!sb) {
      setCreatingProd(false);
      return;
    }
    try {
      // 1. Insère le produit
      const { data: created, error: errProd } = await sb
        .from("produits")
        .insert({
          ean: createModal.code,
          nom,
          categorie: newProdCategorie,
          requires_barcode_print: false,
        })
        .select("id")
        .single();
      if (errProd) throw new Error(errProd.message);
      const produitId = (created as { id: string }).id;

      // 2. Prix initial dans stock_par_depot pour le dépôt destination
      if (bdl.depot_destination_id) {
        await sb.from("stock_par_depot").insert({
          produit_id: produitId,
          depot_id: bdl.depot_destination_id,
          quantite: 0,
          prix_vente: prix,
          is_visible: true,
        });
      }

      // 3. Ajoute une ligne BDL avec qty_attendue = qty saisie et qty_recue = qty saisie
      //    (statut "recu" car on a déjà la marchandise sous la main)
      await sb.from("bons_de_livraison_lignes").insert({
        bdl_id: bdl.id,
        produit_id: produitId,
        code_barre_attendu: createModal.code,
        quantite_attendue: qty,
        quantite_recue: qty,
        statut: "recu",
        scanne_le: new Date().toISOString(),
        scanne_par: employe?.id ?? null,
      });

      // Push iPhone admin — l'employé vient de créer une fiche produit
      // pendant une réception, l'admin doit la valider (prix notamment)
      void import("@/lib/notifications").then((m) =>
        m.pushToAdmins({
          title: `🆕 Nouvelle fiche produit créée`,
          body: `${nom} (EAN ${createModal.code}) par ${employe?.prenom ?? "employé"}. Prix ${prix.toFixed(2)}€ à valider.`,
          url: "/v2/stock",
          tag: `prod-${produitId}`,
        })
      );

      toast.success(`Fiche créée : ${nom} · ${qty} unité${qty > 1 ? "s" : ""} reçue${qty > 1 ? "s" : ""} · admin notifié`, {
        duration: 2400,
      });
      setCreateModal(null);
      void fetchBdl();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur création");
    } finally {
      setCreatingProd(false);
    }
  }

  // ─── Carton learn : scan produit interne + bind au code carton ──
  async function handleCartonInternalScan(code: string) {
    setCartonScannerOpen(false);
    if (!learnCartonModal) return;
    const sb = supabase();
    if (!sb) return;
    const { data: prod } = await sb
      .from("produits")
      .select("id, nom, ean, categorie")
      .eq("ean", code)
      .maybeSingle();
    const p = prod as {
      id: string;
      nom: string;
      ean: string | null;
      categorie: string | null;
    } | null;
    if (!p) {
      toast.warning(
        `EAN ${code} inconnu — utilise la recherche par nom ci-dessous.`,
        { duration: 3500 }
      );
      return;
    }
    await bindCartonToProduct(p.id, p.nom);
  }

  async function bindCartonToProduct(produitId: string, produitNom: string) {
    if (!learnCartonModal || !bdl) return;
    const sb = supabase();
    if (!sb) return;
    const { error: errLearn } = await sb.from("codes_barres_cartons").insert({
      ean_carton: learnCartonModal.code,
      produit_id: produitId,
      quantite_par_carton: learnCartonModal.qty,
      learned_by: employe?.id ?? null,
    });
    if (errLearn) {
      toast.error("Erreur apprentissage carton : " + errLearn.message);
      return;
    }
    const cur = bdlRef.current;
    const matched = cur?.bons_de_livraison_lignes.find(
      (l) => l.produit_id === produitId
    );
    if (matched) {
      const newQte = matched.quantite_recue + learnCartonModal.qty;
      const newStat: BdlLigne["statut"] =
        newQte >= matched.quantite_attendue ? "recu" : "attendu";
      await sb
        .from("bons_de_livraison_lignes")
        .update({
          quantite_recue: newQte,
          statut: newStat,
          scanne_le: new Date().toISOString(),
          scanne_par: employe?.id ?? null,
        })
        .eq("id", matched.id);
    } else {
      await sb.from("bons_de_livraison_lignes").insert({
        bdl_id: bdl.id,
        produit_id: produitId,
        code_barre_attendu: learnCartonModal.code,
        quantite_attendue: learnCartonModal.qty,
        quantite_recue: learnCartonModal.qty,
        statut: "recu",
        scanne_le: new Date().toISOString(),
        scanne_par: employe?.id ?? null,
      });
    }
    toast.success(
      `Carton appris : ${produitNom} × ${learnCartonModal.qty} (codes liés)`,
      { duration: 3000 }
    );
    setLearnCartonModal(null);
    setCartonSearchQuery("");
    setCartonSearchResults([]);
    void fetchBdl();
  }

  // ─── Surplus submit ────────────────────────────────────────────
  async function submitSurplus() {
    if (!surplusModal || !bdl) return;
    const sb = supabase();
    if (!sb) return;
    const { error } = await sb.from("alertes_surplus").insert({
      bdl_id: bdl.id,
      code_barre_scanne: surplusModal.code,
      produit_id: surplusModal.produitId,
      quantite_surplus: surplusQty,
      signale_par: employe?.id ?? null,
      statut: "en_attente",
      notes: `Détecté au scan du BDL ${bdl.numero_bdl} — produit non commandé.`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Notif interne legacy
    void fetch("/api/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "surplus_reception",
        payload: {
          bdl: bdl.numero_bdl,
          produit: surplusModal.produitNom,
          quantite: surplusQty,
          signale_par: `${employe?.prenom ?? ""} ${employe?.nom ?? ""}`.trim(),
        },
      }),
    }).catch(() => {});
    // Push iPhone Otmane + Ahmed
    void import("@/lib/notifications").then((m) =>
      m.pushToAdmins({
        title: `📦 Surplus ${bdl.fournisseurs?.nom ?? "fournisseur"}`,
        body: `${surplusModal.produitNom} × ${surplusQty} non commandé sur ${bdl.numero_bdl}`,
        url: "/v2/admin/alertes-surplus",
        tag: `surplus-${bdl.id}-${surplusModal.code}`,
      })
    );
    toast.success("Surplus signalé (push iPhone admin envoyée)", {
      duration: 2400,
    });
    setSurplusModal(null);
  }

  // ─── Photo upload (palette x2 + BDL papier) ───────────────────
  async function handlePhotoCapture(dataUrl: string) {
    if (!bdl || photoSlot === null) return;
    const sb = supabase();
    if (!sb) return;
    const field =
      photoSlot === 1
        ? "photo_palette_url_1"
        : photoSlot === 2
          ? "photo_palette_url_2"
          : "photo_bdl_url";
    const { error } = await sb
      .from("bons_de_livraison")
      .update({ [field]: dataUrl })
      .eq("id", bdl.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      photoSlot === 3
        ? "Photo du BDL papier enregistrée"
        : `Photo palette ${photoSlot} enregistrée`
    );
    setPhotoOpen(false);
    setPhotoSlot(null);
    void fetchBdl();
  }

  // ─── N° BDL fournisseur (édition inline) ──────────────────────
  async function saveNumeroFournisseur() {
    if (!bdl) return;
    const sb = supabase();
    if (!sb) return;
    const trimmed = numFournDraft.trim();
    const { error } = await sb
      .from("bons_de_livraison")
      .update({ numero_bdl_fournisseur: trimmed || null })
      .eq("id", bdl.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("N° BDL fournisseur enregistré");
    setEditingNumFourn(false);
    void fetchBdl();
  }

  // ─── Validation finale BDL ─────────────────────────────────────
  async function finalize() {
    if (!bdl) return;
    // Photos palette OBLIGATOIRES — preuve livraison + protection litige
    if (!bdl.photo_palette_url_1 || !bdl.photo_palette_url_2) {
      const missing = !bdl.photo_palette_url_1 && !bdl.photo_palette_url_2
        ? "Les 2 photos palette"
        : !bdl.photo_palette_url_1
          ? "La photo palette n°1"
          : "La photo palette n°2";
      toast.error(
        `${missing} obligatoire${missing.startsWith("Les") ? "s" : ""} avant validation. Voir section "Photos palette" en haut.`,
        { duration: 6000 }
      );
      return;
    }
    if (!allRecu) {
      const ok = window.confirm(
        "Certaines lignes ne sont ni reçues ni marquées manquantes. Valider quand même ?"
      );
      if (!ok) return;
    }
    setSubmitting(true);
    const sb = supabase();
    if (!sb) {
      setSubmitting(false);
      return;
    }
    try {
      // 1. Pour chaque ligne reçue, incrémenter stock_par_depot
      for (const l of bdl.bons_de_livraison_lignes) {
        if (l.statut !== "recu" || !l.produit_id || l.quantite_recue <= 0) {
          continue;
        }
        const { data: existing } = await sb
          .from("stock_par_depot")
          .select("id, quantite")
          .eq("produit_id", l.produit_id)
          .eq("depot_id", bdl.depot_destination_id!)
          .maybeSingle();
        if (existing) {
          await sb
            .from("stock_par_depot")
            .update({
              quantite:
                (existing as { quantite: number }).quantite + l.quantite_recue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (existing as { id: string }).id);
        } else {
          await sb.from("stock_par_depot").insert({
            produit_id: l.produit_id,
            depot_id: bdl.depot_destination_id,
            quantite: l.quantite_recue,
            is_visible: true,
          });
        }
      }
      // 2. Marque BDL receptionnee
      await sb
        .from("bons_de_livraison")
        .update({
          statut: "receptionnee",
          receptionne_par: employe?.id ?? null,
          receptionne_le: new Date().toISOString(),
        })
        .eq("id", bdl.id);
      // 3. Notif legacy
      void fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "bdl_receptionne",
          payload: {
            bdl: bdl.numero_bdl,
            fournisseur: bdl.fournisseurs?.nom,
            depot: bdl.depots?.nom,
            scanned: progression.scanned,
            total: progression.total,
            employe: `${employe?.prenom} ${employe?.nom}`,
          },
        }),
      }).catch(() => {});
      // 4. Push iPhone admin — réception complète, stock mis à jour
      void import("@/lib/notifications").then((m) =>
        m.pushToAdmins({
          title: `✅ Réception ${bdl.fournisseurs?.nom ?? "BDL"} validée`,
          body: `${bdl.numero_bdl} · ${bdl.depots?.nom ?? "?"} · ${progression.scanned}/${progression.total} unités · par ${employe?.prenom ?? "employé"}`,
          url: "/v2/reception",
          tag: `bdl-done-${bdl.id}`,
        })
      );
      toast.success("Réception validée. Admin notifié.");
      router.replace("/v2/reception");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur validation");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <V2Shell hideNav>
        <div className="px-5 pt-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-sm text-text-secondary">Chargement BDL…</p>
        </div>
      </V2Shell>
    );
  }

  if (!bdl) {
    return (
      <V2Shell hideNav>
        <div className="px-5 pt-10 text-center">
          <p className="text-sm text-text-secondary">BDL introuvable.</p>
          <button
            onClick={() => router.replace("/v2/reception")}
            className="mt-4 btn-primary"
          >
            Retour
          </button>
        </div>
      </V2Shell>
    );
  }

  return (
    <V2Shell hideNav>
      <PageAccentStripe accent="sapin" />

      {/* Header — sticky désactivé pour éviter collision avec V2Shell
          sticky top-0 z-30 (le shell header reste fixe en haut, on
          laisse celui-ci scroller naturellement). */}
      <header className="px-5 pt-5 pb-3 bg-cream border-b border-rule">
        <BackButton href="/v2/reception" />
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-primary">BDL · {bdl.fournisseurs?.nom ?? "—"}</p>
            <h1 className="text-[22px] font-extrabold text-text-primary mt-0.5">
              {bdl.numero_bdl}
            </h1>
            <p className="text-[12px] text-text-secondary mt-0.5">
              Livraison <b>{bdl.depots?.nom ?? "—"}</b> ·{" "}
              {new Date(bdl.date_livraison_prevue).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
              })}
            </p>
            {/* N° BDL fournisseur — éditable inline */}
            {editingNumFourn ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  value={numFournDraft}
                  onChange={(e) => setNumFournDraft(e.target.value)}
                  placeholder="N° BDL fournisseur"
                  className="flex-1 bg-white border border-rule rounded-lg px-2.5 py-1 text-[12px] font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveNumeroFournisseur();
                    if (e.key === "Escape") setEditingNumFourn(false);
                  }}
                />
                <button
                  onClick={() => void saveNumeroFournisseur()}
                  className="bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-lg"
                >
                  OK
                </button>
                <button
                  onClick={() => setEditingNumFourn(false)}
                  className="text-text-tertiary text-[11px] px-1"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNumFournDraft(bdl.numero_bdl_fournisseur ?? "");
                  setEditingNumFourn(true);
                }}
                className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] font-mono"
              >
                {bdl.numero_bdl_fournisseur ? (
                  <>
                    <span className="text-text-tertiary">N° BDL fourn :</span>
                    <span className="font-bold text-text-primary">
                      {bdl.numero_bdl_fournisseur}
                    </span>
                    <span className="text-[10px] text-text-tertiary">(éditer)</span>
                  </>
                ) : (
                  <span className="italic text-primary">
                    + Saisir N° BDL fournisseur
                  </span>
                )}
              </button>
            )}
          </div>
          <span
            className={`text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap ${
              bdl.statut === "receptionnee"
                ? "bg-success-soft text-success"
                : bdl.statut === "en_cours"
                  ? "bg-gold-soft text-primary-dark"
                  : bdl.statut === "litige"
                    ? "bg-danger-soft text-danger"
                    : "bg-cream text-text-tertiary"
            }`}
          >
            {bdl.statut === "receptionnee"
              ? "Réceptionnée"
              : bdl.statut === "en_cours"
                ? "En cours"
                : bdl.statut === "litige"
                  ? "Litige"
                  : "Prévue"}
          </span>
        </div>

        {/* Progression */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
              Progression
            </span>
            <span className="text-[13px] font-extrabold tabular text-text-primary">
              {progression.scanned} / {progression.total} unités
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-cream overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progression.pct}%` }}
              transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
            />
          </div>
        </div>
      </header>

      {/* Liste des lignes attendues */}
      <section className="px-5 mt-4 pb-[200px]">
        <p className="label-caps text-text-tertiary mb-2">
          Produits attendus ({bdl.bons_de_livraison_lignes.length})
        </p>
        <div className="space-y-2">
          {bdl.bons_de_livraison_lignes.map((l) => {
            const isRecu = l.statut === "recu";
            const isSurplus = l.statut === "surplus";
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white border rounded-2xl p-3 flex items-center gap-3 ${
                  isRecu
                    ? "border-success/40"
                    : isSurplus
                      ? "border-danger/40"
                      : "border-rule"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isRecu
                      ? "bg-success-soft text-success"
                      : isSurplus
                        ? "bg-danger-soft text-danger"
                        : "bg-cream text-text-tertiary"
                  }`}
                >
                  {isRecu ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isSurplus ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <PackagePlus className="w-5 h-5" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold text-text-primary truncate">
                    {l.produits?.nom ?? "Produit (sans nom)"}
                  </p>
                  <p className="text-[11px] text-text-tertiary mono mt-0.5">
                    {l.code_barre_attendu ?? l.produits?.ean ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-[14px] font-extrabold tabular ${
                      isRecu
                        ? "text-success"
                        : isSurplus
                          ? "text-danger"
                          : "text-text-primary"
                    }`}
                  >
                    {l.quantite_recue} / {l.quantite_attendue}
                  </p>
                  <p
                    className={`text-[10.5px] uppercase font-bold tracking-wide mt-0.5 ${
                      isRecu
                        ? "text-success"
                        : isSurplus
                          ? "text-danger"
                          : "text-text-tertiary"
                    }`}
                  >
                    {isRecu
                      ? "Reçu"
                      : isSurplus
                        ? "Surplus"
                        : l.statut === "manquant"
                          ? "Manquant"
                          : "À scanner"}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Photos palette + photo BDL papier (preuve archivée) */}
        <div className="mt-6">
          <p className="label-caps text-text-tertiary mb-2">
            Photos palette (obligatoires)
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2].map((slot) => {
              const url =
                slot === 1
                  ? bdl.photo_palette_url_1
                  : bdl.photo_palette_url_2;
              return (
                <button
                  key={slot}
                  onClick={() => {
                    setPhotoSlot(slot as 1 | 2);
                    setPhotoOpen(true);
                  }}
                  className="relative aspect-[4/3] rounded-2xl border-2 border-dashed border-primary/30 overflow-hidden bg-cream active:scale-95 transition-transform"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Palette ${slot}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-primary gap-1">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[11px] font-bold">
                        Photo côté {slot}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Photo BDL papier (optionnelle, preuve en cas de litige) */}
          <p className="label-caps text-text-tertiary mt-5 mb-2">
            Photo du BDL papier (optionnelle)
          </p>
          <button
            onClick={() => {
              setPhotoSlot(3);
              setPhotoOpen(true);
            }}
            className="relative w-full aspect-[16/6] rounded-2xl border-2 border-dashed border-text-tertiary/30 overflow-hidden bg-white active:scale-[0.99] transition-transform"
          >
            {bdl.photo_bdl_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bdl.photo_bdl_url}
                alt="BDL papier"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary">
                <ImagePlus className="w-4 h-4" />
                <span className="text-[12px] font-bold">
                  Scanner ou photographier le BDL du fournisseur
                </span>
              </div>
            )}
          </button>
        </div>
      </section>

      {/* Floating actions — diffèrent selon le statut */}
      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto space-y-2.5">
          {bdl.statut === "receptionnee" ? (
            <>
              {/* BR PDF — disponible une fois la réception validée */}
              <a
                href={`/api/cashbox/bon-reception-pdf?bdl_id=${bdl.id}`}
                target="_blank"
                rel="noopener"
                className="w-full bg-primary text-white rounded-[22px] py-4 px-5 flex items-center justify-between shadow-card-lg active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-gold/20 text-gold flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </span>
                  <span className="text-left">
                    <span className="block label-caps text-gold">BON DE RÉCEPTION</span>
                    <span className="block font-bold text-[15px]">
                      Télécharger le BR PDF
                    </span>
                  </span>
                </span>
                <Download className="w-5 h-5 text-gold" />
              </a>
            </>
          ) : (
            <>
              <button
                onClick={() => setScannerOpen(true)}
                className="w-full bg-primary text-white rounded-[22px] py-4 px-5 flex items-center justify-between shadow-card-lg active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-gold/20 text-gold flex items-center justify-center">
                    <ScanBarcode className="w-6 h-6" />
                  </span>
                  <span className="text-left">
                    <span className="block label-caps text-gold">SCANNER</span>
                    <span className="block font-bold text-[15px]">
                      Scanner produit suivant
                    </span>
                  </span>
                </span>
                <PackagePlus className="w-5 h-5 text-gold" />
              </button>

              <button
                onClick={finalize}
                disabled={submitting}
                className={`w-full rounded-[20px] py-3.5 px-4 flex items-center justify-between transition-colors disabled:opacity-50 ${
                  allRecu
                    ? "bg-success text-white shadow-card"
                    : "bg-white border border-rule text-text-primary"
                }`}
              >
                <span className="text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">
                    {submitting ? "Validation…" : "Valider la réception"}
                  </span>
                  <span className="block text-[13px] font-extrabold mt-0.5">
                    {allRecu
                      ? "Toutes les lignes traitées · BR PDF généré ensuite"
                      : `${progression.scanned}/${progression.total} unités traitées`}
                  </span>
                </span>
                <PackageCheck className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scanner modal */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => void handleScan(code)}
      />

      {/* Scanner DÉDIÉ apprentissage carton — scan d'un produit interne */}
      <BarcodeScanner
        open={cartonScannerOpen}
        onClose={() => setCartonScannerOpen(false)}
        onScan={(code) => void handleCartonInternalScan(code)}
      />

      {/* Photo capture modal */}
      <PhotoCapture
        open={photoOpen}
        onClose={() => {
          setPhotoOpen(false);
          setPhotoSlot(null);
        }}
        onCapture={(d) => void handlePhotoCapture(d)}
      />

      {/* Carton learn modal — apprentissage liaison carton↔produit */}
      <AnimatePresence>
        {learnCartonModal && !cartonScannerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-8 shadow-card-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start gap-3">
                <span className="w-12 h-12 rounded-2xl bg-gold-soft text-primary-dark flex items-center justify-center shrink-0">
                  <PackageCheck className="w-6 h-6" />
                </span>
                <div className="flex-1">
                  <p className="label-caps text-primary">Apprentissage carton</p>
                  <h3 className="text-[18px] font-extrabold text-text-primary mt-1">
                    {learnCartonModal.step === "qty"
                      ? "Combien d'unités ?"
                      : "Quel produit est dedans ?"}
                  </h3>
                  <p className="text-[11px] font-mono bg-cream text-text-tertiary inline-block px-2 py-1 rounded-lg mt-2">
                    Carton : {learnCartonModal.code}
                  </p>
                </div>
                <button onClick={() => setLearnCartonModal(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>

              {learnCartonModal.step === "qty" && (
                <>
                  <p className="text-[12.5px] text-text-secondary mt-3 leading-relaxed">
                    Indique combien d&apos;unités sont dans ce carton. La
                    prochaine fois que ce code-barre sera scanné, on
                    multipliera automatiquement.
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() =>
                        setLearnCartonModal({
                          ...learnCartonModal,
                          qty: Math.max(0, learnCartonModal.qty - 1),
                        })
                      }
                      className="w-12 h-12 rounded-2xl bg-cream border border-rule font-bold text-xl"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={learnCartonModal.qty || ""}
                      onChange={(e) =>
                        setLearnCartonModal({
                          ...learnCartonModal,
                          qty: Math.max(0, parseInt(e.target.value || "0", 10)),
                        })
                      }
                      onFocus={(e) => {
                        // Scroll vers le centre quand le clavier iOS
                        // s'ouvre (sinon il cache le champ).
                        setTimeout(
                          () =>
                            e.target.scrollIntoView({
                              block: "center",
                              behavior: "smooth",
                            }),
                          340
                        );
                      }}
                      inputMode="numeric"
                      placeholder="ex: 24"
                      className="flex-1 input-field text-center text-2xl font-extrabold"
                    />
                    <button
                      onClick={() =>
                        setLearnCartonModal({
                          ...learnCartonModal,
                          qty: learnCartonModal.qty + 1,
                        })
                      }
                      className="w-12 h-12 rounded-2xl bg-cream border border-rule font-bold text-xl"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      setLearnCartonModal({
                        ...learnCartonModal,
                        step: "pick",
                      })
                    }
                    disabled={learnCartonModal.qty <= 0}
                    className="w-full mt-5 bg-primary text-white rounded-2xl py-3.5 font-bold disabled:opacity-50"
                  >
                    Suivant — identifier le produit interne
                  </button>
                </>
              )}

              {learnCartonModal.step === "pick" && (
                <>
                  <p className="text-[12.5px] text-text-secondary mt-3 leading-relaxed">
                    {learnCartonModal.qty} unités dans le carton. Scanne ou
                    cherche le produit qui est dedans.
                  </p>
                  <button
                    onClick={() => setCartonScannerOpen(true)}
                    className="w-full mt-3 bg-primary text-white rounded-2xl py-3 inline-flex items-center justify-center gap-2 font-bold"
                  >
                    <ScanBarcode className="w-5 h-5" />
                    Scanner un produit interne
                  </button>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={cartonSearchQuery}
                      onChange={(e) => setCartonSearchQuery(e.target.value)}
                      placeholder="Ou cherche par nom (Cristaline, Coca…)"
                      className="input-field"
                    />
                    <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                      {cartonSearchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => void bindCartonToProduct(p.id, p.nom)}
                          className="w-full text-left p-2 rounded-xl active:bg-cream"
                        >
                          <p className="text-sm font-bold text-text-primary truncate">
                            {p.nom}
                          </p>
                          <p className="text-[11px] text-text-tertiary font-mono">
                            {p.ean ?? "—"}
                            {p.categorie && (
                              <span className="ml-2">· {p.categorie}</span>
                            )}
                          </p>
                        </button>
                      ))}
                      {cartonSearchQuery.length >= 2 &&
                        cartonSearchResults.length === 0 && (
                          <p className="text-xs text-text-tertiary text-center py-3">
                            Aucun résultat
                          </p>
                        )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setLearnCartonModal({
                        ...learnCartonModal,
                        step: "qty",
                      })
                    }
                    className="w-full mt-3 text-text-secondary text-sm font-bold py-2"
                  >
                    ← Modifier la quantité
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Surplus modal */}
      <AnimatePresence>
        {surplusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-8 shadow-card-lg"
            >
              <div className="flex items-start gap-3">
                <span className="w-12 h-12 rounded-2xl bg-danger-soft text-danger flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </span>
                <div className="flex-1">
                  <p className="label-caps text-danger">Produit non commandé</p>
                  <h3 className="text-[18px] font-extrabold text-text-primary mt-1">
                    {surplusModal.produitNom}
                  </h3>
                  <p className="text-[11px] font-mono bg-cream text-text-tertiary inline-block px-2 py-1 rounded-lg mt-2">
                    {surplusModal.code}
                  </p>
                </div>
                <button onClick={() => setSurplusModal(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
              <p className="text-[13px] text-text-secondary mt-4">
                Ce produit ne figure pas sur le bon de livraison du fournisseur.
                Tu peux signaler le surplus à Otmane et Ahmed pour facturation
                au fournisseur ou retour marchandise.
              </p>
              <div className="mt-5">
                <label className="label-caps text-text-tertiary block mb-1.5">
                  Quantité reçue en plus
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSurplusQty((q) => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-2xl bg-cream font-bold text-xl text-text-primary"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={surplusQty}
                    onChange={(e) =>
                      setSurplusQty(Math.max(1, parseInt(e.target.value || "1", 10)))
                    }
                    inputMode="numeric"
                    className="flex-1 input-field text-center text-2xl font-extrabold"
                  />
                  <button
                    onClick={() => setSurplusQty((q) => q + 1)}
                    className="w-12 h-12 rounded-2xl bg-cream font-bold text-xl text-text-primary"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                onClick={() => void submitSurplus()}
                className="w-full mt-5 bg-danger text-white rounded-[18px] py-4 px-5 flex items-center justify-center gap-2 font-bold shadow-card-lg active:scale-[0.99]"
              >
                <Truck className="w-4 h-4" />
                Signaler à Otmane et Ahmed
              </button>
              <button
                onClick={() => setSurplusModal(null)}
                className="w-full mt-2 text-text-secondary text-[13px] font-semibold py-2"
              >
                Annuler
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create-product modal — EAN totalement inconnu */}
      <AnimatePresence>
        {createModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="bg-white w-full max-w-[460px] rounded-t-[28px] p-6 pb-8 shadow-card-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start gap-3">
                <span className="w-12 h-12 rounded-2xl bg-gold-soft text-primary-dark flex items-center justify-center shrink-0">
                  <PackagePlus className="w-6 h-6" />
                </span>
                <div className="flex-1">
                  <p className="label-caps text-primary">Code inconnu</p>
                  <h3 className="text-[18px] font-extrabold text-text-primary mt-1">
                    Carton ou unité ?
                  </h3>
                  <p className="text-[11px] font-mono bg-cream text-text-tertiary inline-block px-2 py-1 rounded-lg mt-2">
                    {createModal.code}
                  </p>
                </div>
                <button onClick={() => setCreateModal(null)}>
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>

              <p className="text-[12.5px] text-text-secondary mt-3 leading-relaxed">
                Indique d&apos;abord le type pour faciliter la suite.
              </p>

              {/* Choix Carton vs Unité — 2 cards égales */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setLearnCartonModal({
                      code: createModal.code,
                      step: "qty",
                      qty: 0,
                    });
                    setCreateModal(null);
                  }}
                  className="bg-gold-soft text-primary-dark rounded-2xl py-5 flex flex-col items-center gap-2 border-2 border-gold/30 active:scale-95 transition-transform"
                >
                  <PackageCheck className="w-7 h-7" />
                  <span className="font-extrabold text-[14px]">Carton</span>
                  <span className="text-[10.5px] font-medium opacity-80">
                    plusieurs unités
                  </span>
                </button>
                <button
                  onClick={() => {
                    // Auto-focus le nom après 50ms (laisse le DOM se peindre)
                    setTimeout(() => {
                      document
                        .getElementById("create-prod-nom-input")
                        ?.focus();
                    }, 50);
                  }}
                  className="bg-cream text-primary rounded-2xl py-5 flex flex-col items-center gap-2 border-2 border-rule active:scale-95 transition-transform"
                >
                  <PackagePlus className="w-7 h-7" />
                  <span className="font-extrabold text-[14px]">Unité</span>
                  <span className="text-[10.5px] font-medium opacity-80">
                    1 produit
                  </span>
                </button>
              </div>

              <p className="text-[11px] text-text-tertiary text-center mt-4 mb-2">
                Pour 1 unité, remplis la fiche ci-dessous · Pour un carton,
                tap le bouton or
              </p>

              {/* Bascule carton — bouton secondaire texte (au cas où user a déjà tap unité) */}
              <button
                onClick={() => {
                  setLearnCartonModal({
                    code: createModal.code,
                    step: "qty",
                    qty: 0,
                  });
                  setCreateModal(null);
                }}
                className="hidden"
              >
                <PackageCheck className="w-5 h-5" />
                C&apos;est un carton (pas une unité)
              </button>

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="label-caps text-text-tertiary block mb-1.5">
                    Nom du produit
                  </span>
                  <input
                    id="create-prod-nom-input"
                    value={newProdNom}
                    onChange={(e) => setNewProdNom(e.target.value)}
                    onFocus={(e) => {
                      // Scroll le champ vers le centre pour éviter
                      // que le clavier iOS le cache (340ms = durée
                      // approximative d'ouverture du clavier).
                      setTimeout(
                        () =>
                          e.target.scrollIntoView({
                            block: "center",
                            behavior: "smooth",
                          }),
                        340
                      );
                    }}
                    placeholder="ex : Bricks tunisiens x10"
                    className="input-field"
                  />
                </label>

                <label className="block">
                  <span className="label-caps text-text-tertiary block mb-1.5">
                    Catégorie
                  </span>
                  <select
                    value={newProdCategorie}
                    onChange={(e) => setNewProdCategorie(e.target.value)}
                    className="input-field"
                  >
                    <option value="Boucherie">Boucherie</option>
                    <option value="Charcuterie">Charcuterie</option>
                    <option value="Épicerie">Épicerie</option>
                    <option value="Frais">Frais</option>
                    <option value="Surgelés">Surgelés</option>
                    <option value="Boissons">Boissons</option>
                    <option value="Hygiène">Hygiène</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label-caps text-text-tertiary block mb-1.5">
                      Prix unitaire (€)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newProdPrix}
                      onChange={(e) => setNewProdPrix(e.target.value)}
                      placeholder="ex : 4.90"
                      className="input-field tabular"
                    />
                  </label>

                  <label className="block">
                    <span className="label-caps text-text-tertiary block mb-1.5">
                      Qté reçue
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewProdQty((q) => Math.max(1, q - 1))}
                        className="w-10 h-12 rounded-2xl bg-cream font-bold text-lg text-text-primary"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={newProdQty}
                        onChange={(e) =>
                          setNewProdQty(
                            Math.max(1, parseInt(e.target.value || "1", 10))
                          )
                        }
                        inputMode="numeric"
                        className="flex-1 input-field text-center text-lg font-extrabold tabular"
                      />
                      <button
                        type="button"
                        onClick={() => setNewProdQty((q) => q + 1)}
                        className="w-10 h-12 rounded-2xl bg-cream font-bold text-lg text-text-primary"
                      >
                        +
                      </button>
                    </div>
                  </label>
                </div>
              </div>

              <button
                onClick={() => void submitCreateProduct()}
                disabled={creatingProd}
                className="w-full mt-5 bg-primary text-white rounded-[18px] py-4 px-5 flex items-center justify-center gap-2 font-bold shadow-card-lg active:scale-[0.99] disabled:opacity-50"
              >
                {creatingProd ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {creatingProd
                  ? "Création…"
                  : "Créer la fiche et ajouter au BDL"}
              </button>
              <button
                onClick={() => setCreateModal(null)}
                className="w-full mt-2 text-text-secondary text-[13px] font-semibold py-2"
              >
                Annuler
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </V2Shell>
  );
}
