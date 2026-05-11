import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface PushSendBody {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
  employe_ids?: string[];
  alerte_id?: string;
}

interface Subscription {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

function configureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:ceo@hamy.studio";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function POST(req: Request) {
  if (!configureVapid()) {
    return NextResponse.json(
      { error: "VAPID keys not configured server-side" },
      { status: 500 }
    );
  }

  let body: PushSendBody;
  try {
    body = (await req.json()) as PushSendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const sb = supabaseServer();
  let query = sb
    .from("push_subscriptions")
    .select("id, endpoint, keys_p256dh, keys_auth")
    .eq("enabled", true);
  if (body.employe_ids?.length) {
    query = query.in("employe_id", body.employe_ids);
  }
  const { data: subs, error } = await query;
  if (error) {
    console.error("[push/send] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const subscriptions = (subs ?? []) as Subscription[];

  const payload = JSON.stringify({
    title: body.title,
    body: body.body ?? "",
    url: body.url ?? "/v2/admin",
    tag: body.tag ?? "salam",
    urgent: body.urgent === true,
    alerteId: body.alerte_id,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
          payload
        );
        await sb
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
        return { ok: true };
      } catch (err) {
        const e = err as { statusCode?: number; message?: string };
        // 410 Gone / 404 Not Found → la subscription est morte côté
        // navigateur (app supprimée, permission révoquée). On la
        // désactive pour ne pas pourrir les envois suivants.
        if (e.statusCode === 410 || e.statusCode === 404) {
          await sb
            .from("push_subscriptions")
            .update({ enabled: false })
            .eq("id", s.id);
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    sent,
    failed,
    total: subscriptions.length,
  });
}
