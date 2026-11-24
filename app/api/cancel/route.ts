import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { cancelEvent } from "@/lib/google.ts";
import { verify } from "@/lib/sign.ts";
import { markCancelled } from "@/lib/bookingsDb.ts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const id = String(b?.eventId ?? "");
  const sig = String(b?.sig ?? "");
  if (!id || !verify(id, sig)) return NextResponse.json({ error: "無効なリンクです" }, { status: 403 });
  try {
    await cancelEvent(config.bookingCalendar, id);
    await markCancelled(id, "guest").catch((e) => console.error("markCancelled failed", e));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "キャンセルに失敗しました" }, { status: 502 });
  }
}
