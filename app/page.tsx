"use client";

/**
 * Root page — V2 est la destination par défaut depuis 2026-05-11.
 * Affiche d'abord un splash screen 1.5s (web first-visit) puis
 * redirige vers /v2 (auth) ou /v2/login (anon).
 *
 * Pour la PWA installée iPhone, iOS affiche son propre splash via
 * les <link rel="apple-touch-startup-image"> définis dans app/layout.tsx,
 * et n'utilise PAS ce composant — donc le double splash est évité.
 *
 * Skip auto si l'utilisateur a déjà vu le splash dans cette session
 * (sessionStorage). Les V1 routes (/login, /dashboard, /reception,
 * /catalogue) restent accessibles via URL directe.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useV2 } from "@/lib/v2-store";
import { SplashScreen } from "@/components/v2/SplashScreen";

const SPLASH_KEY = "salam-splash-seen";
const SPLASH_DURATION_MS = 1500;

export default function HomePage() {
  const router = useRouter();
  const hydrated = useV2((s) => s.hydrated);
  const employe = useV2((s) => s.currentEmploye);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const already = window.sessionStorage.getItem(SPLASH_KEY);
    if (already) {
      setShowSplash(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!showSplash) {
      router.replace(employe ? "/v2" : "/v2/login");
      return;
    }
    const t = setTimeout(() => {
      try {
        window.sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* ignore */
      }
      router.replace(employe ? "/v2" : "/v2/login");
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [hydrated, employe, router, showSplash]);

  return <SplashScreen />;
}
