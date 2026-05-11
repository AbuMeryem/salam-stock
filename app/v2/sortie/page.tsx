"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Search,
  ScanBarcode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import {
  createSortie,
  findProduitByEan,
  searchProduits,
} from "@/lib/db";
import type { Produit, SortieType } from "@/lib/types/db";

const TYPES: { value: SortieType; label: string; desc: string }[] = [
  { value: "casse_manipulation", label: "Casse manipulation", desc: "Tombée pendant la manipulation" },
  { value: "casse_client", label: "Casse client", desc: "Cassée par un client en magasin" },
  { value: "perime_dlc", label: "Périmé DLC", desc: "Date limite de consommation dépassée" },
  { value: "perime_ddm", label: "Périmé DDM", desc: "Date de durabilité minimale dépassée" },
  { value: "defaut_fournisseur", label: "Défaut fournisseur", desc: "Produit reçu défectueux" },
  { value: "vol_identifie", label: "Vol identifié", desc: "Vol constaté avec preuve" },
  { value: "autre", label: "Autre motif", desc: "Précisez librement" },
];

export default function V2SortiePage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const employe = useV2((s) => s.currentEmploye);

  const [produit, setProduit] = useState<Produit | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Produit[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const [type, setType] = useState<SortieType | null>(null);
  const [motifLibre, setMotifLibre] = useState("");
  const [quantite, setQuantite] = useState<number>(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleScanRef = useRef<((code: string) => void) | undefined>(undefined);
  const handleScan = async (code: string) => {
    setScannerOpen(false);
    const p = await findProduitByEan(code);
    if (p) {
      setProduit(p);
      toast.success(p.nom);
    } else {
      toast.warning("Code inconnu — recherche par nom");
      setShowSearch(true);
    }
  };
  handleScanRef.current = handleScan;

  useEffect(() => {
    if (!showSearch || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchProduits(searchQuery);
      setSearchResults(r);
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, showSearch]);

  async function submit() {
    if (!produit || !type || !depot || !employe || !photo) {
      toast.error("Remplissez tout : produit, type, photo");
      return;
    }
    if (quantite <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    if (type === "autre" && !motifLibre.trim()) {
      toast.error("Indiquez le motif libre");
      return;
    }
    setSubmitting(true);
    try {
      // Call vision coherence
      let iaScore: number | null = null;
      let iaNotes: string | null = null;
      try {
        const r = await fetch("/api/vision-coherence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            photo_data_url: photo,
            type,
            produit_nom: produit.nom,
            quantite,
          }),
        });
        if (r.ok) {
          const j = (await r.json()) as { coherence_score: number; notes: string };
          iaScore = j.coherence_score;
          iaNotes = j.notes;
        }
      } catch (err) {
        console.warn("vision call failed", err);
      }

      const sortie = await createSortie({
        depot_id: depot.id,
        employe_id: employe.id,
        produit_id: produit.id,
        type,
        motif_libre: type === "autre" ? motifLibre : undefined,
        quantite,
        photo_url: photo,
        ia_coherence_score: iaScore,
        ia_coherence_notes: iaNotes,
      });

      // Notify Otmane if low score
      if (iaScore !== null && iaScore < 0.6) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "sortie_low_coherence",
            payload: {
              sortie_id: sortie.id,
              depot: depot.nom,
              employe: `${employe.prenom} ${employe.nom}`,
              produit: produit.nom,
              quantite,
              type,
              ia_score: iaScore,
              ia_notes: iaNotes,
            },
          }),
        });
        toast.warning(
          `Score IA ${(iaScore * 100).toFixed(0)}% — Otmane notifié pour révision.`,
          { duration: 4000 }
        );
      } else if (iaScore !== null) {
        toast.success(
          `Sortie validée. Cohérence IA ${(iaScore * 100).toFixed(0)}%.`
        );
      } else {
        toast.success("Sortie validée.");
      }
      router.replace("/v2");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = produit && type && photo && quantite > 0 &&
    (type !== "autre" || motifLibre.trim().length > 0);

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-danger mt-3">Déclarer une sortie</p>
        <h1 className="h1 text-text-primary mt-1">Sortie de stock</h1>
        <p className="body-md text-text-secondary mt-1">
          L&apos;IA Claude analyse la cohérence photo/déclaration pour Otmane.
        </p>
      </header>

      {/* PRODUIT */}
      <section className="px-5 mt-6">
        <p className="label-caps text-text-tertiary mb-2">Produit</p>
        {produit ? (
          <div className="bg-white border border-rule rounded-2xl p-4 flex items-center gap-3">
            <ProductThumbnail
              nom={produit.nom}
              categorie={produit.categorie}
              size={48}
              rounded="xl"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">
                {produit.nom}
              </p>
              <p className="text-xs text-text-tertiary truncate">
                {produit.marque} · {produit.ean ?? "sans EAN"}
              </p>
            </div>
            <button
              onClick={() => {
                setProduit(null);
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="text-xs font-bold text-text-secondary"
            >
              Changer
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <ScanBarcode className="w-5 h-5" />
              <span className="font-bold">Scanner le produit</span>
            </button>
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="w-full bg-cream text-primary rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold border border-rule"
              >
                <Search className="w-4 h-4" />
                Rechercher par nom
              </button>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom, marque, code…"
                    className="input-field !pl-10"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProduit(p);
                        setShowSearch(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl active:bg-cream text-left"
                    >
                      <ProductThumbnail
                        nom={p.nom}
                        categorie={p.categorie}
                        size={36}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {p.nom}
                        </p>
                        <p className="text-xs text-text-tertiary truncate">
                          {p.marque}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* TYPE */}
      {produit && (
        <section className={`px-5 mt-6 ${!type ? "pb-cta-only" : ""}`}>
          <p className="label-caps text-text-tertiary mb-2">Motif de sortie</p>
          <div className="space-y-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                  type === t.value
                    ? "bg-danger-soft border-danger text-danger"
                    : "bg-white border-rule text-text-primary"
                }`}
              >
                <p className="text-sm font-bold">{t.label}</p>
                <p className={`text-xs mt-0.5 ${
                  type === t.value ? "text-danger/80" : "text-text-secondary"
                }`}>
                  {t.desc}
                </p>
              </button>
            ))}
          </div>
          {type === "autre" && (
            <input
              value={motifLibre}
              onChange={(e) => setMotifLibre(e.target.value)}
              placeholder="Détaillez le motif…"
              className="input-field mt-3"
              autoFocus
            />
          )}
        </section>
      )}

      {/* QUANTITÉ + PHOTO */}
      {produit && type && (
        <section className="px-5 mt-6 space-y-4 pb-cta-only">
          <div>
            <p className="label-caps text-text-tertiary mb-2">Quantité</p>
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={(e) => setQuantite(parseInt(e.target.value || "1", 10))}
              inputMode="numeric"
              className="input-field text-2xl font-bold text-center"
            />
          </div>

          <div>
            <p className="label-caps text-text-tertiary mb-2">
              Photo preuve <span className="text-danger ml-1">*</span>
            </p>
            {photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt="Preuve"
                  className="w-full h-44 object-cover rounded-2xl border border-rule"
                />
                <button
                  onClick={() => setPhotoOpen(true)}
                  className="absolute bottom-2 right-2 bg-white text-primary text-xs font-bold rounded-full px-3 py-1.5 shadow"
                >
                  Reprendre
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPhotoOpen(true)}
                className="w-full bg-cream border-2 border-dashed border-danger/40 rounded-2xl py-8 flex flex-col items-center gap-2 text-danger"
              >
                <Camera className="w-6 h-6" />
                <span className="text-sm font-bold">Prendre la photo</span>
                <span className="text-xs text-text-secondary">
                  Sans photo, l&apos;IA refusera la sortie
                </span>
              </button>
            )}
          </div>

          <div className="bg-cream border border-rule rounded-2xl p-3 flex items-start gap-2 text-xs text-text-secondary">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p>
              À la validation, Claude vision analyse la photo et compare avec
              ta déclaration. Score &lt; 0,60 → Otmane est notifié pour
              révision manuelle.
            </p>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full bg-danger text-white rounded-[22px] px-5 py-4 flex items-center justify-between shadow-card-lg disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
                {submitting ? "Validation…" : "Déclarer la sortie"}
              </p>
              <p className="text-[15px] font-extrabold mt-0.5">
                {produit
                  ? `${produit.nom.split(" ").slice(0, 4).join(" ")} · ${quantite}`
                  : "Choisir un produit"}
              </p>
            </div>
            <span className="bg-white/15 backdrop-blur-sm rounded-full p-2.5">
              {submitting ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Check className="w-5 h-5" />
              )}
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
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onCapture={(d) => setPhoto(d)}
      />
    </V2Shell>
  );
}
