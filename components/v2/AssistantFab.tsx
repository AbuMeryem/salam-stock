"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

/**
 * Bouton flottant style chatbot SAV qui amène sur /v2/admin/assistant-ia.
 * Visible uniquement pour les admins. Sticky bottom-right au-dessus de
 * la nav. Caché sur la page assistant elle-même (évite la redondance).
 */
interface Props {
  role: string | undefined;
  /** Cache si la nav est masquée (modes plein-écran type scan/réception). */
  hideOnNoNav?: boolean;
}

export function AssistantFab({ role, hideOnNoNav = false }: Props) {
  const pathname = usePathname() ?? "";
  if (role !== "admin") return null;
  if (pathname.startsWith("/v2/admin/assistant-ia")) return null;
  if (hideOnNoNav) return null;

  return (
    <Link
      href="/v2/admin/assistant-ia"
      aria-label="Assistant IA"
      className="fixed z-[55] bottom-[calc(var(--nav-height,64px)+var(--safe-bottom,0px)+36px)] right-4 w-14 h-14 rounded-full shadow-card-lg flex items-center justify-center bg-gradient-to-br from-[#0E3B2E] to-[#082A20] active:scale-95 transition-transform"
    >
      <span className="absolute -inset-1 rounded-full bg-gold-bright/30 animate-ping opacity-60" />
      <Sparkles className="w-6 h-6 text-gold-bright relative" strokeWidth={2.4} />
    </Link>
  );
}
