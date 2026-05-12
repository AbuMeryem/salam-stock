"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Tag } from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";
import { ProductThumbnail } from "@/components/v2/ProductThumbnail";
import { useV2 } from "@/lib/v2-store";
import { listProduitsInDepot } from "@/lib/db";
import type { ProduitInDepot } from "@/lib/types/db";

export default function V2EtiquettesPage() {
  const router = useRouter();
  const depot = useV2((s) => s.currentDepot);
  const [items, setItems] = useState<ProduitInDepot[]>([]);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!depot) return;
    void listProduitsInDepot(depot.id).then((all) => {
      // Show only products requiring an internal barcode print.
      // Fall back to all 290-prefix EANs for the demo.
      const filtered = all.filter(
        (p) => p.requires_barcode_print || p.ean?.startsWith("290")
      );
      setItems(filtered);
    });
  }, [depot]);

  const totalCopies = useMemo(
    () => Object.values(copies).reduce((s, n) => s + n, 0),
    [copies]
  );

  async function generate() {
    const selected = items.filter((p) => (copies[p.id] ?? 0) > 0);
    if (selected.length === 0) {
      toast.error("Indique au moins une quantité d'étiquettes");
      return;
    }
    setGenerating(true);
    try {
      const { buildLabelsPdf } = await import("@/lib/labels/generate-pdf");
      // Expand each selected product by its copy count for the PDF builder.
      const expanded = selected.flatMap((p) =>
        Array.from({ length: copies[p.id] }).map(() => ({
          produitNom: p.nom,
          marque: p.marque,
          ean: p.ean ?? "",
        }))
      );
      const finalBlob = await buildLabelsPdf(expanded, 1);
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiquettes-salam-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${expanded.length} étiquette${expanded.length > 1 ? "s" : ""} générée${expanded.length > 1 ? "s" : ""}`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <V2Shell>
      <PageAccentStripe accent="sapin" />
      <header className="px-5 pt-7">
        <BackButton />
        <p className="label-caps text-primary mt-3">Étiquettes barcode internes</p>
        <h1 className="h1 text-text-primary mt-1">Imprimer les EAN-13</h1>
        <p className="body-md text-text-secondary mt-1">
          Format Brother QL-820, 62×29 mm. Préfixe 290 pour les codes internes.
        </p>
      </header>

      <section className="px-5 mt-6">
        {items.length === 0 ? (
          <div className="bg-cream border border-rule rounded-2xl p-6 text-center text-sm text-text-secondary">
            Aucun produit nécessitant un code-barres interne dans ce dépôt.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => {
              const n = copies[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-rule rounded-xl p-3 flex items-center gap-3"
                >
                  <ProductThumbnail nom={p.nom} categorie={p.categorie} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {p.nom}
                    </p>
                    <p className="text-[11px] text-text-tertiary font-mono">
                      {p.ean}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={n || ""}
                    onChange={(e) =>
                      setCopies((c) => ({
                        ...c,
                        [p.id]: parseInt(e.target.value || "0", 10),
                      }))
                    }
                    placeholder="0"
                    inputMode="numeric"
                    className="w-16 text-center bg-cream border border-rule rounded-xl py-2 text-sm font-bold"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {totalCopies > 0 && (
        <section className="px-5 mt-6">
          <button
            onClick={generate}
            disabled={generating}
            className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span className="font-bold">
              Générer {totalCopies} étiquette{totalCopies > 1 ? "s" : ""}
            </span>
          </button>
          <p className="text-xs text-text-tertiary text-center mt-2 inline-flex items-center gap-1 justify-center w-full">
            <Tag className="w-3 h-3" />
            Le PDF s&apos;ouvre dans le navigateur, à imprimer sur l&apos;imprimante Brother.
          </p>
        </section>
      )}
    </V2Shell>
  );
}
