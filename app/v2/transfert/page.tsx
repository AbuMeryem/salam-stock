"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  Repeat2,
  ScanBarcode,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import {
  createTransfert,
  findProduitByEan,
  listDepots,
  listProduitsInDepot,
  searchProduits,
} from "@/lib/db";
import type { Depot, Produit, ProduitInDepot } from "@/lib/types/db";

export default function V2TransfertPage() {
  const router = useRouter();
  const employe = useV2((s) => s.currentEmploye);
  const currentDepot = useV2((s) => s.currentDepot);

  const [depots, setDepots] = useState<Depot[]>([]);
  const [source, setSource] = useState<Depot | null>(null);
  const [destination, setDestination] = useState<Depot | null>(null);

  const [produit, setProduit] = useState<Produit | null>(null);
  const [stockSource, setStockSource] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProduitInDepot[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [quantite, setQuantite] = useState<number | "">("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Règle métier transferts inter-dépôts ───────────────────
  // L'employé est rattaché à UN dépôt (employe.depot_principal_id).
  // Tous ses transferts sont INBOUND vers son dépôt. Le source dispo
  // dépend de son dépôt :
  //   Employé Particulier → reçoit depuis Pro
  //   Employé Sodrune     → reçoit depuis Pro
  //   Employé Pro         → reçoit depuis Particulier OU Sodrune
  // Les admins n'ont pas de restriction (peuvent piloter n'importe
  // quel transfert pour réajustement).
  const ALLOWED_SOURCES_FOR_DEST: Record<string, string[]> = {
    Particulier: ["Professionnel"],
    Sodrune: ["Professionnel"],
    Professionnel: ["Particulier", "Sodrune"],
  };
  const isAdmin = employe?.role === "admin";

  useEffect(() => {
    void listDepots().then((d) => {
      setDepots(d);
      // Destination forcée au dépôt principal de l'employé (sauf admin
      // qui peut tout faire et garde le current depot du switcher).
      if (!isAdmin && employe?.depot_principal_id) {
        const own = d.find((x) => x.id === employe.depot_principal_id);
        if (own) setDestination(own);
      } else if (isAdmin && currentDepot) {
        setDestination(currentDepot);
      }
    });
  }, [currentDepot, employe?.depot_principal_id, isAdmin]);

  function allowedSources(dest: Depot | null): Depot[] {
    if (!dest) return [];
    if (isAdmin) return depots.filter((d) => d.id !== dest.id);
    const allowedNames = ALLOWED_SOURCES_FOR_DEST[dest.nom] ?? [];
    return depots.filter((d) => allowedNames.includes(d.nom));
  }

  useEffect(() => {
    if (!produit || !source) {
      setStockSource(null);
      return;
    }
    void listProduitsInDepot(source.id).then((list) => {
      const item = list.find((p) => p.id === produit.id);
      setStockSource(item?.quantite ?? 0);
    });
  }, [produit, source]);

  // search ⇒ filter to source depot stock
  useEffect(() => {
    if (!showSearch || !source || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const sourceStock = await listProduitsInDepot(source.id);
      const all = await searchProduits(searchQuery);
      const allIds = new Set(all.map((p) => p.id));
      setSearchResults(sourceStock.filter((p) => allIds.has(p.id)));
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, showSearch, source]);

  const handleScanRef = useRef<((c: string) => void) | undefined>(undefined);
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

  async function submit() {
    if (!source || !destination || !produit || !employe) {
      toast.error("Source, destination et produit requis");
      return;
    }
    if (source.id === destination.id) {
      toast.error("Source et destination doivent être différentes");
      return;
    }
    if (quantite === "" || quantite <= 0) {
      toast.error("Saisis une quantité supérieure à 0");
      return;
    }
    if (stockSource !== null && quantite > stockSource) {
      toast.error(`Stock source insuffisant (${stockSource} disponibles)`);
      return;
    }
    setSubmitting(true);
    const startedAt = Date.now();
    try {
      console.log("[Transfert] submit payload", {
        source: source.nom,
        destination: destination.nom,
        produit: produit.nom,
        quantite,
        hasPhoto: !!photo,
      });
      const result = await createTransfert({
        depot_source_id: source.id,
        depot_destination_id: destination.id,
        produit_id: produit.id,
        quantite,
        employe_id: employe.id,
        photo_url: photo ?? undefined,
      });
      console.log(
        `[Transfert] succès en ${Date.now() - startedAt}ms`,
        result?.id
      );
      // Push iPhone admin — transfert audit
      void import("@/lib/notifications").then((m) =>
        m.pushToAdmins({
          title: `🔄 Transfert ${source.nom} → ${destination.nom}`,
          body: `${produit.nom} × ${quantite} · par ${employe.prenom ?? "employé"}`,
          url: "/v2/admin/activite",
          tag: `trf-${result?.id ?? Date.now()}`,
        })
      );
      toast.success(
        `Transfert validé : ${quantite} × ${produit.nom} de ${source.nom} → ${destination.nom}`
      );
      router.replace("/v2");
    } catch (err) {
      console.error("[Transfert] échec", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Transfert refusé : ${msg.slice(0, 160)}`, {
        duration: 8000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Bouton actif dès qu'une source/dest/produit valides sont choisis ;
  // la quantité est validée au clic (vide / 0 / supérieure au stock → toast).
  const canSubmit =
    !!source && !!destination && source.id !== destination.id && !!produit;

  return (
    <V2Shell hideNav>
      <PageAccentStripe accent="or" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-gold mt-3">Transfert inter-dépôt</p>
        <h1 className="h1 text-text-primary mt-1">Bouger du stock</h1>
      </header>

      {/* SOURCE → DESTINATION (destination lockée au dépôt de l'employé
          sauf admin qui peut tout piloter) */}
      <section className="px-5 mt-6">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <DepotPick
            label="Source"
            depots={allowedSources(destination)}
            value={source}
            onChange={setSource}
          />
          <ArrowRight className="w-5 h-5 text-text-tertiary" />
          {isAdmin ? (
            <DepotPick
              label="Destination"
              depots={depots.filter((d) => d.id !== source?.id)}
              value={destination}
              onChange={(d) => {
                setDestination(d);
                if (source?.id === d.id) setSource(null);
              }}
            />
          ) : (
            <DepotLocked label="Vers votre dépôt" depot={destination} />
          )}
        </div>
        {!isAdmin && (
          <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
            Tu peux faire entrer du stock vers <b>{destination?.nom ?? "—"}</b>{" "}
            depuis{" "}
            <b>
              {allowedSources(destination)
                .map((d) => d.nom)
                .join(" ou ") || "—"}
            </b>
            . Demande à un admin pour les autres directions.
          </p>
        )}
      </section>

      {/* PRODUIT */}
      {source && destination && (
        <section className="px-5 mt-6">
          <p className="label-caps text-text-tertiary mb-2">
            Produit à transférer (depuis {source.nom})
          </p>
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
                <p className="text-xs text-text-tertiary">
                  Stock source : <span className="font-bold text-text-primary">{stockSource ?? "…"}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setProduit(null);
                  setShowSearch(false);
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
                className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-center gap-2"
              >
                <ScanBarcode className="w-5 h-5" />
                <span className="font-bold">Scanner</span>
              </button>
              {!showSearch ? (
                <button
                  onClick={() => setShowSearch(true)}
                  className="w-full bg-cream text-primary rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold border border-rule"
                >
                  <Search className="w-4 h-4" />
                  Rechercher par nom (filtré sur {source.nom})
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
                  <div className="space-y-1 max-h-64 overflow-y-auto">
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
                          <p className="text-xs text-text-tertiary">
                            {p.quantite} en stock
                          </p>
                        </div>
                      </button>
                    ))}
                    {searchQuery.length >= 2 && searchResults.length === 0 && (
                      <p className="text-xs text-text-tertiary text-center py-4">
                        Aucun produit dans {source.nom}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* QUANTITÉ + PHOTO */}
      {produit && (
        <section className="px-5 mt-6 space-y-4">
          <div>
            <p className="label-caps text-text-tertiary mb-2">Quantité à transférer</p>
            <input
              type="number"
              min={1}
              max={stockSource ?? undefined}
              value={quantite}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") setQuantite("");
                else {
                  const n = parseInt(v, 10);
                  setQuantite(Number.isNaN(n) ? "" : n);
                }
              }}
              placeholder={stockSource !== null ? `0 — ${stockSource} max` : "Quantité"}
              inputMode="numeric"
              className="input-field text-2xl font-bold text-center"
            />
          </div>

          <div>
            <p className="label-caps text-text-tertiary mb-2">Photo (optionnel)</p>
            {photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt="Transfert"
                  className="w-full h-36 object-cover rounded-2xl border border-rule"
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
                className="w-full bg-cream border border-dashed border-rule rounded-2xl py-5 flex items-center justify-center gap-2 text-text-secondary text-sm"
              >
                <Camera className="w-4 h-4" />
                Ajouter une photo
              </button>
            )}
          </div>
        </section>
      )}

      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full bg-gold text-primary-dark rounded-[22px] px-5 py-4 flex items-center justify-between shadow-card-lg disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-dark/70">
                {submitting ? "Validation…" : "Valider le transfert"}
              </p>
              <p className="text-[15px] font-extrabold mt-0.5">
                {source?.nom ?? "—"} → {destination?.nom ?? "—"}
              </p>
            </div>
            <span className="bg-white/30 rounded-full p-2.5">
              <Repeat2 className="w-5 h-5" />
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

function DepotPick({
  label,
  depots,
  value,
  onChange,
}: {
  label: string;
  depots: Depot[];
  value: Depot | null;
  onChange: (d: Depot) => void;
}) {
  return (
    <div>
      <p className="label-caps text-text-tertiary mb-2 text-center">{label}</p>
      <select
        value={value?.id ?? ""}
        onChange={(e) => {
          const d = depots.find((x) => x.id === e.target.value);
          if (d) onChange(d);
        }}
        className="w-full bg-white border border-rule rounded-2xl px-3 py-3 text-sm font-bold text-text-primary appearance-none text-center"
      >
        <option value="">— choisir —</option>
        {depots.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nom}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Champ destination en lecture seule pour un employé non-admin :
 *  on affiche son dépôt sapin et figé, pour qu'il sache où arrive le stock
 *  sans pouvoir le changer. */
function DepotLocked({
  label,
  depot,
}: {
  label: string;
  depot: Depot | null;
}) {
  return (
    <div>
      <p className="label-caps text-text-tertiary mb-2 text-center">{label}</p>
      <div className="w-full bg-primary text-white rounded-2xl px-3 py-3 text-sm font-bold text-center inline-flex items-center justify-center gap-1.5">
        <Building2 className="w-3.5 h-3.5 text-gold" />
        {depot?.nom ?? "—"}
      </div>
    </div>
  );
}
