// Edge function "ensure-slots"
// Génère de manière idempotente les créneaux de retrait pour J+0 à J+6
// en se basant sur le fuseau Europe/Paris.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fromZonedTime, format } from "https://esm.sh/date-fns-tz@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TZ = "Europe/Paris";
const CAPACITY = 5;

const WEEKDAY_SLOTS: Array<[string, string]> = [
  ["10:00", "10:30"],
  ["12:00", "12:30"],
  ["17:00", "17:30"],
  ["19:00", "19:30"],
];

// Dimanche : magasin ferme à 18h, pas de créneau 19h
const SUNDAY_SLOTS: Array<[string, string]> = [
  ["10:00", "10:30"],
  ["12:00", "12:30"],
  ["17:00", "17:30"],
];

function parisDateToUtc(parisYmd: string, hhmm: string): Date {
  // parisYmd = "2026-04-28", hhmm = "10:00"
  return fromZonedTime(`${parisYmd}T${hhmm}:00`, TZ);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowUtc = new Date();

    // On génère les ymd Paris pour J+0..J+6 en se basant sur la date Paris d'aujourd'hui
    const todayParisYmd = format(nowUtc, "yyyy-MM-dd", { timeZone: TZ });
    const [ty, tm, td] = todayParisYmd.split("-").map(Number);

    const rows: Array<{ slot_start: string; slot_end: string; capacity: number }> = [];

    for (let offset = 0; offset <= 6; offset++) {
      // construire la date Paris J+offset
      // on crée un Date UTC à midi puis on lit son ymd via format(timeZone) — robuste contre DST
      const baseUtc = Date.UTC(ty, tm - 1, td + offset, 12, 0, 0);
      const dayParisYmd = format(new Date(baseUtc), "yyyy-MM-dd", { timeZone: TZ });
      // jour ISO 1..7 (lun=1, dim=7) en heure Paris
      const isoDay = Number(format(new Date(baseUtc), "i", { timeZone: TZ }));
      const isSunday = isoDay === 7;
      const list = isSunday ? SUNDAY_SLOTS : WEEKDAY_SLOTS;

      for (const [start, end] of list) {
        rows.push({
          slot_start: parisDateToUtc(dayParisYmd, start).toISOString(),
          slot_end: parisDateToUtc(dayParisYmd, end).toISOString(),
          capacity: CAPACITY,
        });
      }
    }

    const { error: insertErr } = await supabase
      .from("pickup_slots")
      .upsert(rows, { onConflict: "slot_start", ignoreDuplicates: true });

    if (insertErr) throw insertErr;

    const sevenDaysLater = new Date(nowUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data, error: selErr } = await supabase
      .from("pickup_slots")
      .select("*")
      .gte("slot_start", nowUtc.toISOString())
      .lt("slot_start", sevenDaysLater.toISOString())
      .order("slot_start", { ascending: true });

    if (selErr) throw selErr;

    return new Response(JSON.stringify({ slots: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
