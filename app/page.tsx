"use client";

/**
 * Root page — V2 is the default product since 2026-05-11.
 * - Authenticated employee (V2 PIN session) → /v2
 * - Otherwise → /v2/login
 *
 * The V1 routes (/login, /dashboard, /reception, /catalogue, etc.) remain
 * accessible via direct URL, but are no longer the default destination.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useV2 } from "@/lib/v2-store";
import { FullPageLoader } from "@/components/shared/LoadingSpinner";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useV2((s) => s.hydrated);
  const employe = useV2((s) => s.currentEmploye);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(employe ? "/v2" : "/v2/login");
  }, [hydrated, employe, router]);

  return <FullPageLoader />;
}
