import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { findMenu, getSettings, rulesOf } from "@/lib/settings.ts";
import { getBusy } from "@/lib/google.ts";
import { computeSlots } from "@/lib/slots.ts";
import { addDays, zonedToUtc } from "@/lib/time.ts";

export const dynamic = "force-dynamic";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const s = await getSettings();
  const ev = await findMenu(q.get("slug") ?? "");
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!ev) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!DATE.test(from) || !DATE.test(to) || from > to || addDays(from, 62) < to) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 });
  }
  try {
    const busy = await getBusy(
      config.busyCalendars,
      zonedToUtc(addDays(from, -1), "00:00", s.timeZone),
      zonedToUtc(addDays(to, 2), "00:00", s.timeZone),
    );
    return NextResponse.json({ timeZone: s.timeZone, slots: computeSlots(ev, rulesOf(s), busy, from, to) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "カレンダーの取得に失敗しました" }, { status: 502 });
  }
}
