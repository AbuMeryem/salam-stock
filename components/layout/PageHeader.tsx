"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings2 } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  label: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showAvatar?: boolean;
  showSettings?: boolean;
  variant?: "dark" | "light";
  rightSlot?: ReactNode;
  className?: string;
}

export function PageHeader({
  label,
  title,
  subtitle,
  showBack,
  showAvatar = true,
  showSettings = false,
  variant = "dark",
  rightSlot,
  className,
}: PageHeaderProps) {
  const router = useRouter();
  const user = useStore((s) => s.currentUser);

  if (variant === "light") {
    return (
      <header className={cn("bg-cream pt-12 pb-6 px-5", className)}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => router.back()}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-primary"
                aria-label="Retour"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <span className="label-caps-md text-primary">{label}</span>
          </div>
          {rightSlot}
        </div>
        <h1 className="h1 text-text-primary">{title}</h1>
        {subtitle && (
          <p className="body-md text-text-secondary mt-1">{subtitle}</p>
        )}
      </header>
    );
  }

  return (
    <header
      className={cn(
        "gradient-header text-text-ondark relative pt-12 pb-7 px-5",
        "rounded-b-[28px]",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-text-ondark"
              aria-label="Retour"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showSettings && (
            <button
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-ondark"
              aria-label="Paramètres"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}
          {rightSlot}
          {showAvatar && user && <Avatar initials={user.initials} online size="md" />}
        </div>
      </div>
      <span className="label-caps-md text-gold">{label}</span>
      <h1 className="h1 text-text-ondark mt-1">{title}</h1>
      {subtitle && (
        <p className="body-md text-text-ondarkmuted mt-1">{subtitle}</p>
      )}
    </header>
  );
}
