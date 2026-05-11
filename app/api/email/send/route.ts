import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

interface EmailSendBody {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

  if (!apiKey || apiKey.includes("PLACEHOLDER")) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY non configurée. Create account sur resend.com, copie la clé dans Vercel env.",
      },
      { status: 503 }
    );
  }

  let body: EmailSendBody;
  try {
    body = (await req.json()) as EmailSendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.to || !body.subject) {
    return NextResponse.json(
      { error: "Champs `to` et `subject` requis" },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: `Salam Stock <${from}>`,
      to: Array.isArray(body.to) ? body.to : [body.to],
      subject: body.subject,
      html: body.html ?? `<pre>${body.text ?? ""}</pre>`,
      text: body.text,
    });
    if (error) throw new Error(JSON.stringify(error));
    return NextResponse.json({ id: data?.id, status: "sent" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email/send] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
