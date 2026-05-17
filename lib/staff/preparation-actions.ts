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
      return {
        ligne_id: l.id,
        ecart_pct: Number(pct.toFixed(4)),
        ecart_eur: Number(eur.toFixed(2)),
        action,
        decision_par: userId,
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
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
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

  return {
    ok: true,
    ecartsCount,
    ...captureResult,
  };
}
