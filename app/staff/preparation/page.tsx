"use client";

// DEPRECATED 16/05/2026 : module remplacé par /v2/preparation.
// Voir app/staff/preparation/DEPRECATED.md. Une redirection 301
// est configurée dans next.config.mjs ; ce fichier reste pour
// historique git et compat composants extraits dans lib/staff/.

/**
 * /staff/preparation — Liste des commandes Drive à préparer
 *
 * Fetch côté client (le repo n'a pas de Supabase Auth SSR pour l'instant,
 * tout le code Drive existant utilise déjà `lib/supabase.ts` côté client,
 * cf. app/v2/preparation/page.tsx).
 *
 * Filtres :
 *   - créneau : today / tomorrow / all (query param `creneau`)
 *
 * Critère : statut_paiement = 'autorise' ET statut NOT IN
 *   ('pret', 'retire', 'annule', 'preparation_terminee').
 *
 * Note sur les statuts : le modèle existant (cf. lib/types/db.ts)
 * définit `CommandeDriveStatus = a_preparer | en_preparation | pret |
 * retire | annule`. La migration 0029 (parallèle) ajoute le statut
 * `prete_retrait`. On filtre donc largement les statuts terminaux.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Clock,
  CreditCard,
  Loader2,
  Package,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/format";

type CreneauFilter = "today" | "tomorrow" | "all";

interface CommandeARow {
  id: string;
  numero_commande: string;
  client_nom: string;
  client_telephone: string | null;
  creneau_retrait: string;
  statut: string;
  statut_paiement: string | null;
  total_ttc: number;
  montant_estime_ttc: number | null;
  montant_autorise_ttc: number | null;
  nb_lignes: number;
}

const STATUTS_TERMINES = new Set([
  "pret",
  "prete_retrait",
  "retire",
  "annule",
  "annulee",
  "preparation_terminee",
]);

function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function formatCreneau(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

const FILTRES: { key: CreneauFilter; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "tomorrow", label: "Demain" },
  { key: "all", label: "Tous" },
];

export default function StaffPreparationListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const creneau = (searchParams.get("creneau") as CreneauFilter) ?? "today";

  const [rows, setRows] = useState<CommandeARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supaUnavailable, setSupaUnavailable] = useState(false);

  const fetchData = useCallback(async () => {
    const sb = supabase();
    if (!sb) {
      setSupaUnavailable(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await sb
      .from("commandes_drive")
      .select(
        "id, numero_commande, client_nom, client_telephone, creneau_retrait, " +
          "statut, statut_paiement, total_ttc, montant_estime_ttc, " +
          "montant_autorise_ttc, commandes_drive_lignes(id)",
      )
      .eq("statut_paiement", "autorise")
      .order("creneau_retrait", { ascending: true });

    if (error) {
      toast.error("Erreur chargement commandes : " + error.message);
      setLoading(false);
      return;
    }

    type RawRow = {
      id: string;
      numero_commande: string;
      client_nom: string;
      client_telephone: string | null;
      creneau_retrait: string;
      statut: string;
      statut_paiement: string | null;
      total_ttc: number | string | null;
      montant_estime_ttc: number | string | null;
      montant_autorise_ttc: number | string | null;
      commandes_drive_lignes: Array<{ id: string }> | null;
    };
    const rawRows = (data ?? []) as unknown as RawRow[];

    const mapped: CommandeARow[] = rawRows
      .map((c) => {
        const lignes = c.commandes_drive_lignes ?? [];
        return {
          id: c.id,
          numero_commande: c.numero_commande,
          client_nom: c.client_nom,
          client_telephone: c.client_telephone ?? null,
          creneau_retrait: c.creneau_retrait,
          statut: c.statut,
          statut_paiement: c.statut_paiement ?? null,
          total_ttc: Number(c.total_ttc ?? 0),
          montant_estime_ttc:
            c.montant_estime_ttc == null
              ? null
              : Number(c.montant_estime_ttc),
          montant_autorise_ttc:
            c.montant_autorise_ttc == null
              ? null
              : Number(c.montant_autorise_ttc),
          nb_lignes: lignes.length,
        };
      })
      .filter((c) => !STATUTS_TERMINES.has(c.statut));

    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (creneau === "all") return rows;
    const ref = new Date();
    if (creneau === "tomorrow") ref.setDate(ref.getDate() + 1);
    return rows.filter((r) => isSameDay(r.creneau_retrait, ref));
  }, [rows, creneau]);

  if (supaUnavailable) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-semibold">Supabase non configuré</p>
        <p className="mt-1 text-sm">
          Les pages /staff/* nécessitent Supabase (NEXT_PUBLIC_SUPABASE_URL +
          NEXT_PUBLIC_SUPABASE_ANON_KEY).
        </p>
      </div>
    );
  }

  function setFilter(next: CreneauFilter) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("creneau", next);
    router.replace(`/staff/preparation?${sp.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Commandes à préparer
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pré-autorisées Stripe, en attente de pesée et de capture.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              creneau === f.key
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-semibold text-slate-900">
            Aucune commande à préparer
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les pré-autorisations Stripe du créneau sont traitées.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/staff/preparation/${c.id}`}
                className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {c.numero_commande}
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {c.client_nom}
                    </p>
                    {c.client_telephone && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                        <UserIcon className="h-3 w-3" />
                        {c.client_telephone}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase text-emerald-700">
                    <CreditCard className="h-3 w-3" />
                    {c.statut_paiement ?? "autorise"}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">
                    {formatCreneau(c.creneau_retrait)}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Estimé
                    </dt>
                    <dd className="mt-0.5 font-semibold text-slate-900">
                      {formatCurrency(
                        c.montant_estime_ttc ?? c.total_ttc ?? 0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Autorisé
                    </dt>
                    <dd className="mt-0.5 font-semibold text-emerald-700">
                      {c.montant_autorise_ttc != null
                        ? formatCurrency(c.montant_autorise_ttc)
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-600">
                    {c.nb_lignes} {c.nb_lignes > 1 ? "lignes" : "ligne"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 group-hover:gap-2 transition-all">
                    Préparer <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
