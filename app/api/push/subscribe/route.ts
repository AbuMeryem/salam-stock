import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface SubscribeBody {
  employe_id?: string | null;
  user_id?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

/** Upsert d'une push subscription. Server-side parce que la RLS de la
 *  table est stricte (anon ne peut pas INSERT directement). On utilise
 *  SUPABASE_SERVICE_ROLE_KEY pour bypass. */
export async function POST(req: Request) {
  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json(
      { error: "Missing endpoint / p256dh / auth" },
      { status: 400 }
    );
  }

  const sb = supabaseServer();
  // La table prod a été renommée via 0014 : utilise keys_p256dh /
  // keys_auth (pas p256dh/auth). user_id reste nullable depuis 0015.
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: body.user_id ?? null,
      employe_id: body.employe_id ?? null,
      endpoint: body.endpoint,
      keys_p256dh: body.p256dh,
      keys_auth: body.auth,
      user_agent: body.user_agent ?? null,
      enabled: true,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push/subscribe] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let body: { employe_id?: string; endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sb = supabaseServer();
  let q = sb.from("push_subscriptions").update({ enabled: false });
  if (body.endpoint) q = q.eq("endpoint", body.endpoint);
  else if (body.employe_id) q = q.eq("employe_id", body.employe_id);
  else
    return NextResponse.json(
      { error: "employe_id ou endpoint requis" },
      { status: 400 }
    );
  const { error } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
