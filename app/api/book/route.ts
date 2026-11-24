import { NextRequest, NextResponse } from "next/server";
import { config } from "@/config/booking.config.ts";
import { findMenu, getSettings, rulesOf } from "@/lib/settings.ts";
import { recordBooking } from "@/lib/bookingsDb.ts";
import { createEvent, getBusy, newEventId } from "@/lib/google.ts";
import { isSlotAvailable } from "@/lib/slots.ts";
import { sign } from "@/lib/sign.ts";
import { formatJa } from "@/lib/time.ts";

export const dynamic = "force-dynamic";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const s = await getSettings();
  const ev = await findMenu(String(b?.slug ?? ""));
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
    const busy = await getBusy(config.busyCalendars, new Date(start.getTime() - pad), new Date(end.getTime() + pad), s.hostEmail ? [s.hostEmail] : []);
    if (!isSlotAvailable(ev, rulesOf(s), busy, start.toISOString())) {
      return NextResponse.json({ error: "この時間はすでに埋まっています。別の時間を選んでください。" }, { status: 409 });
    }

    const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
    const locationText =
      ev.location.type === "zoom" ? ev.location.url : ev.location.type === "in_person" ? ev.location.address : undefined;
    const eventId = newEventId();
    const cancelUrl = `${appUrl}/cancel/${eventId}?sig=${sign(eventId)}`;
    const lines = [
      `予約メニュー: ${ev.name}`,
      s.hostName && `担当: ${s.hostName}`,
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
      timeZone: s.timeZone,
      attendee: { email, name },
      extraAttendees: s.hostEmail && s.hostEmail.toLowerCase() !== email.toLowerCase() ? [{ email: s.hostEmail, name: s.hostName || "担当者" }] : [],
      googleMeet: ev.location.type === "google_meet",
      location: locationText,
      // 拡張プロパティは1値1024バイトまで
      meta: { slug: ev.slug, menu: ev.name, name, email, company, message: message.slice(0, 300) },
    });

    // 予約記録を Supabase に保存（失敗しても予約自体は成立しているので続行）
    await recordBooking({
      id: created.id, slug: ev.slug, menu: ev.name, start, end, name, email, company, message, meetUrl: created.meetUrl,
    }).catch((e) => console.error("recordBooking failed", e));

    return NextResponse.json({
      ok: true,
      eventId: created.id,
      start: start.toISOString(),
      end: end.toISOString(),
      label: formatJa(start, s.timeZone, { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }),
      meetUrl: created.meetUrl ?? null,
      locationText: locationText ?? null,
      cancelUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "予約の作成に失敗しました。時間をおいて再度お試しください。" }, { status: 502 });
  }
}
