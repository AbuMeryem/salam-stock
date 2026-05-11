/* NB: pas de "use client" — ce module est utilisé à la fois côté
   client (pages React, hooks Realtime) ET côté server (API routes,
   crons, computeDailyZ, etc.). Avec "use client" Next.js empêche
   l'appel depuis un Route Handler → erreur "n is not a function" au
   runtime. La factory `supabase()` marche sur les deux runtimes. */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _checked = false;

/**
 * Returns a singleton Supabase browser client, or null if env vars are absent
 * (in which case the app falls back to local-seed mode — see lib/db).
 */
export function supabase(): SupabaseClient | null {
  if (_checked) return _client;
  _checked = true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  _client = createClient(url, anon, {
    auth: { persistSession: false },
  });
  return _client;
}

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
