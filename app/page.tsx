"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { FullPageLoader } from "@/components/shared/LoadingSpinner";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hasHydrated);
  const user = useStore((s) => s.currentUser);

  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      if (user.role === "employe") router.replace("/reception");
      else router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  return <FullPageLoader />;
}
