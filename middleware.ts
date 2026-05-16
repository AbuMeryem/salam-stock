/**
 * middleware.ts — CORS handler global pour les routes /api/stripe/*.
 *
 * Contexte : le front salamarket-drive (Vite, http://localhost:8081)
 * appelle l'API Stripe de salam-stock (Next.js, http://localhost:3000)
 * pour le flow manual capture (POST create-payment-intent, capture-
 * payment). Comme c'est cross-origin, le browser envoie un preflight
 * OPTIONS — sans CORS headers ici, il échoue → tout l'E2E pété.
 *
 * Stratégie :
 *   - Whitelist d'origines (pas de wildcard `*` car Stripe Elements
 *     envoie potentiellement des cookies).
 *   - Le middleware court-circuite les OPTIONS avec un 204 + headers.
 *   - Pour les POST, il laisse Next.js traiter la requête puis ajoute
 *     les headers à la response sortante.
 *
 * Webhook (/api/stripe/webhook) : Stripe appelle en serveur-à-serveur,
 * pas de header Origin → le middleware ne renvoie pas de
 * Access-Control-Allow-Origin (inutile), mais ne bloque pas la requête
 * non plus. Pas de régression.
 */
import { NextResponse, type NextRequest } from "next/server";

// ── Whitelist d'origines ────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:8080", // Vite default
  "http://localhost:8081", // Vite fallback (port 8080 occupé)
  "http://localhost:5173", // Vite legacy default
  "https://salamarket-drive.vercel.app", // prod (à confirmer/ajuster)
]);

function corsHeadersFor(origin: string | null): Record<string, string> {
  // Si l'origine n'est pas dans la whitelist, on renvoie quand même
  // les headers minimaux mais SANS Access-Control-Allow-Origin → le
  // browser bloquera la requête en toute sécurité.
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Preflight OPTIONS → 204 + headers, court-circuit Next.js
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeadersFor(origin),
    });
  }

  // Autres requêtes → on laisse passer, et on ajoute les headers CORS
  // sur la response sortante.
  const res = NextResponse.next();
  const headers = corsHeadersFor(origin);
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

// Ne s'applique QU'aux routes Stripe pour éviter d'impacter le reste.
// Le webhook est inclus mais Stripe (serveur-à-serveur) n'envoie pas
// de header Origin → corsHeadersFor renvoie des headers sans
// Access-Control-Allow-Origin, et le 200 OK normal du webhook n'est
// pas affecté.
export const config = {
  matcher: ["/api/stripe/:path*"],
};
