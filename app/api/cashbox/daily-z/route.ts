import { NextResponse } from "next/server";
import { computeDailyZ, yesterdayIsoParis } from "@/lib/cashbox/daily-z";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || yesterdayIsoParis();

  // Validation grossière : doit être YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const summary = await computeDailyZ(date);
    return NextResponse.json(summary, {
      headers: { "cache-control": "private, max-age=30" },
    });
  } catch (err) {
    console.error("[daily-z] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
