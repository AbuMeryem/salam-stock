"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Repeat2,
  ScanBarcode,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
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
  const [quantite, setQuantite] = useState<number>(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void listDepots().then((d) => {
      setDepots(d);
      if (currentDepot) setSource(currentDepot);
    });
  }, [currentDepot]);

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
    if (quantite <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    if (stockSource !== null && quantite > stockSource) {
      toast.error(`Stock source insuffisant (${stockSource} disponibles)`);
      return;
    }
    setSubmitting(true);
    try {
      await createTransfert({
        depot_source_id: source.id,
        depot_destination_id: destination.id,
        produit_id: produit.id,
        quantite,
        employe_id: employe.id,
        photo_url: photo ?? undefined,
      });
      toast.success(
        `Transfert validé : ${quantite} × ${produit.nom} de ${source.nom} → ${destination.nom}`
      );
      router.replace("/v2");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    source && destination && source.id !== destination.id && produit && quantite > 0;

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="label-caps text-gold mt-3">Transfert inter-dépôt</p>
        <h1 className="h1 text-text-primary mt-1">Bouger du stock</h1>
      </header>

      {/* SOURCE / DESTINATION */}
      <section className="px-5 mt-6">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <DepotPick
            label="Source"
            depots={depots}
            value={source}
            onChange={(d) => {
              setSource(d);
              if (destination?.id === d.id) setDestination(null);
            }}
          />
          <ArrowRight className="w-5 h-5 text-text-tertiary" />
          <DepotPick
            label="Destination"
            depots={depots.filter((d) => d.id !== source?.id)}
            value={destination}
            onChange={setDestination}
          />
        </div>
      </section>

      {/* PRODUIT */}
      {source && destination && (
        <section className="px-5 mt-6">
          <p className="label-caps text-text-tertiary mb-2">
            Produit à transférer (depuis {source.nom})
          </p>
          {produit ? (
            <div className="bg-white border border-rule rounded-2xl p-4 flex items-center gap-3">
              <span
                className="w-12 h-12 rounded-xl bg-cream bg-cover bg-center shrink-0"
                style={produit.image_url ? { backgroundImage: `url(${produit.image_url})` } : {}}
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
                        <span
                          className="w-9 h-9 rounded-lg bg-cream bg-cover bg-center shrink-0"
                          style={p.image_url ? { backgroundImage: `url(${p.image_url})` } : {}}
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
              onChange={(e) => setQuantite(parseInt(e.target.value || "1", 10))}
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
