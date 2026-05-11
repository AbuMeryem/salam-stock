"use client";

import { useState } from "react";
import { Bell, BellOff, BellRing, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";

interface Props {
  employeId: string | null;
}

export function PushNotifCard({ employeId }: Props) {
  const { status, error, enable, disable, sendTest } = usePushSubscription(employeId);
  const [sending, setSending] = useState(false);

  async function handleTest() {
    setSending(true);
    const ok = await sendTest();
    setSending(false);
    if (ok) {
      toast.success("Test envoyé. Vérifie ton iPhone (lock screen).");
    } else {
      toast.error("Le test n'a pas pu être envoyé.");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-rule p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            status === "subscribed"
              ? "bg-success-soft text-success"
              : "bg-gold-soft text-primary-dark"
          }`}
        >
          {status === "subscribed" ? (
            <BellRing className="w-5 h-5" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-primary leading-tight">
            Notifications push
          </p>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
            Alertes critiques IA, casses suspectes, ruptures — en temps réel sur iPhone même app fermée.
          </p>
        </div>
      </div>

      <div className="mt-3">
        {status === "checking" && (
          <p className="text-xs text-text-secondary">Vérification…</p>
        )}

        {status === "unsupported" && (
          <div className="bg-warning-soft border border-warning/25 rounded-xl p-3 text-[11.5px] text-warning leading-snug">
            <p className="font-bold mb-0.5 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Mode standalone requis
            </p>
            <p>
              {error ??
                "Ton navigateur ne supporte pas Web Push. Sur iPhone, installe l'app à l'écran d'accueil."}
            </p>
          </div>
        )}

        {status === "denied" && (
          <div className="bg-danger-soft border border-danger/20 rounded-xl p-3 text-[11.5px] text-danger leading-snug">
            <p className="font-bold mb-0.5 inline-flex items-center gap-1">
              <BellOff className="w-3.5 h-3.5" /> Permission refusée
            </p>
            <p>
              Réglages iPhone → Salam Stock → Notifications → Autoriser, puis recharge la page.
            </p>
          </div>
        )}

        {(status === "idle" || status === "granted") && (
          <button
            onClick={enable}
            className="w-full bg-primary text-white rounded-xl py-3 inline-flex items-center justify-center gap-2 text-sm font-bold"
          >
            <Bell className="w-4 h-4" />
            Activer les notifications
          </button>
        )}

        {status === "subscribed" && (
          <div className="space-y-2">
            <div className="bg-success-soft border border-success/25 rounded-xl p-3 text-[11.5px] text-success inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-bold">Actives.</span>
              <span>Tu recevras les alertes critiques même app fermée.</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={handleTest}
                disabled={sending}
                className="bg-gold-bright text-primary-dark rounded-xl py-2.5 text-xs font-bold disabled:opacity-50"
              >
                {sending ? "Envoi…" : "Envoyer un test"}
              </button>
              <button
                onClick={disable}
                className="bg-cream text-text-secondary rounded-xl px-3 py-2.5 text-xs font-bold border border-rule"
              >
                Désactiver
              </button>
            </div>
          </div>
        )}

        {error && status !== "unsupported" && status !== "denied" && (
          <p className="mt-2 text-[10.5px] text-danger">{error}</p>
        )}
      </div>
    </div>
  );
}
