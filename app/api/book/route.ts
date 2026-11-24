import { NextRequest, NextResponse } from "next/server";
import { config, getEventType } from "@/config/booking.config.ts";
import { createEvent, getBusy, newEventId } from "@/lib/google.ts";
import { isSlotAvailable } from "@/lib/slots.ts";
import { rules } from "@/lib/rules.ts";
import { sign } from "@/lib/sign.ts";
import { formatJa } from "@/lib/time.ts";

export const dynamic = "force-dynamic";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const ev = getEventType(String(b?.slug ?? ""));
  if (!ev) return NextResponse.json({ error: "メニューが見つかりません" }, { status: 404 });

  const name = String(b.name ?? "").trim().slice(0, 100);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const company = String(b.company ?? "").trim().slice(0, 200);
  const message = String(b.message ?? "").trim().slice(0, 2000);
  const start = new Date(String(b.start ?? ""));
  if (!name) return NextResponse.json({ error: "お名前を入力してください" }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "メールアドレスが正しくありません" }, { status: 400 });
  if (ev.fields.company === "required" && !company) return NextResponse.json({ error: "会社名を入力してください" }, { status: 400 });
  if (ev.fields.message === "required" && !message) return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
  if (isNaN(start.getTime())) return NextResponse.json({ error: "日時が正しくありません" }, { status: 400 });

  const end = new Date(start.getTime() + ev.durationMinutes * 60000);
  try {
    const pad = Math.max(ev.bufferBeforeMinutes, ev.bufferAfterMinutes) * 60000 + 3600000;
    const busy = await getBusy(config.busyCalendars, new Date(start.getTime() - pad), new Date(end.getTime() + pad));
    if (!isSlotAvailable(ev, rules, busy, start.toISOString())) {
      return NextResponse.json({ error: "この時間はすでに埋まっています。別の時間を選んでください。" }, { status: 409 });
    }

    const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
    const locationText =
      ev.location.type === "zoom" ? ev.location.url : ev.location.type === "in_person" ? ev.location.address : undefined;
    const eventId = newEventId();
    const cancelUrl = `${appUrl}/cancel/${eventId}?sig=${sign(eventId)}`;
    const lines = [
      `予約メニュー: ${ev.name}`,
      `お名前: ${name}`,
      `メール: ${email}`,
      company && `会社名: ${company}`,
      message && `\nメッセージ:\n${message}`,
      `\nキャンセルはこちら: ${cancelUrl}`,
    ].filter(Boolean);

    const created = await createEvent({
      id: eventId,
      calendarId: config.bookingCalendar,
      summary: `${ev.name} - ${name}様`,
      description: lines.join("\n"),
      start,
      end,
      timeZone: config.timeZone,
      attendee: { email, name },
      googleMeet: ev.location.type === "google_meet",
      location: locationText,
    });

    return NextResponse.json({
      ok: true,
      eventId: created.id,
      start: start.toISOString(),
      end: end.toISOString(),
      label: formatJa(start, config.timeZone, { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }),
      meetUrl: created.meetUrl ?? null,
      locationText: locationText ?? null,
      cancelUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "予約の作成に失敗しました。時間をおいて再度お試しください。" }, { status: 502 });
  }
}
