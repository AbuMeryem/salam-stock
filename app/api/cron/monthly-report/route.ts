import { NextResponse } from "next/server";
import { computeMonthlyReport, previousMonthYYYYMM } from "@/lib/cashbox/monthly-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const mois = previousMonthYYYYMM();
  try {
    const report = await computeMonthlyReport(mois);
    const origin = new URL(req.url).origin;
    const notif = await fetch(`${origin}/api/notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "monthly_report_auto",
        payload: {
          mois, ca_total: report.consolidation.ca_ttc_total,
          partial: report.magasin.partial,
          pdf_url: `${origin}/api/cashbox/monthly-report-pdf?mois=${mois}`,
          csv_url: `${origin}/api/cashbox/monthly-report-csv?mois=${mois}`,
        },
      }),
    });
    return NextResponse.json({
      ok: true, mois, ca_total: report.consolidation.ca_ttc_total,
      notify_status: notif.ok ? "sent" : "failed",
    });
  } catch (err) {
    console.error("[cron/monthly-report]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
