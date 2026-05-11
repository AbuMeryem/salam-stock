import { NextResponse } from "next/server";
import { computeMonthlyReport, currentMonthYYYYMM } from "@/lib/cashbox/monthly-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mois = url.searchParams.get("mois") || currentMonthYYYYMM();
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    return NextResponse.json({ error: "mois must be YYYY-MM" }, { status: 400 });
  }
  try {
    return NextResponse.json(await computeMonthlyReport(mois));
  } catch (err) {
    console.error("[monthly-report]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
