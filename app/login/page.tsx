"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/shared/Avatar";
import { FullPageLoader } from "@/components/shared/LoadingSpinner";
import type { User } from "@/lib/types";

const roleLabels: Record<User["role"], string> = {
  directeur: "Directeur",
  manager: "Manager",
  employe: "Employé",
};

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hasHydrated);
  const users = useStore((s) => s.users);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const currentUser = useStore((s) => s.currentUser);

  useEffect(() => {
    if (hydrated && currentUser) {
      router.replace(currentUser.role === "employe" ? "/reception" : "/dashboard");
    }
  }, [hydrated, currentUser, router]);

  if (!hydrated) return <FullPageLoader />;

  function selectUser(u: User) {
    setCurrentUser(u);
    router.replace(u.role === "employe" ? "/reception" : "/dashboard");
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-[460px] min-h-screen flex flex-col">
        <div className="gradient-header rounded-b-[28px] pt-14 pb-10 px-6 text-text-ondark">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gold flex items-center justify-center">
              <span className="text-primary-dark font-extrabold text-lg">S</span>
            </div>
            <div>
              <p className="label-caps text-gold">SALAM MARKET TOULOUSE</p>
              <h1 className="text-xl font-bold leading-tight">Salam Stock</h1>
            </div>
          </div>
          <h2 className="h1 mt-8">Bienvenue</h2>
          <p className="body-md text-text-ondarkmuted mt-1">
            Sélectionnez votre profil pour accéder à l&apos;application.
          </p>
        </div>

        <div className="flex-1 px-5 pt-6 pb-10 space-y-3">
          {users.map((u, i) => (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 }}
              onClick={() => selectUser(u)}
              className="w-full bg-white rounded-[20px] shadow-card p-4 flex items-center gap-4 active:scale-[0.99] transition-transform"
            >
              <Avatar initials={u.initials} size="lg" online />
              <div className="flex-1 text-left">
                <p className="text-base font-bold text-text-primary">{u.name}</p>
                <p className="text-sm text-text-secondary">{roleLabels[u.role]}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{u.email}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary" />
            </motion.button>
          ))}

          <div className="mt-6 px-2 flex items-start gap-2 text-text-tertiary">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Démonstration · les données sont locales et seront remplacées par
              la connexion Odoo en production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
