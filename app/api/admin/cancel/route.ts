import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { isAdmin } from "@/lib/admin.ts";
import { cancelEvent } from "@/lib/google.ts";
import { markCancelled } from "@/lib/bookingsDb.ts";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.eventId ?? "");
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await cancelEvent(config.bookingCalendar, id);
    await markCancelled(id, "admin").catch((e) => console.error("markCancelled failed", e));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "キャンセルに失敗しました" }, { status: 502 });
  }
}
