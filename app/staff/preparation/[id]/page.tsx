"use client";

/**
 * /staff/preparation/[id] — Détail commande + workflow de pesée.
 *
 * Fetch côté client (cohérent avec /staff/preparation et l'auth Zustand).
 * Délègue toute l'UX de pesée au composant `PreparationWorkflow`.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PreparationWorkflow } from "../components/PreparationWorkflow";
import type {
  CommandeDetail,
  CommandeLigneDetail,
} from "../components/types";

export default function StaffPreparationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const commandeId = params?.id;

  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [lignes, setLignes] = useState<CommandeLigneDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!commandeId) return;
    const sb = supabase();
    if (!sb) {
      setError("Supabase non configuré");
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: cmd, error: errCmd } = await sb
      .from("commandes_drive")
      .select(
        "id, numero_commande, client_nom, client_telephone, client_email, " +
          "creneau_retrait, statut, statut_paiement, total_ttc, " +
          "montant_estime_ttc, montant_autorise_ttc, " +
          "stripe_payment_intent_id",
      )
      .eq("id", commandeId)
      .single();

    if (errCmd || !cmd) {
      setError(errCmd?.message ?? "Commande introuvable");
      setLoading(false);
      return;
    }

    const { data: lignesData, error: errLignes } = await sb
      .from("commandes_drive_lignes")
      .select(
        "id, commande_id, produit_id, quantite, prix_unitaire, " +
          "quantite_estimee, quantite_reelle_pesee, " +
          "montant_estime_ttc, montant_reel_ttc, " +
          "pese_par, pese_at, " +
          "produits:produit_id (id, nom, image_url, unit_type, " +
          "price_per_kg, poids_min_kg, poids_max_kg, brackets_poids)",
      )
      .eq("commande_id", commandeId);

    if (errLignes) {
      setError(errLignes.message);
      setLoading(false);
      return;
    }

    setCommande(cmd as unknown as CommandeDetail);
    setLignes((lignesData ?? []) as unknown as CommandeLigneDetail[]);
    setLoading(false);
  }, [commandeId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement de la commande…
      </div>
    );
  }

  if (error || !commande) {
    return (
      <div className="space-y-4">
        <Link
          href="/staff/preparation"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">Erreur</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/staff/preparation"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la liste
      </Link>

      <PreparationWorkflow
        commande={commande}
        initialLignes={lignes}
        onFinished={() => router.push("/staff/preparation")}
      />
    </div>
  );
}
