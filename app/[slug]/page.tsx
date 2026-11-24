import { notFound } from "next/navigation";
import { config, getEventType } from "@/config/booking.config.ts";
import BookingWidget from "@/components/BookingWidget";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = getEventType(slug);
  if (!ev) notFound();
  const locationLabel = { google_meet: "Google Meet", zoom: "Zoom", in_person: "対面", phone: "電話" }[ev.location.type];
  return (
    <main className="wrap wide">
      <div className="card booking">
        <aside className="info">
          <p className="muted small">{config.teamName}</p>
          <h1 style={{ color: ev.color }}>{ev.name}</h1>
          <ul className="meta">
            <li>🕒 {ev.durationMinutes}分</li>
            <li>📍 {locationLabel}</li>
            <li>🌏 日本時間 ({config.timeZone})</li>
          </ul>
          <p className="desc">{ev.description}</p>
        </aside>
        <BookingWidget
          slug={ev.slug}
          color={ev.color}
          timeZone={config.timeZone}
          durationMinutes={ev.durationMinutes}
          fields={ev.fields}
          windowDays={ev.bookingWindowDays}
        />
      </div>
    </main>
  );
}
