import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { cancelEvent } from "@/lib/google.ts";
import { verify } from "@/lib/sign.ts";
import { markCancelled } from "@/lib/bookingsDb.ts";
import { getEvent } from "@/lib/google.ts";
import { notifyLine } from "@/lib/line.ts";
import { formatJa } from "@/lib/time.ts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const id = String(b?.eventId ?? "");
  const sig = String(b?.sig ?? "");
  if (!id || !verify(id, sig)) return NextResponse.json({ error: "無効なリンクです" }, { status: 403 });
  try {
    const before = await getEvent(config.bookingCalendar, id).catch(() => null);
    await cancelEvent(config.bookingCalendar, id);
    await markCancelled(id, "guest").catch((e) => console.error("markCancelled failed", e));
    if (before && before.status !== "cancelled") {
      const when = formatJa(before.start, "Asia/Tokyo", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
      await notifyLine(`❌ 面談予約のキャンセル（お客様から）\n${before.summary}\n${when}〜`).catch((e) => console.error("notifyLine failed", e));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "キャンセルに失敗しました" }, { status: 502 });
  }
}
