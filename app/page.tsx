import Link from "next/link";
import { getSettings } from "@/lib/settings.ts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const config = await getSettings();
  return (
    <main className="wrap">
      <header className="team">
        <div className="avatar">{config.teamName.slice(0, 1)}</div>
        <h1>{config.teamName}</h1>
        <p className="muted">ご希望のメニューを選んでください</p>
      </header>
      <ul className="menu">
        {config.eventTypes.filter((e) => e.active).map((ev) => (
          <li key={ev.slug}>
            <Link href={`/${ev.slug}`} className="menu-item" style={{ borderLeftColor: ev.color }}>
              <span className="menu-name">{ev.name}</span>
              <span className="muted">🕒 {ev.durationMinutes}分</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted small" style={{ textAlign: "center", marginTop: 24 }}>
        <a href="/privacy">プライバシーポリシー</a>　<a href="/terms">利用規約</a>
      </p>
    </main>
  );
}
