"use client";

import { useState } from "react";
import { Mail, MailCheck, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** Adresse cible pour le test. Si null, désactive le bouton. */
  defaultTo?: string;
}

export function EmailRecapCard({ defaultTo = "ceo@hamy.studio" }: Props) {
  const [to, setTo] = useState(defaultTo);
  const [sending, setSending] = useState(false);
  const [sentOnce, setSentOnce] = useState(false);

  async function sendTest() {
    if (!to.includes("@")) {
      toast.error("Adresse email invalide");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: "Salam Stock · Récap quotidien (test)",
          html: emailHtmlSample(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        status?: string;
      };
      if (!res.ok || json.error) {
        toast.error(json.error ?? `Échec (${res.status})`, { duration: 7000 });
        return;
      }
      toast.success(`Email envoyé à ${to}. ID: ${json.id?.slice(0, 12) ?? "?"}…`);
      setSentOnce(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erreur : " + msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-rule p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold-soft text-primary-dark">
          {sentOnce ? <MailCheck className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-primary leading-tight">
            Email récap quotidien
            <span className="ml-2 text-[9.5px] font-bold uppercase tracking-wider bg-cream text-text-tertiary rounded px-1.5 py-0.5 align-middle">
              roadmap
            </span>
          </p>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
            Récap CA, alertes, top produits chaque soir à 19h. Cron à activer en V2.1 — l'infrastructure d'envoi est prête.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="email@destination.fr"
            className="flex-1 input-field !py-2.5 !text-sm"
          />
          <button
            onClick={sendTest}
            disabled={sending || !to.includes("@")}
            className="bg-primary text-white rounded-xl px-4 py-2.5 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {sending ? (
              "Envoi…"
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Test
              </>
            )}
          </button>
        </div>
        <p className="text-[10.5px] text-text-tertiary inline-flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          Resend gratuit : 100 emails/jour. Domaine `onboarding@resend.dev` pour les tests, à remplacer par `alertes@xlab-tech.com` quand DNS prêt.
        </p>
      </div>
    </div>
  );
}

function emailHtmlSample(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Récap Salam Stock</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;background:#FAF7EE;color:#0F1A14;padding:24px;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E4D8;border-radius:20px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(180deg,#0E3B2E,#082A20);padding:24px;color:#FFFFFF;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C9A227;">Salam Stock · Récap</p>
        <h1 style="margin:6px 0 0;font-size:24px;font-weight:800;letter-spacing:-0.01em;">Test du système email</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
          Bonjour, ceci est un test de la chaîne <strong>Resend → boîte mail</strong>.
          Si tu lis ce message, l'infrastructure d'envoi est opérationnelle.
        </p>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:#5A6470;">
          <li>CA jour : 0,00&nbsp;€ (placeholder)</li>
          <li>Alertes IA : 0</li>
          <li>Top produits : placeholder</li>
        </ul>
        <p style="margin:18px 0 0;font-size:12px;color:#7B8693;">
          Le cron 19h automatique n'est pas encore activé — c'est sur la roadmap V2.1.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
