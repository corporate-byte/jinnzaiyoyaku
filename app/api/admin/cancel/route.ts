import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { isAdmin } from "@/lib/admin.ts";
import { cancelEvent } from "@/lib/google.ts";
import { markCancelled } from "@/lib/bookingsDb.ts";
import { getEvent } from "@/lib/google.ts";
import { notifyLine } from "@/lib/line.ts";
import { formatJa } from "@/lib/time.ts";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.eventId ?? "");
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const before = await getEvent(config.bookingCalendar, id).catch(() => null);
    await cancelEvent(config.bookingCalendar, id);
    await markCancelled(id, "admin").catch((e) => console.error("markCancelled failed", e));
    if (before && before.status !== "cancelled") {
      const when = formatJa(before.start, "Asia/Tokyo", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
      await notifyLine(`❌ 面談予約のキャンセル（管理画面から）\n${before.summary}\n${when}〜`).catch((e) => console.error("notifyLine failed", e));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "キャンセルに失敗しました" }, { status: 502 });
  }
}
