"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { listEmployes, loginByPin } from "@/lib/db";
import { useV2 } from "@/lib/v2-store";
import type { Employe } from "@/lib/types/db";
import { V2Logo } from "@/components/v2/V2Logo";

const ROLE_LABEL: Record<string, string> = {
  manager: "Manager",
  admin: "Administrateur",
  reception: "Réception",
  preparation: "Préparation",
  caisse: "Caisse",
};

export default function V2LoginPage() {
  const router = useRouter();
  const hydrated = useV2((s) => s.hydrated);
  const employe = useV2((s) => s.currentEmploye);
  const setEmploye = useV2((s) => s.setCurrentEmploye);
  const setDepot = useV2((s) => s.setCurrentDepot);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [employes, setEmployesList] = useState<Employe[]>([]);
  const [shake, setShake] = useState(false);
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    void listEmployes().then(setEmployesList);
  }, []);

  useEffect(() => {
    if (hydrated && employe) router.replace("/v2");
  }, [hydrated, employe, router]);

  function press(d: string) {
    if (pin.length >= 4 || loading) return;
    setPin((p) => (p.length >= 4 ? p : p + d));
  }
  function back() {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
  }

  useEffect(() => {
    if (pin.length === 4 && !loading && submittedRef.current !== pin) {
      submittedRef.current = pin;
      setLoading(true);
      void (async () => {
        try {
          const e = await loginByPin(pin);
          if (!e) {
            toast.error("Code PIN incorrect", { id: "pin-error" });
            setShake(true);
            setTimeout(() => {
              setPin("");
              setShake(false);
              submittedRef.current = null;
            }, 380);
          } else {
            setEmploye(e);
            if (e.depot_principal_id) {
              const { listDepots } = await import("@/lib/db");
              const depots = await listDepots();
              const d = depots.find((x) => x.id === e.depot_principal_id);
              if (d) setDepot(d);
            }
            toast.success(`Bonjour ${e.prenom ?? e.nom}`, {
              id: `welcome-${e.id}`,
            });
            router.replace("/v2");
          }
        } catch (err) {
          console.error(err);
          toast.error("Erreur de connexion", { id: "pin-network-error" });
          setPin("");
          submittedRef.current = null;
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [pin, loading, setEmploye, setDepot, router]);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="mx-auto w-full max-w-[460px] flex-1 flex flex-col">
        <header className="gradient-header rounded-b-[28px] safe-top-hero pb-10 px-6 text-text-ondark relative overflow-hidden">
          {/* subtle texture: gold orb top-right */}
          <div
            aria-hidden
            className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-[0.15]"
            style={{
              background:
                "radial-gradient(closest-side, var(--accent-gold-bright), transparent 70%)",
            }}
          />
          <div className="flex items-center gap-3 mb-7 relative">
            <V2Logo size={40} variant="dark" />
            <div>
              <p className="label-caps text-gold">Salam Stock</p>
              <h1 className="text-[19px] font-bold leading-tight">
                Multi-dépôts · Toulouse
              </h1>
            </div>
          </div>
          <h2 className="display text-text-ondark relative">Code PIN</h2>
          <p className="body-md text-text-ondarkmuted mt-2 relative">
            Saisis tes 4 chiffres pour ouvrir ta session.
          </p>
        </header>

        <div className="flex-1 px-5 pt-9 pb-6 flex flex-col">
          <motion.div
            animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex justify-center gap-3.5 mb-9"
          >
            {[0, 1, 2, 3].map((i) => {
              const filled = pin.length > i;
              return (
                <motion.div
                  key={i}
                  animate={{
                    scale: filled ? [1, 1.18, 1] : 1,
                  }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl border-2 flex items-center justify-center transition-colors ${
                    filled
                      ? "bg-primary border-primary"
                      : "bg-white border-rule"
                  }`}
                >
                  <AnimatePresence>
                    {filled && (
                      <motion.span
                        key={`dot-${i}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="w-2.5 h-2.5 rounded-full bg-gold"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                onClick={() => press(String(d))}
                disabled={loading || pin.length >= 4}
                className="keypad-btn"
                aria-label={`Chiffre ${d}`}
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => press("0")}
              disabled={loading || pin.length >= 4}
              className="keypad-btn"
              aria-label="Chiffre 0"
            >
              0
            </button>
            <button
              onClick={back}
              disabled={pin.length === 0 || loading}
              className="aspect-square rounded-2xl bg-cream border border-rule flex items-center justify-center text-text-secondary active:scale-[0.96] transition-transform duration-150 ease-out disabled:opacity-30"
              aria-label="Effacer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-6 flex items-center justify-center gap-2 text-primary text-sm font-semibold"
              >
                <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
                Authentification…
              </motion.div>
            )}
          </AnimatePresence>

          {employes.length > 0 && (
            <div className="mt-10 px-1">
              <p className="label-caps text-text-tertiary mb-3 inline-flex items-center gap-1.5">
                <Fingerprint className="w-3 h-3" />
                Comptes démo
              </p>
              <ul className="space-y-1.5">
                {employes.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="mono font-bold tabular text-text-primary">
                        {e.pin_code}
                      </span>
                      <span className="text-text-secondary truncate">
                        {e.prenom} {e.nom}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary shrink-0">
                      {ROLE_LABEL[e.role] ?? e.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
