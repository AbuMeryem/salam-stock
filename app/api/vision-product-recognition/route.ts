/**
 * POST /api/vision-product-recognition
 * Body : { photo_data_url: string }
 * Réponse : structured JSON describing the product on the carton.
 *
 * Si ANTHROPIC_API_KEY est set → Claude sonnet-4-5 vision.
 * Sinon → mock déterministe pour permettre la démo offline.
 */

import { NextResponse } from "next/server";

interface RecognitionBody {
  photo_data_url: string;
}

interface RecognitionResult {
  produit_reconnu: boolean;
  nom_suggere: string;
  marque_suggeree: string;
  categorie_suggeree: string;
  sous_categorie_suggeree: string;
  description_courte: string;
  quantite_carton_estimee: number;
  confiance: number;
  mock?: boolean;
}

const CATEGORIES = [
  "Épicerie sèche",
  "Boissons",
  "Surgelés",
  "Frais",
  "Maghreb",
  "Boucherie",
  "Hygiène",
  "Autre",
] as const;

export async function POST(req: Request) {
  let body: RecognitionBody;
  try {
    body = (await req.json()) as RecognitionBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.photo_data_url || typeof body.photo_data_url !== "string") {
    return NextResponse.json({ error: "missing_photo" }, { status: 400 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Mock — cycle through 3 fake recognitions so the demo looks live.
    const samples: RecognitionResult[] = [
      {
        produit_reconnu: true,
        nom_suggere: "Coca-Cola Zero 1.5L",
        marque_suggeree: "Coca-Cola",
        categorie_suggeree: "Boissons",
        sous_categorie_suggeree: "Sodas",
        description_courte: "Bouteille 1.5L, packaging rouge et noir",
        quantite_carton_estimee: 6,
        confiance: 0.92,
      },
      {
        produit_reconnu: true,
        nom_suggere: "Couscous moyen Dari 1kg",
        marque_suggeree: "Dari",
        categorie_suggeree: "Maghreb",
        sous_categorie_suggeree: "Semoules & couscous",
        description_courte: "Sachet 1 kg, couscous moyen marocain",
        quantite_carton_estimee: 12,
        confiance: 0.87,
      },
      {
        produit_reconnu: false,
        nom_suggere: "",
        marque_suggeree: "",
        categorie_suggeree: "Autre",
        sous_categorie_suggeree: "",
        description_courte: "Photo trop floue ou packaging non reconnu.",
        quantite_carton_estimee: 0,
        confiance: 0.3,
      },
    ];
    // Pseudo-random pick based on photo length so the demo stays varied
    // but deterministic for a given photo.
    const idx = body.photo_data_url.length % samples.length;
    return NextResponse.json({ ...samples[idx], mock: true });
  }

  // Real Claude vision call
  const m = body.photo_data_url.match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!m) {
    return NextResponse.json({ error: "invalid_image_format" }, { status: 400 });
  }
  const mediaType = m[1];
  const base64 = m[2];

  const system =
    "Tu es un expert en reconnaissance de produits alimentaires et d'épicerie pour un magasin halal en France. Tu analyses des photos de cartons de produits et tu retournes STRICTEMENT du JSON valide, sans préambule, sans bloc markdown.";

  const userText = [
    "Analyse cette photo de carton et identifie le produit qu'il contient.",
    "Retourne uniquement un JSON avec cette structure exacte :",
    "{",
    '  "produit_reconnu": bool,',
    '  "nom_suggere": "...",',
    '  "marque_suggeree": "...",',
    `  "categorie_suggeree": "${CATEGORIES.join("|")}",`,
    '  "sous_categorie_suggeree": "...",',
    '  "description_courte": "...",',
    '  "quantite_carton_estimee": int,',
    '  "confiance": float entre 0 et 1',
    "}",
    "",
    "Si tu ne reconnais pas le produit avec certitude, mets produit_reconnu: false et confiance < 0.5.",
  ].join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error("anthropic recognition error", r.status, errText);
      return NextResponse.json(
        { error: "anthropic_failure", status: r.status },
        { status: 502 }
      );
    }
    const json = (await r.json()) as { content?: Array<{ text?: string }> };
    const text = json.content?.[0]?.text ?? "{}";
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    let parsed: Partial<RecognitionResult> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // last-resort regex extract
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = {};
        }
      }
    }
    const result: RecognitionResult = {
      produit_reconnu: Boolean(parsed.produit_reconnu),
      nom_suggere: typeof parsed.nom_suggere === "string" ? parsed.nom_suggere : "",
      marque_suggeree:
        typeof parsed.marque_suggeree === "string" ? parsed.marque_suggeree : "",
      categorie_suggeree:
        typeof parsed.categorie_suggeree === "string" ? parsed.categorie_suggeree : "Autre",
      sous_categorie_suggeree:
        typeof parsed.sous_categorie_suggeree === "string"
          ? parsed.sous_categorie_suggeree
          : "",
      description_courte:
        typeof parsed.description_courte === "string" ? parsed.description_courte : "",
      quantite_carton_estimee:
        typeof parsed.quantite_carton_estimee === "number"
          ? Math.round(parsed.quantite_carton_estimee)
          : 0,
      confiance:
        typeof parsed.confiance === "number"
          ? Math.max(0, Math.min(1, parsed.confiance))
          : 0,
      mock: false,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("recognition internal", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
