"use client";

import { supabase } from "@/lib/supabase";

let cachedAdminIds: string[] | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000; // 1 min

/** Récupère + cache 1 min les IDs employés qui doivent recevoir les
 *  push d'administration : role=admin OU prenom Otmane/Ahmed.
 *  Évite de re-query Supabase à chaque event. */
export async function getAdminEmployeIds(): Promise<string[]> {
  if (cachedAdminIds && Date.now() - cachedAt < CACHE_MS) {
    return cachedAdminIds;
  }
  const sb = supabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("employes")
      .select("id, role, prenom")
      .eq("is_active", true);
    const ids = ((data ?? []) as Array<{
      id: string;
      role: string;
      prenom: string | null;
    }>)
      .filter(
        (e) =>
          e.role === "admin" ||
          ["Otmane", "Ahmed"].includes(e.prenom ?? "")
      )
      .map((e) => e.id);
    cachedAdminIds = ids;
    cachedAt = Date.now();
    return ids;
  } catch (e) {
    console.warn("[notifications] getAdminEmployeIds fail:", e);
    return [];
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
  alerte_id?: string;
}

/** Fire-and-forget push vers les admins (Otmane + Ahmed).
 *  Non bloquant — les erreurs sont logguées sans throw. */
export async function pushToAdmins(payload: PushPayload): Promise<void> {
  const employe_ids = await getAdminEmployeIds();
  if (employe_ids.length === 0) return;
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, employe_ids }),
    });
  } catch (e) {
    console.warn("[notifications] pushToAdmins fail:", e);
  }
}

/** Push vers une liste explicite d'employés (utilisé pour clarification
 *  d'un employé en particulier). */
export async function pushToEmployes(
  employe_ids: string[],
  payload: PushPayload
): Promise<void> {
  if (employe_ids.length === 0) return;
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, employe_ids }),
    });
  } catch (e) {
    console.warn("[notifications] pushToEmployes fail:", e);
  }
}
