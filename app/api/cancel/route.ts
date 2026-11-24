import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { cancelEvent } from "@/lib/google.ts";
import { verify } from "@/lib/sign.ts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const id = String(b?.eventId ?? "");
  const sig = String(b?.sig ?? "");
  if (!id || !verify(id, sig)) return NextResponse.json({ error: "無効なリンクです" }, { status: 403 });
  try {
    await cancelEvent(config.bookingCalendar, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "キャンセルに失敗しました" }, { status: 502 });
  }
}
