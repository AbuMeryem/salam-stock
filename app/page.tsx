/**
 * Root page — V2 is the default product since 2026-05-11.
 * Server-side redirect to /v2/login. The login page handles the "already
 * authenticated" case via its own client-side useEffect (PIN session lives
 * in localStorage and isn't visible server-side).
 *
 * The V1 routes (/login, /dashboard, /reception, /catalogue, etc.) remain
 * accessible via direct URL — this redirect only affects the root.
 */

import { redirect } from "next/navigation";

export default function HomePage(): never {
  redirect("/v2/login");
}
