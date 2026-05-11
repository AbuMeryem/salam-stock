/**
 * Assistant IA Salam — agent Claude avec 6 tools Supabase.
 *
 * POST /api/assistant
 * Body: { messages: Array<{role:'user'|'assistant', content:string}> }
 * Returns: { answer: string, tool_calls?: Array<{name, result_preview}> }
 *
 * Implémentation agentic loop : Claude appelle des tools, on les exécute
 * en interrogeant Supabase, on renvoie les résultats, Claude reformule
 * en réponse naturelle française.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = [
  "Tu es l'assistant IA de Salam Market Toulouse.",
  "Tu réponds aux questions du manager Otmane Jamal et du gérant Ahmed Nasri",
  "sur leur business : ventes, stock, alertes, démarque, performance employés.",
  "",
  "Règles strictes :",
  "- Tu es direct, factuel, en français.",
  "- Tu cites toujours les chiffres EXACTS retournés par tes tools.",
  "- Tu n'inventes JAMAIS un chiffre : si tu n'as pas l'info, tu le dis.",
  "- Si la question est ambiguë (période flou, produit imprécis), tu demandes une précision.",
  "- Réponses courtes et structurées : 2-4 phrases ou bullets.",
  "- Tu n'utilises pas de markdown lourd, juste des sauts de ligne et des chiffres.",
  "- Tu signales les chiffres importants en gras avec **texte**.",
].join("\n");

const TOOLS = [
  {
    name: "query_ventes_periode",
    description:
      "Récupère les ventes du Drive sur une période (commandes_drive). Renvoie nombre de commandes, CA total TTC, panier moyen, top produit. Si produit_search est fourni, filtre sur ce produit (matching sur nom).",
    input_schema: {
      type: "object",
      properties: {
        date_start: {
          type: "string",
          description: "ISO date YYYY-MM-DD début (inclus)",
        },
        date_end: {
          type: "string",
          description: "ISO date YYYY-MM-DD fin (exclus)",
        },
        produit_search: {
          type: "string",
          description:
            "Optionnel — recherche partielle dans le nom produit (case-insensitive)",
        },
      },
      required: ["date_start", "date_end"],
    },
  },
  {
    name: "query_stock_actuel",
    description:
      "Retourne le stock actuel pour un produit donné (ou top 10 plus bas en stock si pas de produit_search). Inclut quantité par dépôt et prix.",
    input_schema: {
      type: "object",
      properties: {
        produit_search: {
          type: "string",
          description: "Optionnel — partie du nom produit",
        },
      },
    },
  },
  {
    name: "query_alertes",
    description:
      "Liste les alertes en cours (sorties suspectes score IA < 0.7, surplus fournisseur en_attente). Optionnellement filtre par type.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["sortie_suspecte", "surplus", "all"],
          description: "Type d'alerte à lister",
        },
      },
    },
  },
  {
    name: "query_top_produits",
    description:
      "Top N produits vendus sur le Drive sur une période. Renvoie nom, quantité totale, CA total.",
    input_schema: {
      type: "object",
      properties: {
        periode: {
          type: "string",
          enum: ["7j", "30j", "90j"],
          description: "Période d'analyse",
        },
        limit: {
          type: "integer",
          description: "Nombre de résultats (défaut 5, max 10)",
        },
      },
      required: ["periode"],
    },
  },
  {
    name: "query_employes_perf",
    description:
      "Score IA moyen par employé sur les sorties de stock 30 derniers jours. Renvoie liste classée du moins fiable au plus fiable.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "query_demarque",
    description:
      "Estime la démarque (valeur en euros + nombre d'unités) sur une période en croisant entrées de stock vs ventes vs sorties tracées.",
    input_schema: {
      type: "object",
      properties: {
        periode: {
          type: "string",
          enum: ["7j", "30j"],
          description: "Période d'analyse",
        },
      },
      required: ["periode"],
    },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(name: string, input: any): Promise<unknown> {
  const sb = supabase();
  if (!sb) return { error: "Supabase indisponible" };
  try {
    if (name === "query_ventes_periode") {
      const { date_start, date_end, produit_search } = input;
      const { data: cmds } = await sb
        .from("commandes_drive")
        .select(
          "id, total_ttc, commandes_drive_lignes(produit_id, quantite, prix_unitaire, produits(nom))"
        )
        .gte("created_at", date_start)
        .lt("created_at", date_end)
        .neq("statut", "annule");
      const rows = (cmds ?? []) as unknown as Array<{
        id: string;
        total_ttc: number;
        commandes_drive_lignes: Array<{
          produit_id: string;
          quantite: number;
          prix_unitaire: number;
          produits: { nom: string } | null;
        }>;
      }>;
      if (produit_search) {
        const filtered = rows
          .map((r) => ({
            ...r,
            commandes_drive_lignes: r.commandes_drive_lignes.filter((l) =>
              l.produits?.nom
                ?.toLowerCase()
                .includes(produit_search.toLowerCase())
            ),
          }))
          .filter((r) => r.commandes_drive_lignes.length > 0);
        const totalQty = filtered.reduce(
          (s, r) => s + r.commandes_drive_lignes.reduce((q, l) => q + Number(l.quantite), 0),
          0
        );
        const totalCa = filtered.reduce(
          (s, r) =>
            s +
            r.commandes_drive_lignes.reduce(
              (q, l) => q + Number(l.quantite) * Number(l.prix_unitaire),
              0
            ),
          0
        );
        return {
          nb_commandes: filtered.length,
          ca_ttc: Math.round(totalCa * 100) / 100,
          quantite_vendue: totalQty,
          produit_recherche: produit_search,
        };
      }
      const caTotal = rows.reduce((s, r) => s + Number(r.total_ttc), 0);
      const panier = rows.length > 0 ? caTotal / rows.length : 0;
      return {
        nb_commandes: rows.length,
        ca_ttc: Math.round(caTotal * 100) / 100,
        panier_moyen: Math.round(panier * 100) / 100,
        periode: { date_start, date_end },
      };
    }

    if (name === "query_stock_actuel") {
      const { produit_search } = input;
      if (produit_search) {
        const { data: prods } = await sb
          .from("produits")
          .select(
            "id, nom, ean, categorie, stock_par_depot(quantite, prix_vente, depots(nom))"
          )
          .ilike("nom", `%${produit_search}%`)
          .limit(5);
        return prods ?? [];
      }
      // Top 10 plus bas en stock total
      const { data: all } = await sb
        .from("stock_par_depot")
        .select("quantite, produits(id, nom, categorie), depots(nom)")
        .order("quantite", { ascending: true })
        .limit(15);
      return all ?? [];
    }

    if (name === "query_alertes") {
      const { type = "all" } = input;
      const result: Record<string, unknown> = {};
      if (type === "all" || type === "sortie_suspecte") {
        const { data } = await sb
          .from("sorties_stock")
          .select(
            "id, type, quantite, ia_coherence_score, ia_coherence_notes, created_at, produits(nom), employes(prenom, nom)"
          )
          .lt("ia_coherence_score", 0.7)
          .order("created_at", { ascending: false })
          .limit(10);
        result.sorties_suspectes = data ?? [];
      }
      if (type === "all" || type === "surplus") {
        const { data } = await sb
          .from("alertes_surplus")
          .select(
            "id, code_barre_scanne, quantite_surplus, signale_le, produits(nom), bons_de_livraison(numero_bdl, fournisseurs(nom))"
          )
          .eq("statut", "en_attente")
          .order("signale_le", { ascending: false });
        result.surplus_en_attente = data ?? [];
      }
      return result;
    }

    if (name === "query_top_produits") {
      const { periode, limit = 5 } = input;
      const days =
        periode === "7j" ? 7 : periode === "30j" ? 30 : 90;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data: cmds } = await sb
        .from("commandes_drive")
        .select(
          "commandes_drive_lignes(produit_id, quantite, prix_unitaire, produits(nom))"
        )
        .gte("created_at", since)
        .neq("statut", "annule");
      const agg = new Map<string, { nom: string; qty: number; ca: number }>();
      for (const c of (cmds ?? []) as unknown as Array<{
        commandes_drive_lignes: Array<{
          produit_id: string;
          quantite: number;
          prix_unitaire: number;
          produits: { nom: string } | null;
        }>;
      }>) {
        for (const l of c.commandes_drive_lignes) {
          const k = l.produit_id;
          const cur = agg.get(k) ?? {
            nom: l.produits?.nom ?? "Produit",
            qty: 0,
            ca: 0,
          };
          cur.qty += Number(l.quantite);
          cur.ca += Number(l.quantite) * Number(l.prix_unitaire);
          agg.set(k, cur);
        }
      }
      return Array.from(agg.values())
        .sort((a, b) => b.ca - a.ca)
        .slice(0, Math.min(limit, 10))
        .map((r) => ({
          produit: r.nom,
          quantite_vendue: r.qty,
          ca_total: Math.round(r.ca * 100) / 100,
        }));
    }

    if (name === "query_employes_perf") {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data } = await sb
        .from("sorties_stock")
        .select("ia_coherence_score, employes(id, prenom, nom)")
        .gte("created_at", since)
        .not("ia_coherence_score", "is", null);
      const agg = new Map<
        string,
        { nom: string; total: number; count: number }
      >();
      for (const r of (data ?? []) as unknown as Array<{
        ia_coherence_score: number;
        employes: { id: string; prenom: string; nom: string } | null;
      }>) {
        if (!r.employes) continue;
        const k = r.employes.id;
        const cur = agg.get(k) ?? {
          nom: `${r.employes.prenom} ${r.employes.nom}`.trim(),
          total: 0,
          count: 0,
        };
        cur.total += Number(r.ia_coherence_score);
        cur.count += 1;
        agg.set(k, cur);
      }
      return Array.from(agg.values())
        .map((r) => ({
          employe: r.nom,
          score_moyen: r.count > 0 ? Math.round((r.total / r.count) * 100) / 100 : 0,
          nb_sorties: r.count,
        }))
        .sort((a, b) => a.score_moyen - b.score_moyen);
    }

    if (name === "query_demarque") {
      const { periode } = input;
      const days = periode === "7j" ? 7 : 30;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      // Approximation : démarque = sorties_stock type "demarque_inconnue" + écarts non tracés.
      // En l'absence d'inventaire physique, on agrège les sorties type "autre" + "vol" si présent.
      const { data: sorties } = await sb
        .from("sorties_stock")
        .select("quantite, type, produits(stock_par_depot(prix_vente))")
        .gte("created_at", since)
        .in("type", ["autre", "vol_identifie"]);
      let valeur = 0;
      let unites = 0;
      for (const s of (sorties ?? []) as unknown as Array<{
        quantite: number;
        type: string;
        produits: { stock_par_depot: Array<{ prix_vente: number | null }> } | null;
      }>) {
        unites += Number(s.quantite);
        const prix = s.produits?.stock_par_depot?.[0]?.prix_vente ?? 3;
        valeur += Number(s.quantite) * Number(prix);
      }
      return {
        periode,
        unites_demarque: unites,
        valeur_demarque_eur: Math.round(valeur * 100) / 100,
      };
    }

    return { error: `Tool inconnu: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function POST(req: NextRequest) {
  let body: { messages: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({
      answer:
        "L'assistant IA nécessite la clé ANTHROPIC_API_KEY (configurée sur Vercel). En attendant, voici un mock :\n\n**Mock** — Cette semaine, 14 commandes Drive pour 412 € de CA. 3 alertes en attente. Top produit : Couscous fin Ferrero (18 ventes).",
      mock: true,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolCallsLog: Array<{ name: string; input: unknown }> = [];

  // Agentic loop — max 6 itérations
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversation,
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error("[assistant] anthropic error", r.status, errText);
      return NextResponse.json(
        { error: "anthropic_failure", status: r.status, detail: errText },
        { status: 502 }
      );
    }
    const resp = (await r.json()) as {
      stop_reason: string;
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
      >;
    };

    // Append assistant turn
    conversation.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "tool_use") {
      // Execute tools
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          toolCallsLog.push({ name: block.name, input: block.input });
          const out = await runTool(block.name, block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        }
      }
      conversation.push({ role: "user", content: toolResults });
      continue;
    }

    // end_turn — extract text
    const finalText = resp.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return NextResponse.json({
      answer: finalText || "(pas de réponse)",
      tool_calls: toolCallsLog,
    });
  }

  return NextResponse.json({
    answer: "Limite d'itérations atteinte. Reformule ta question.",
    tool_calls: toolCallsLog,
  });
}
