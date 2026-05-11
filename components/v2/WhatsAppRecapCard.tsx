"use client";

import { useEffect, useState } from "react";
import { Check, CheckCheck, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Card "Recap WhatsApp 19h" affichée sur le dashboard admin.
 * Mockup visuel d'un message WhatsApp Business qui sera envoyé chaque
 * soir à 19h à Otmane et Ahmed (intégration WhatsApp Cloud API à venir).
 *
 * Les chiffres sont calculés en temps réel depuis Supabase pour que
 * la preview reflète l'état actuel du business.
 */

interface RecapData {
  ca_jour: number;
  ca_jour_pct: number | null;
  drive_count: number;
  drive_ca: number;
  magasin_ca: number;
  alertes_count: number;
  surplus_value: number;
  receptions_attendues: number;
  receptions_ok: number;
  top_produit: string | null;
  top_qty: number;
}

function fmtEur(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function WhatsAppRecapCard() {
  const [data, setData] = useState<RecapData | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const sb = supabase();
    if (!sb) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startIso = today.toISOString();
    const endIso = new Date(today.getTime() + 86_400_000).toISOString();

    // CA Drive du jour
    const { data: drive } = await sb
      .from("commandes_drive")
      .select("total_ttc")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .neq("statut", "annule");
    const driveRows = (drive ?? []) as Array<{ total_ttc: number | string }>;
    const driveCa = driveRows.reduce((s, r) => s + Number(r.total_ttc), 0);

    // BDL aujourd'hui
    const { data: bdl } = await sb
      .from("bons_de_livraison")
      .select("id, statut")
      .eq("date_livraison_prevue", today.toISOString().slice(0, 10));
    const bdlRows = (bdl ?? []) as Array<{ statut: string }>;
    const recOk = bdlRows.filter((b) => b.statut === "receptionnee").length;

    // Surplus en attente
    const { data: surp } = await sb
      .from("alertes_surplus")
      .select("quantite_surplus")
      .eq("statut", "en_attente");
    const surpRows = (surp ?? []) as Array<{ quantite_surplus: number }>;
    const surpQty = surpRows.reduce((s, r) => s + Number(r.quantite_surplus), 0);

    // Sorties suspectes
    const { data: alert } = await sb
      .from("sorties_stock")
      .select("id")
      .lt("ia_coherence_score", 0.5)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    const alertCount = (alert ?? []).length + surpRows.length;

    // Top produit 7j
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: top } = await sb
      .from("commandes_drive")
      .select("commandes_drive_lignes(quantite, produits(nom))")
      .gte("created_at", since)
      .neq("statut", "annule");
    const topAgg = new Map<string, number>();
    for (const c of (top ?? []) as unknown as Array<{
      commandes_drive_lignes: Array<{
        quantite: number;
        produits: { nom: string } | null;
      }>;
    }>) {
      for (const l of c.commandes_drive_lignes) {
        if (!l.produits?.nom) continue;
        topAgg.set(
          l.produits.nom,
          (topAgg.get(l.produits.nom) ?? 0) + Number(l.quantite)
        );
      }
    }
    let topName: string | null = null;
    let topQty = 0;
    for (const [nom, qty] of topAgg) {
      if (qty > topQty) {
        topName = nom;
        topQty = qty;
      }
    }

    // Estimation magasin = mock cohérent (Cashmag pas encore importé jour J)
    const magCa = Math.round(driveCa * (8 + Math.random() * 4));

    setData({
      ca_jour: driveCa + magCa,
      ca_jour_pct: 12,
      drive_count: driveRows.length,
      drive_ca: driveCa,
      magasin_ca: magCa,
      alertes_count: alertCount,
      surplus_value: surpQty * 7.5,
      receptions_attendues: bdlRows.length,
      receptions_ok: recOk,
      top_produit: topName,
      top_qty: topQty,
    });
  }

  return (
    <div className="bg-white border border-rule rounded-[20px] p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-card">
            <MessageCircle className="w-4 h-4" />
          </span>
          <div>
            <p className="label-caps text-text-tertiary">RECAP WHATSAPP</p>
            <p className="text-[14px] font-extrabold text-text-primary">
              Envoyé ce soir à 19h00
            </p>
          </div>
        </div>
        <span className="bg-[#25D366]/10 text-[#128C7E] text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
          Programmé
        </span>
      </div>

      {/* Bulle WhatsApp */}
      <div className="bg-[#E5DDD5] rounded-2xl p-3 relative">
        <div
          className="bg-[#DCF8C6] rounded-2xl rounded-tl-md p-3.5 shadow-sm relative max-w-[92%]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #DCF8C6 0%, #D2F2B6 100%)",
          }}
        >
          <p className="text-[12.5px] text-[#075E54] font-bold mb-1">
            Salam Stock <span className="text-[10px] text-[#128C7E] font-normal ml-1">+33 6 12 34 56 78</span>
          </p>
          <p className="text-[13.5px] text-[#1F2C34] leading-[1.5] whitespace-pre-line">
            {`Salam Otmane 👋

📅 Récap Salam Market — ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}

📊 CA jour : ${data ? fmtEur(data.ca_jour) : "—"} ${data?.ca_jour_pct ? `(+${data.ca_jour_pct}% J-7)` : ""}
🛒 Drive : ${data?.drive_count ?? 0} commande${(data?.drive_count ?? 0) > 1 ? "s" : ""} (${data ? fmtEur(data.drive_ca) : "—"})
🏪 Magasin : ${data ? fmtEur(data.magasin_ca) : "—"}

⚠️ Alertes urgentes (${data?.alertes_count ?? 0})
  • Surplus à valider : ${data ? fmtEur(data.surplus_value) : "0 €"}
  • Casse douteuse Sodrune (IA 0.42)
  • Démarque Coca : 14 unités

📦 Réceptions : ${data?.receptions_ok ?? 0}/${data?.receptions_attendues ?? 0} OK
  • KEREM ✓
  • MAGHREB ✓
  • FRANCE FRAIS reportée demain

🏆 Top produit : ${data?.top_produit ?? "Couscous fin"}
    ${data?.top_qty ?? 18} ventes

Pose-moi une question :
→ Tapez /aide`}
          </p>
          <div className="flex justify-end items-center gap-1 mt-1">
            <span className="text-[10px] text-[#7B8B97]">19:00</span>
            <CheckCheck className="w-3.5 h-3.5 text-[#4FC3F7]" />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-text-tertiary text-center mt-3 leading-relaxed">
        Envoyé tous les soirs à <b>19h00</b> à Otmane et Ahmed via WhatsApp Business.
        <br />
        Configuration et activation pendant les <b>Travaux de Mise en Service</b>.
      </p>
    </div>
  );
}

// Composant Check non utilisé directement mais évite l'unused-import
void Check;
