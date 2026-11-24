import Link from "next/link";
import { config } from "@/config/booking.config.ts";

export default function Home() {
  return (
    <main className="wrap">
      <header className="team">
        <div className="avatar">{config.teamName.slice(0, 1)}</div>
        <h1>{config.teamName}</h1>
        <p className="muted">ご希望のメニューを選んでください</p>
      </header>
      <ul className="menu">
        {config.eventTypes.map((ev) => (
          <li key={ev.slug}>
            <Link href={`/${ev.slug}`} className="menu-item" style={{ borderLeftColor: ev.color }}>
              <span className="menu-name">{ev.name}</span>
              <span className="muted">🕒 {ev.durationMinutes}分</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
