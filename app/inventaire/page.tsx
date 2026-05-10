"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ClipboardCheck,
  ClipboardList,
  History,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PhotoCapture } from "@/components/reception/PhotoCapture";
import { randomPickN } from "@/lib/utils/format";
import type { Inventory, InventoryItem, Product } from "@/lib/types";

interface CountState {
  product_id: string;
  stock_theoretical: number;
  count: string;
  photo: string | null;
}

const STORAGE_KEY = "salam-inventaire-en-cours";

export default function InventairePage() {
  const router = useRouter();
  const products = useStore((s) => s.products);
  const inventories = useStore((s) => s.inventories);
  const addInventory = useStore((s) => s.addInventory);
  const user = useStore((s) => s.currentUser);
  const hydrated = useStore((s) => s.hasHydrated);

  const [items, setItems] = useState<CountState[]>([]);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<{ conformite: number } | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    const cached = window.sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CountState[];
        setItems(parsed);
        return;
      } catch {
        /* ignore */
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const recentlyDone = new Set<string>();
    inventories
      .filter((i) => i.date.slice(0, 10) >= getDateOffset(-7))
      .forEach((i) => i.items.forEach((it) => recentlyDone.add(it.product_id)));
    const candidates = products.filter((p) => !recentlyDone.has(p.id));
    const pool = candidates.length >= 5 ? candidates : products;
    const picked = randomPickN(pool, 5);
    const fresh: CountState[] = picked.map((p) => ({
      product_id: p.id,
      stock_theoretical: p.stock_theoretical,
      count: "",
      photo: null,
    }));
    setItems(fresh);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    void today;
  }, [hydrated, inventories, products]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (items.length > 0)
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function update(productId: string, patch: Partial<CountState>) {
    setItems((prev) =>
      prev.map((it) => (it.product_id === productId ? { ...it, ...patch } : it))
    );
  }

  function openPhoto(productId: string) {
    focusedRef.current = productId;
    setPhotoFor(productId);
  }

  function handleCapture(dataUrl: string) {
    const id = focusedRef.current;
    if (!id) return;
    update(id, { photo: dataUrl });
  }

  const allCounted = items.length > 0 && items.every((it) => it.count.trim() !== "");
  const itemsWithEcart = items.filter((it) => {
    const c = parseInt(it.count || "0", 10);
    return !isNaN(c) && c !== it.stock_theoretical;
  });
  const ecartsNeedPhoto = itemsWithEcart.filter((it) => !it.photo);

  function validate() {
    if (!allCounted) {
      toast.error("Compte chaque produit avant de valider.");
      return;
    }
    if (ecartsNeedPhoto.length > 0) {
      toast.error("Photographie chaque produit en écart.");
      return;
    }
    if (!user) return;
    setSubmitting(true);
    const built: InventoryItem[] = items.map((it) => {
      const c = parseInt(it.count, 10);
      return {
        product_id: it.product_id,
        stock_theoretical: it.stock_theoretical,
        stock_compte: c,
        ecart: c - it.stock_theoretical,
        photo: it.photo,
      };
    });
    const totalEcart = built.reduce((s, it) => s + Math.abs(it.ecart), 0);
    const totalTheo = built.reduce((s, it) => s + it.stock_theoretical, 0);
    const conformite = totalTheo > 0 ? Math.max(0, 100 - (totalEcart / totalTheo) * 100) : 100;
    const inv: Inventory = {
      id: "inv-" + Date.now(),
      date: new Date().toISOString(),
      user_id: user.id,
      items: built,
      status: "termine",
      conformite_pct: parseFloat(conformite.toFixed(1)),
    };
    addInventory(inv);
    if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
    setSubmitting(false);
    setResultModal({ conformite: inv.conformite_pct });
  }

  function closeAndContinue() {
    setResultModal(null);
    router.replace("/inventaire/historique");
  }

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  return (
    <PageWrapper>
      <PageHeader
        label="OPÉRATIONS"
        title="Inventaire tournant"
        subtitle={`5 produits à compter · assigné à ${user?.name ?? ""}`}
        rightSlot={
          <Link
            href="/inventaire/historique"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-ondark"
            aria-label="Historique"
          >
            <History className="w-5 h-5" />
          </Link>
        }
      />

      <div className="px-5 mt-4">
        <div className="bg-gold-soft rounded-[20px] px-4 py-3 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center text-primary-dark shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-primary-dark">
              Sélection aléatoire intelligente
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Produits non comptés depuis 7+ jours, priorisés par l&apos;assistant Salam.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3 pb-40">
        {items.map((it, idx) => {
          const product = productMap.get(it.product_id);
          if (!product) return null;
          const c = parseInt(it.count || "0", 10);
          const ecart = isNaN(c) ? 0 : c - it.stock_theoretical;
          const hasEcart = it.count !== "" && ecart !== 0;
          return (
            <motion.div
              key={it.product_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white rounded-[20px] shadow-card p-4"
            >
              <div className="flex gap-3">
                <div
                  className="w-16 h-16 rounded-xl bg-cream shrink-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${product.image_url})` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary leading-tight line-clamp-2">
                    {product.name}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5 truncate">
                    {product.brand} · {product.category}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 gap-3">
                <div>
                  <p className="label-caps text-text-tertiary">THÉORIQUE</p>
                  <p className="text-lg font-bold text-text-primary mt-0.5">
                    {it.stock_theoretical}
                  </p>
                </div>
                <div>
                  <p className="label-caps text-text-tertiary text-right">COMPTÉ</p>
                  <input
                    inputMode="numeric"
                    value={it.count}
                    onChange={(e) => update(it.product_id, { count: e.target.value.replace(/[^0-9]/g, "") })}
                    placeholder="—"
                    className="w-20 mt-0.5 text-center text-lg font-bold rounded-xl border border-line-light bg-cream py-1.5 outline-none focus:border-primary"
                  />
                </div>
              </div>
              {hasEcart && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="badge badge-warning">
                    Écart {ecart > 0 ? "+" : ""}
                    {ecart} unité{Math.abs(ecart) > 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => openPhoto(it.product_id)}
                    className={`text-xs font-semibold inline-flex items-center gap-1 px-3 py-2 rounded-full ${
                      it.photo ? "bg-success-soft text-success" : "bg-cream text-primary"
                    }`}
                  >
                    {it.photo ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Photo OK
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" /> Photo requise
                      </>
                    )}
                  </button>
                </div>
              )}
              {it.photo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={it.photo}
                  alt="Photo écart"
                  className="mt-3 w-20 h-20 rounded-xl object-cover border border-line-light"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 pb-safe">
        <div className="mx-auto max-w-[460px] px-4 pt-2 pb-3">
          <div className="bg-primary rounded-[24px] shadow-card-lg px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="label-caps text-gold">INVENTAIRE</p>
              <p className="text-white font-semibold text-sm">
                {items.filter((i) => i.count).length}/{items.length} comptés · {ecartsNeedPhoto.length} photos manquantes
              </p>
            </div>
            <button
              disabled={!allCounted || ecartsNeedPhoto.length > 0 || submitting}
              onClick={validate}
              className="btn-gold !py-3 !px-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ClipboardCheck className="w-4 h-4" />
              {submitting ? "…" : "Valider"}
            </button>
          </div>
        </div>
      </div>

      <PhotoCapture
        open={!!photoFor}
        onClose={() => setPhotoFor(null)}
        onCapture={handleCapture}
      />

      {resultModal && (
        <div className="fixed inset-0 z-[70] fixed-overlay flex items-end justify-center">
          <div className="bg-white w-full max-w-[460px] rounded-t-[28px] p-7 pb-10 animate-slide-up text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-success-soft flex items-center justify-center mb-3">
              <ClipboardCheck className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-2xl font-extrabold text-text-primary">
              {resultModal.conformite >= 99 ? "Bravo !" : "Inventaire validé"}
            </h3>
            <p className="text-sm text-text-secondary mt-2">
              Conformité <span className="font-bold text-text-primary">{resultModal.conformite.toFixed(1)}%</span> sur les 5 produits comptés.
            </p>
            {resultModal.conformite < 95 && (
              <p className="text-xs text-warning mt-3 inline-flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" />
                Ahmed a été notifié pour vérification.
              </p>
            )}
            <button
              onClick={closeAndContinue}
              className="btn-primary w-full mt-6"
            >
              Voir l&apos;historique
            </button>
            <button
              onClick={() => {
                setResultModal(null);
                window.location.reload();
              }}
              className="text-sm text-text-secondary mt-3"
            >
              Lancer un autre tirage
            </button>
          </div>
        </div>
      )}

    </PageWrapper>
  );
}

function getDateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
