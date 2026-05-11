/**
 * Téléchargement de fichier optimisé pour PWA iOS standalone.
 *
 * Problème : sur iPhone en mode PWA "Ajouter à l'écran d'accueil",
 * un `<a download>` classique fait sortir l'utilisateur du PWA pour
 * afficher l'aperçu du fichier dans Safari. Il n'y a pas de retour
 * possible vers la PWA — il faut killer l'app et la relancer.
 *
 * Stratégie en 3 paliers (fallback) :
 *  1. Web Share API avec fichier : si supporté, ouvre le Share Sheet
 *     iOS natif (Save to Files, AirDrop, Mail, etc.) SANS quitter la
 *     PWA. C'est le chemin natif sur iOS 15+.
 *  2. window.open(blob:) en nouvel onglet : sur iOS PWA, ouvre Safari
 *     en arrière-plan avec le fichier ; la PWA reste au premier plan.
 *  3. <a download> classique : fallback Chrome/Firefox/Safari desktop.
 */

interface DownloadOpts {
  /** URL distante à fetch (ou data URL) */
  url: string;
  /** Nom de fichier suggéré (extension comprise) */
  filename: string;
  /** MIME type explicite si pas dans la réponse */
  contentType?: string;
  /** Texte affiché dans le Share Sheet iOS */
  shareTitle?: string;
}

export type DownloadResult =
  | { strategy: "share"; success: true }
  | { strategy: "newtab"; success: true }
  | { strategy: "anchor"; success: true }
  | { strategy: "cancelled"; success: false }
  | { strategy: "error"; success: false; error: string };

/**
 * Détecte la PWA iOS standalone — c'est là où le download classique
 * trappe l'utilisateur.
 */
export function isIosStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (!isIos) return false;
  // iOS Safari expose navigator.standalone seulement quand installé.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export async function downloadOrShare(opts: DownloadOpts): Promise<DownloadResult> {
  const { url, filename, contentType, shareTitle } = opts;

  let blob: Blob;
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) {
      return { strategy: "error", success: false, error: `HTTP ${res.status}` };
    }
    blob = await res.blob();
    if (contentType && blob.type === "") {
      blob = new Blob([await blob.arrayBuffer()], { type: contentType });
    }
  } catch (err) {
    return {
      strategy: "error",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const file = new File([blob], filename, { type: blob.type || contentType || "application/octet-stream" });

  // Palier 1 — Web Share API avec fichier (iOS 15+ natif PWA)
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: shareTitle ?? filename,
      });
      return { strategy: "share", success: true };
    } catch (err) {
      // L'utilisateur a annulé le Share Sheet → on ne fait rien
      // (l'app reste sur la page actuelle). Pas d'erreur, juste un
      // cancel propre.
      if (err instanceof Error && err.name === "AbortError") {
        return { strategy: "cancelled", success: false };
      }
      // Autre erreur → fallback palier 2/3
    }
  }

  // Palier 2 — Sur iOS PWA standalone, window.open(blob:) garde la
  // PWA au premier plan. Sur les autres OS c'est juste un onglet
  // de plus, ce qui est OK aussi.
  const objUrl = URL.createObjectURL(blob);

  if (isIosStandalonePwa()) {
    const win = window.open(objUrl, "_blank");
    if (win) {
      // Libère l'URL après 60s — assez pour que Safari ait fini le
      // pre-fetch du Blob côté nouvel onglet.
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      return { strategy: "newtab", success: true };
    }
    // window.open bloqué (popup blocker) → tombe sur palier 3
  }

  // Palier 3 — <a download> classique (desktop, mobile non-PWA, etc.)
  try {
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
    return { strategy: "anchor", success: true };
  } catch (err) {
    URL.revokeObjectURL(objUrl);
    return {
      strategy: "error",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
