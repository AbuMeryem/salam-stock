import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Délègue à /api/push/send avec un payload "test" cosmétique. Sépare
 *  l'endpoint test du send réel pour qu'on puisse logger / rate-limiter
 *  différemment plus tard. */
export async function POST(req: Request) {
  let employe_id: string | undefined;
  try {
    const body = (await req.json()) as { employe_id?: string };
    employe_id = body.employe_id;
  } catch {
    /* body optionnel */
  }

  // URL absolue obligatoire pour fetch interne dans une Route Handler.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    `https://${req.headers.get("host") ?? "salam-stock.vercel.app"}`;

  const res = await fetch(`${origin}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "🟢 Test Salam Stock",
      body: "Notifications actives. Vous recevrez les alertes IA, casses suspectes et ruptures critiques en temps réel.",
      url: "/v2/admin",
      tag: "test",
      employe_ids: employe_id ? [employe_id] : undefined,
    }),
  });

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
