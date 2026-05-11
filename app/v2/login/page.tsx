"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Delete, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { listEmployes, loginByPin } from "@/lib/db";
import { useV2 } from "@/lib/v2-store";
import type { Employe } from "@/lib/types/db";
import { V2Logo } from "@/components/v2/V2Logo";

export default function V2LoginPage() {
  const router = useRouter();
  const hydrated = useV2((s) => s.hydrated);
  const employe = useV2((s) => s.currentEmploye);
  const setEmploye = useV2((s) => s.setCurrentEmploye);
  const setDepot = useV2((s) => s.setCurrentDepot);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [employes, setEmployesList] = useState<Employe[]>([]);
  /** Once a PIN has been accepted we never want loginByPin to run a 2nd
   *  time, even if the auto-submit useEffect re-renders. */
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    void listEmployes().then(setEmployesList);
  }, []);

  useEffect(() => {
    if (hydrated && employe) router.replace("/v2");
  }, [hydrated, employe, router]);

  function press(d: string) {
    if (pin.length >= 4) return;
    setPin(pin + d);
  }
  function back() {
    setPin(pin.slice(0, -1));
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
            setPin("");
            submittedRef.current = null;
          } else {
            setEmploye(e);
            // Auto-select employee's primary depot
            if (e.depot_principal_id) {
              const { listDepots } = await import("@/lib/db");
              const depots = await listDepots();
              const d = depots.find((x) => x.id === e.depot_principal_id);
              if (d) setDepot(d);
            }
            // Stable id deduplicates if the effect re-fires (React 18
            // concurrent rendering can run the auto-submit useEffect more
            // than once on rapid PIN entry).
            toast.success(`Bonjour ${e.prenom ?? e.nom}`, {
              id: `welcome-${e.id}`,
            });
            router.replace("/v2");
          }
        } catch (err) {
          console.error(err);
          toast.error("Erreur de connexion");
          setPin("");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [pin, loading, setEmploye, setDepot, router]);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="mx-auto w-full max-w-[460px] flex-1 flex flex-col">
        <header className="gradient-header rounded-b-[28px] pt-14 pb-10 px-6 text-text-ondark">
          <div className="flex items-center gap-3 mb-6">
            <V2Logo size={36} variant="dark" />
            <div>
              <p className="label-caps text-gold">Salam Stock</p>
              <h1 className="text-xl font-bold leading-tight">
                Multi-dépôts · Toulouse
              </h1>
            </div>
          </div>
          <h2 className="h1 text-text-ondark">Code PIN</h2>
          <p className="body-md text-text-ondarkmuted mt-1">
            Tape ton code à 4 chiffres pour ouvrir ta session.
          </p>
        </header>

        <div className="flex-1 px-5 pt-8 pb-6 flex flex-col">
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: pin.length > i ? 1.1 : 1,
                }}
                transition={{ duration: 0.12 }}
                className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl font-bold ${
                  pin.length > i
                    ? "bg-primary border-primary text-white"
                    : "bg-white border-rule text-text-tertiary"
                }`}
              >
                {pin.length > i ? "•" : ""}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                onClick={() => press(String(d))}
                disabled={loading || pin.length >= 4}
                className="aspect-square rounded-2xl bg-white shadow-card text-2xl font-bold text-text-primary active:scale-95 transition-transform disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => press("0")}
              disabled={loading || pin.length >= 4}
              className="aspect-square rounded-2xl bg-white shadow-card text-2xl font-bold text-text-primary active:scale-95 transition-transform disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={back}
              disabled={pin.length === 0 || loading}
              className="aspect-square rounded-2xl bg-cream border border-rule flex items-center justify-center text-text-secondary active:scale-95 transition-transform disabled:opacity-50"
              aria-label="Effacer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-10 px-2">
            <p className="label-caps text-text-tertiary mb-2">
              <KeyRound className="w-3 h-3 inline mr-1" />
              Codes démo
            </p>
            <ul className="text-xs text-text-secondary space-y-0.5">
              {employes.map((e) => (
                <li key={e.id}>
                  <span className="font-mono font-bold text-text-primary">
                    {e.pin_code}
                  </span>
                  {" — "}
                  {e.prenom} {e.nom} ({e.role})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
