"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, ClipboardList, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const items = [
  { label: "Accueil", href: "/dashboard", icon: Home, match: ["/dashboard"] },
  { label: "Stock", href: "/catalogue", icon: Package, match: ["/catalogue", "/inventaire"] },
  { label: "Commandes", href: "/reception", icon: ClipboardList, match: ["/reception"] },
  { label: "Compte", href: "/compte", icon: UserIcon, match: ["/compte", "/alertes", "/assistant"] },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="mx-auto max-w-[460px] px-4 pb-2">
        <div className="bg-white/95 backdrop-blur-xl rounded-[28px] shadow-card-lg border border-line-light px-2 py-2 flex items-center justify-around">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.match.some((m) =>
              m === "/dashboard" ? pathname === m : pathname.startsWith(m)
            );
            return (
              <Link
                key={item.label}
                href={item.href}
                className="relative flex flex-col items-center justify-center px-3 py-2 min-w-[70px]"
              >
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gold" />
                )}
                <Icon
                  className={cn(
                    "w-[22px] h-[22px] mb-0.5 transition-colors",
                    active ? "text-primary" : "text-text-tertiary"
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-wide transition-colors",
                    active ? "text-primary" : "text-text-tertiary"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
