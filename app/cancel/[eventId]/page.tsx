import { config } from "@/config/booking.config.ts";
import { getEvent } from "@/lib/google.ts";
import { verify } from "@/lib/sign.ts";
import { formatJa } from "@/lib/time.ts";
import CancelButton from "@/components/CancelButton";

export const dynamic = "force-dynamic";

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ sig?: string }>;
}) {
  const { eventId } = await params;
  const { sig = "" } = await searchParams;
  const valid = verify(eventId, sig);
  const ev = valid ? await getEvent(config.bookingCalendar, eventId) : null;
  return (
    <main className="wrap">
      <div className="card pad center">
        {!valid ? (
          <p>このリンクは無効です。</p>
        ) : !ev || ev.status === "cancelled" ? (
          <p>この予約は見つからないか、すでにキャンセルされています。</p>
        ) : (
          <>
            <h1>予約のキャンセル</h1>
            <p className="big">{ev.summary}</p>
            <p>
              {formatJa(ev.start, config.timeZone, { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}
              {" 〜 "}
              {formatJa(ev.end, config.timeZone, { hour: "2-digit", minute: "2-digit" })}
            </p>
            <CancelButton eventId={eventId} sig={sig} />
          </>
        )}
      </div>
    </main>
  );
}
