"use server";

/**
 * lib/staff/preparation-actions.ts — Server actions Next.js pour le
 * workflow de pesée Drive.
 *
 * Sécurité : on utilise le client `supabaseServer()` qui contourne RLS
 * (service role). Les pages /staff/* sont protégées par le guard
 * `app/staff/layout.tsx` côté client. Quand Supabase Auth sera branché,
 * on validera ici la session via cookies + `auth.getUser`.
 *
 * Le `user_id` (= profiles.id) reçu est un UUID — quand le repo
 * basculera sur Supabase Auth ce sera l'auth.uid(). En attendant, le
 * caller (PreparationWorkflow.tsx) peut envoyer une string vide :
 * on stocke alors `null` dans `pese_par`.
 */
import { supabaseServer } from "@/lib/supabase-server";
import {
  computeEcartPct,
  determineEcartAction,
  type EcartAction,
} from "@/lib/drive-pesee";

export interface MarkLineWeighedInput {
  line_id: string;
  quantite_reelle: number;
  montant_reel_ttc: number;
  /** UUID profiles.id (admin / manager / employee). Sert pour pese_par
   *  + decision_par sur drive_ecarts_poids. */
  user_id?: string | null;
  /** UUID employes.id (staff interne). Sert pour prepare_par_employe_id
   *  qui référence la table `employes`, distincte de `profiles`. À
   *  fournir séparément pour éviter un FK violation
   *  (commandes_drive_lignes_prepare_par_employe_id_fkey). */
  employe_id?: string | null;
}

const UUID_RE_LOCAL = /^[0-9a-f-]{36}$/i;

export async function markLineWeighed(input: MarkLineWeighedInput): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const sb = supabaseServer();
  const userId =
    input.user_id && UUID_RE_LOCAL.test(input.user_id) ? input.user_id : null;
  const employeId =
    input.employe_id && UUID_RE_LOCAL.test(input.employe_id)
      ? input.employe_id
      : null;

  // DEBUG temporaire (2026-05-17) — à retirer après validation E2E.
  // Si le browser garde un ancien bundle en cache, le user_id reçu ici
  // peut être autre chose que l'UUID admin attendu. Logger côté serveur
  // (terminal `npm run dev` salam-stock) pour vérifier la VRAIE valeur.
  // eslint-disable-next-line no-console
  console.log("[DEBUG markLineWeighed] payload envoyé :", {
    line_id: input.line_id,
    raw_user_id: input.user_id,
    raw_employe_id: input.employe_id,
    user_id_after_validation: userId,
    employe_id_after_validation: employeId,
    quantite_reelle: input.quantite_reelle,
    montant_reel_ttc: input.montant_reel_ttc,
  });

  // UPDATE complet : pesée Stripe (pese_par) + marquage préparé pour
  // que la ligne sorte de "en_attente" côté Kanban v2 (prepare_par_
  // employe_id + statut_preparation + prepare_at).
  const { error } = await sb
    .from("commandes_drive_lignes")
    .update({
      quantite_reelle_pesee: input.quantite_reelle,
      montant_reel_ttc: input.montant_reel_ttc,
      pese_par: userId,
      pese_at: new Date().toISOString(),
      statut_preparation: "prepare",
      prepare_par_employe_id: employeId,
      prepare_at: new Date().toISOString(),
    })
    .eq("id", input.line_id);

  if (error) {
    console.error("[markLineWeighed] DB error :", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface FinalizePreparationInput {
  commande_id: string;
  /** UUID auth/profile du préparateur. Optionnel tant que Supabase Auth
   *  n'est pas branché ; dans ce cas on n'écrit pas `pese_par` ni
   *  `decision_par`. */
  user_id?: string | null;
  /** Lignes pesées par le préparateur (déjà UPDATE en DB par les calls
   *  `markLineWeighed` au fil de l'eau). On les ré-envoie pour calculer
   *  les écarts et insérer dans drive_ecarts_poids. */
  lignes: Array<{
    id: string;
    montant_estime_ttc: number;
    montant_reel_ttc: number;
  }>;
}

interface FinalizeResult {
  ok: boolean;
  error?: string;
  /** Montant capturé Stripe (si la capture a réussi). */
  montantCaptureTtc?: number;
  paymentIntentId?: string;
  ecartsCount?: number;
}

export async function finalizePreparation(
  input: FinalizePreparationInput,
): Promise<FinalizeResult> {
  const sb = supabaseServer();
  const userId =
    input.user_id && /^[0-9a-f-]{36}$/i.test(input.user_id)
      ? input.user_id
      : null;

  // 1. Insert drive_ecarts_poids pour chaque ligne avec écart > 0
  const ecartsRows = input.lignes
    .map((l) => {
      const pct = computeEcartPct(l.montant_estime_ttc, l.montant_reel_ttc);
      if (pct === 0) return null;
      const eur = l.montant_reel_ttc - l.montant_estime_ttc;
      const action: EcartAction = determineEcartAction(pct, eur);
      // FIX 2026-05-17 : la colonne ecart_eur n'existe PAS dans la
      // table drive_ecarts_poids (cf. migration 0029_drive_au_poids).
      // Schéma réel : id, ligne_id, ecart_pct, action, decision_par,
      // decision_at, notes. On encode l'écart en € dans `notes` pour
      // traçabilité audit.
      return {
        ligne_id: l.id,
        ecart_pct: Number(pct.toFixed(4)),
        action,
        decision_par: userId,
        notes: `Écart : ${eur >= 0 ? "+" : ""}${eur.toFixed(2)} € (estimé ${l.montant_estime_ttc.toFixed(2)} → réel ${l.montant_reel_ttc.toFixed(2)})`,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  let ecartsCount = 0;
  if (ecartsRows.length > 0) {
    const { error: errEcart } = await sb
      .from("drive_ecarts_poids")
      .insert(ecartsRows);
    if (errEcart) {
      // On n'arrête pas le workflow pour une erreur d'audit : la capture
      // Stripe doit aboutir, le client attend. On log et on continue.
      console.error("[finalizePreparation] insert drive_ecarts_poids", errEcart);
    } else {
      ecartsCount = ecartsRows.length;
    }
  }

  // 2. Appel API Stripe capture (même origin, server-side fetch)
  //    On laisse l'API faire la validation et l'UPDATE statut_paiement.
  let captureResult: {
    paymentIntentId?: string;
    montantCaptureTtc?: number;
  } = {};
  if (userId) {
    // FIX 2026-05-17 : en dev local, ni NEXT_PUBLIC_APP_URL ni
    // VERCEL_URL ne sont définies → le if(baseUrl) sautait l'appel
    // capture, la commande passait à 'pret' sans capturer le PI Stripe
    // (toast 'capture non confirmée'). Fallback explicite localhost:3000
    // pour le dev. À ajuster si tu déploies sur un autre port.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
      "http://localhost:3000";
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/api/stripe/capture-payment`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            commande_id: input.commande_id,
            user_id: userId,
          }),
          cache: "no-store",
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          return {
            ok: false,
            error:
              (json.error as string) ??
              (json.detail as string) ??
              "Erreur Stripe capture",
          };
        }
        captureResult = {
          paymentIntentId: json.paymentIntentId as string | undefined,
          montantCaptureTtc: json.montantCaptureTtc as number | undefined,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "fetch failed";
        return { ok: false, error: `Stripe API injoignable : ${msg}` };
      }
    }
    // Si pas de baseUrl on saute la capture (dev local sans NEXT_PUBLIC_APP_URL) —
    // l'UPDATE statut commande ci-dessous restera "pret" pour le tester.
  }

  // 3. UPDATE statut de la commande
  const { error: errUpd } = await sb
    .from("commandes_drive")
    .update({ statut: "pret" })
    .eq("id", input.commande_id);

  if (errUpd) {
    return {
      ok: false,
      error: `UPDATE statut commande : ${errUpd.message}`,
    };
  }

  // 4. Send "commande prête" email to client — fire-and-forget
  try {
    const { data: commande } = await sb
      .from("commandes_drive")
      .select("id, numero_commande, client_nom, client_email")
      .eq("id", input.commande_id)
      .maybeSingle();

    if (commande?.client_email) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
        "http://localhost:3000";
      fetch(`${baseUrl}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: commande.client_email,
          subject: "Votre commande Salamarket est prête !",
          html: buildCommandePreteEmail(commande),
        }),
      }).catch(() => {}); // fire-and-forget
    }
  } catch {
    // Never block the preparation flow
  }

  return {
    ok: true,
    ecartsCount,
    ...captureResult,
  };
}

// ─── Email template "commande prête" ──────────────────────────────────
function buildCommandePreteEmail(commande: {
  id: string;
  numero_commande?: string | null;
  client_nom?: string | null;
  client_email?: string | null;
}): string {
  const ref = commande.numero_commande || commande.id.slice(0, 8).toUpperCase();
  const greeting = commande.client_nom ? ` ${commande.client_nom}` : "";
  return `<div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background: linear-gradient(180deg, #0E3B2E 0%, #082A20 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #C9A227; font-size: 20px; margin: 0;">Salamarket Drive</h1>
  </div>
  <div style="background: #FAF7EE; padding: 24px; border-radius: 0 0 12px 12px;">
    <h2 style="color: #0E3B2E; font-size: 18px;">Votre commande est prête !</h2>
    <p style="color: #0F1A14; font-size: 14px; line-height: 1.6;">
      Bonjour${greeting},<br><br>
      Votre commande <strong>${ref}</strong> est prête à être retirée.
    </p>
    <div style="background: white; border: 1px solid #E8E4D8; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; font-size: 13px; color: #6B7280;">📍 Retrait au</p>
      <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #0E3B2E;">8 av. Larrieu-Thibaud, 31100 Toulouse</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #6B7280;">Lun-Sam 10h-19h30 · Dimanche 10h-18h</p>
    </div>
    <p style="color: #0F1A14; font-size: 14px;">À très vite !</p>
    <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">L'équipe Salamarket</p>
  </div>
</div>`;
}
