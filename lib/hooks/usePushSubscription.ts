"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PushStatus =
  | "idle"
  | "checking"
  | "unsupported"
  | "denied"
  | "granted"
  | "subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

/** Hook pour Web Push iOS 16.4+ PWA standalone.
 *  Sur iOS, l'API push n'est dispo que si :
 *    1. L'app est installée à l'écran d'accueil (display-mode: standalone)
 *    2. iOS ≥ 16.4
 *  Sur Android (Chrome) et desktop, ça marche en mode browser normal. */
export function usePushSubscription(employeId: string | null) {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Détection initiale
  useEffect(() => {
    if (typeof window === "undefined") return;
    setStatus("checking");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    // iOS Safari : push uniquement en standalone (installé)
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isIos && !isStandalone) {
      setStatus("unsupported");
      setError(
        "Sur iPhone, installe d'abord l'app sur l'écran d'accueil (Partager → Sur l'écran d'accueil), puis relance depuis l'icône."
      );
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    // Check existing subscription
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) {
        setStatus(Notification.permission === "granted" ? "granted" : "idle");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : Notification.permission === "granted" ? "granted" : "idle");
    });
  }, []);

  const enable = useCallback(async () => {
    if (!employeId) {
      setError("Employé non identifié — relance après login.");
      return;
    }
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!pubKey) {
      setError("Configuration VAPID manquante côté serveur.");
      return;
    }
    setError(null);
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        setError(
          "Permission refusée. Réglages iPhone → Salam Stock → Notifications → Autoriser, puis recharge."
        );
        return;
      }
      setStatus("granted");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey) as BufferSource,
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Subscription invalide (clés absentes).");
      }

      const sb = supabase();
      if (sb) {
        const { error: dbErr } = await sb.from("push_subscriptions").upsert(
          {
            employe_id: employeId,
            endpoint: json.endpoint,
            keys_p256dh: json.keys.p256dh,
            keys_auth: json.keys.auth,
            user_agent: navigator.userAgent,
            enabled: true,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        );
        if (dbErr) throw new Error(dbErr.message);
      }
      setStatus("subscribed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Push] enable error:", e);
      setError(msg);
    }
  }, [employeId]);

  const disable = useCallback(async () => {
    if (!employeId) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const sb = supabase();
        if (sb) {
          await sb
            .from("push_subscriptions")
            .update({ enabled: false })
            .eq("employe_id", employeId);
        }
      }
      setStatus(Notification.permission === "granted" ? "granted" : "idle");
    } catch (e) {
      console.error("[Push] disable error:", e);
    }
  }, [employeId]);

  const sendTest = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employe_id: employeId }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        console.error("[Push] test failed:", res.status, txt);
        return false;
      }
      return true;
    } catch (e) {
      console.error("[Push] test exception:", e);
      return false;
    }
  }, [employeId]);

  return { status, error, enable, disable, sendTest };
}
