"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ScanBarcode, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { BarcodeScanner } from "@/components/reception/BarcodeScanner";
import type { Category, Product, Unit } from "@/lib/types";
import { randomPickN } from "@/lib/utils/format";

const categories: Category[] = [
  "Épicerie",
  "Boucherie",
  "Charcuterie",
  "Boissons",
  "Surgelés",
  "Frais",
  "Produits du Maghreb",
  "Hygiène",
];

const units: { label: string; value: Unit }[] = [
  { label: "Pièce", value: "piece" },
  { label: "Kilo", value: "kg" },
  { label: "Litre", value: "L" },
];

export default function NouveauProduitPage() {
  const router = useRouter();
  const products = useStore((s) => s.products);
  const suppliers = useStore((s) => s.suppliers);
  const addProduct = useStore((s) => s.addProduct);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    brand: string;
    category: Category;
    barcode: string;
    supplier_id: string;
    purchase_price: string;
    sale_price: string;
    stock_theoretical: string;
    stock_min: string;
    unit: Unit;
    image_url: string;
  }>({
    name: "",
    brand: "",
    category: "Épicerie",
    barcode: "",
    supplier_id: suppliers[0]?.id ?? "",
    purchase_price: "",
    sale_price: "",
    stock_theoretical: "",
    stock_min: "",
    unit: "piece",
    image_url: "",
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function aiAutoFill() {
    setAiLoading(true);
    await new Promise((r) => setTimeout(r, 1600));
    const sample = randomPickN(products, 1)[0];
    if (!sample) {
      setAiLoading(false);
      return;
    }
    setForm({
      name: sample.name,
      brand: sample.brand,
      category: sample.category,
      barcode: sample.barcode,
      supplier_id: sample.supplier_id,
      purchase_price: String(sample.purchase_price),
      sale_price: String(sample.sale_price),
      stock_theoretical: String(sample.stock_theoretical),
      stock_min: String(sample.stock_min),
      unit: sample.unit,
      image_url: sample.image_url ?? "",
    });
    setAiLoading(false);
    toast.success("Fiche pré-remplie par l'assistant Salam.");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.brand || !form.barcode || !form.purchase_price || !form.sale_price) {
      toast.error("Renseigne au minimum nom, marque, code-barres et prix.");
      return;
    }
    const newProduct: Product = {
      id: "p-" + Date.now(),
      name: form.name,
      brand: form.brand,
      category: form.category,
      barcode: form.barcode,
      supplier_id: form.supplier_id,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      stock_theoretical: parseInt(form.stock_theoretical || "0", 10) || 0,
      stock_min: parseInt(form.stock_min || "0", 10) || 0,
      unit: form.unit,
      image_url: form.image_url || `https://picsum.photos/seed/${encodeURIComponent(form.name)}/400/400`,
      last_received_at: null,
    };
    addProduct(newProduct);
    toast.success("Produit créé !");
    router.replace("/catalogue");
  }

  return (
    <PageWrapper hideNav>
      <PageHeader
        label="STOCK"
        title="Nouveau produit"
        subtitle="Créer une fiche manuelle ou via l'assistant"
        showBack
      />

      <form onSubmit={submit} className="px-5 mt-5 space-y-4 pb-12">
        <button
          type="button"
          onClick={aiAutoFill}
          disabled={aiLoading}
          className="w-full bg-primary text-white rounded-[20px] p-4 flex items-center gap-3 shadow-card-lg active:scale-[0.99] transition-transform disabled:opacity-70"
        >
          <span className="w-12 h-12 rounded-2xl bg-gold/20 text-gold flex items-center justify-center">
            {aiLoading ? (
              <span className="w-5 h-5 rounded-full border-2 border-gold border-t-transparent animate-spin" />
            ) : (
              <Wand2 className="w-6 h-6" />
            )}
          </span>
          <span className="flex-1 text-left">
            <span className="block label-caps text-gold">CRÉER PAR PHOTO</span>
            <span className="block font-semibold">
              {aiLoading ? "Analyse de la photo en cours…" : "Reconnaissance produit (IA)"}
            </span>
          </span>
          <span className="badge !bg-gold-soft !text-[#8B6F0E] text-[10px]">
            <Sparkles className="w-3 h-3" /> Bêta
          </span>
        </button>
        <p className="text-xs text-text-tertiary -mt-2 px-2 inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-gold" />
          Propulsé par Claude · simulation pour la démonstration
        </p>

        <div className="bg-white rounded-[20px] shadow-card p-5 space-y-4">
          <Field label="Nom du produit *">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="input-field"
              placeholder="Ex : Olives Picholine vrac 1kg"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marque *">
              <input
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                className="input-field"
                placeholder="Maamora"
              />
            </Field>
            <Field label="Catégorie">
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value as Category)}
                className="input-field appearance-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Code-barres *">
            <div className="flex gap-2">
              <input
                value={form.barcode}
                onChange={(e) => update("barcode", e.target.value.replace(/[^0-9]/g, ""))}
                className="input-field flex-1"
                placeholder="EAN-13"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-4 py-2 bg-primary text-white rounded-2xl flex items-center gap-1.5 text-sm font-semibold"
              >
                <ScanBarcode className="w-4 h-4" /> Scan
              </button>
            </div>
          </Field>
          <Field label="Fournisseur">
            <select
              value={form.supplier_id}
              onChange={(e) => update("supplier_id", e.target.value)}
              className="input-field appearance-none"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix d'achat HT *">
              <input
                value={form.purchase_price}
                onChange={(e) => update("purchase_price", e.target.value)}
                className="input-field"
                placeholder="4,20"
                inputMode="decimal"
              />
            </Field>
            <Field label="Prix de vente *">
              <input
                value={form.sale_price}
                onChange={(e) => update("sale_price", e.target.value)}
                className="input-field"
                placeholder="6,90"
                inputMode="decimal"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Stock initial">
              <input
                value={form.stock_theoretical}
                onChange={(e) => update("stock_theoretical", e.target.value)}
                className="input-field"
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Stock mini">
              <input
                value={form.stock_min}
                onChange={(e) => update("stock_min", e.target.value)}
                className="input-field"
                placeholder="0"
                inputMode="numeric"
              />
            </Field>
            <Field label="Unité">
              <select
                value={form.unit}
                onChange={(e) => update("unit", e.target.value as Unit)}
                className="input-field appearance-none"
              >
                {units.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Photo (URL)">
            <div className="flex gap-2">
              <input
                value={form.image_url}
                onChange={(e) => update("image_url", e.target.value)}
                className="input-field flex-1"
                placeholder="Optionnel — généré sinon"
              />
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-cream text-text-tertiary rounded-2xl flex items-center gap-1.5 text-sm font-semibold cursor-not-allowed"
              >
                <Camera className="w-4 h-4" /> V2
              </button>
            </div>
          </Field>
        </div>

        <button type="submit" className="btn-primary w-full">
          <Check className="w-5 h-5" /> Créer le produit
        </button>
      </form>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          update("barcode", code);
          setScannerOpen(false);
          toast.success("Code-barres scanné");
        }}
      />
    </PageWrapper>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps text-text-tertiary block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
