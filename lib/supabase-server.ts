/* Server-only Supabase client (Route Handlers, crons).
 * Utilise SUPABASE_SERVICE_ROLE_KEY pour bypass RLS quand le serveur a
 * besoin de lire toutes les push_subscriptions ou d'écrire des audit logs.
 * Ne JAMAIS importer depuis un composant client. */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _serverClient: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (_serverClient) return _serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for server-side Supabase"
    );
  }
  _serverClient = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serverClient;
}
