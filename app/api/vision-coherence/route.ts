/**
 * POST /api/vision-coherence
 * Body: { photo_data_url: string, type: string, produit_nom: string, quantite: number }
 * Returns: { coherence_score, produit_visible, defaut_visible, quantite_coherente, notes, mock }
 *
 * If ANTHROPIC_API_KEY is set, calls Claude vision (claude-sonnet-4-6).
 * Else returns a deterministic-ish mock score so the app keeps working.
 */

import { NextResponse } from "next/server";

interface CoherenceRequest {
  photo_data_url: string;
  type: string;
  produit_nom: string;
  quantite: number;
}

interface CoherenceResult {
  coherence_score: number;
  produit_visible: boolean;
  defaut_visible: boolean;
  quantite_coherente: boolean;
  notes: string;
  mock: boolean;
}

export async function POST(req: Request) {
  let body: CoherenceRequest;
  try {
    body = (await req.json()) as CoherenceRequest;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Deterministic mock — vary by sortie type so the demo dashboard shows realistic flags.
    const lowConfTypes = ["demarque_inconnue", "autre"];
    const score = lowConfTypes.includes(body.type)
      ? 0.45 + Math.random() * 0.15
      : 0.78 + Math.random() * 0.18;
    const result: CoherenceResult = {
      coherence_score: parseFloat(score.toFixed(2)),
      produit_visible: true,
      defaut_visible: !["autre"].includes(body.type),
      quantite_coherente: body.quantite <= 10,
      notes: `Mock IA — type=${body.type}, qté=${body.quantite}. ANTHROPIC_API_KEY non configurée.`,
      mock: true,
    };
    return NextResponse.json(result);
  }

  // Real Claude vision call
  try {
    const dataUrl = body.photo_data_url;
    const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!m) return NextResponse.json({ error: "invalid_image" }, { status: 400 });
    const mediaType = m[1];
    const base64 = m[2];

    const prompt = [
      `Analyse cette photo dans le contexte d'une déclaration de sortie de stock.`,
      `Type déclaré : ${body.type}.`,
      `Produit déclaré : ${body.produit_nom}.`,
      `Quantité déclarée : ${body.quantite}.`,
      ``,
      `Réponds STRICTEMENT en JSON sans préambule :`,
      `{`,
      `  "coherence_score": <number entre 0 et 1>,`,
      `  "produit_visible": <bool>,`,
      `  "defaut_visible": <bool>,`,
      `  "quantite_coherente": <bool>,`,
      `  "notes": "<analyse courte 1-2 phrases en français>"`,
      `}`,
    ].join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("anthropic error", r.status, errText);
      return NextResponse.json(
        { error: "anthropic_failure", status: r.status },
        { status: 502 }
      );
    }
    const json = (await r.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.[0]?.text ?? "{}";
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    let parsed: Partial<CoherenceResult> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { notes: text.slice(0, 200) };
    }
    const result: CoherenceResult = {
      coherence_score: typeof parsed.coherence_score === "number" ? parsed.coherence_score : 0.5,
      produit_visible: parsed.produit_visible ?? false,
      defaut_visible: parsed.defaut_visible ?? false,
      quantite_coherente: parsed.quantite_coherente ?? true,
      notes: parsed.notes ?? "",
      mock: false,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
