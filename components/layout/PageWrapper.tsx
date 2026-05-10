"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { BottomNav } from "./BottomNav";
import { FullPageLoader } from "@/components/shared/LoadingSpinner";

interface PageWrapperProps {
  children: ReactNode;
  hideNav?: boolean;
  requireAuth?: boolean;
  className?: string;
}

export function PageWrapper({
  children,
  hideNav = false,
  requireAuth = true,
  className = "",
}: PageWrapperProps) {
  const router = useRouter();
  const hydrated = useStore((s) => s.hasHydrated);
  const user = useStore((s) => s.currentUser);

  useEffect(() => {
    if (hydrated && requireAuth && !user) {
      router.replace("/login");
    }
  }, [hydrated, requireAuth, user, router]);

  if (!hydrated) return <FullPageLoader />;
  if (requireAuth && !user) return <FullPageLoader />;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-[460px] min-h-screen bg-cream relative">
        <motion.main
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`${className} ${hideNav ? "pb-6" : "pb-32"}`}
        >
          {children}
        </motion.main>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
