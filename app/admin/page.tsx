import Link from "next/link";
import { redirect } from "next/navigation";
import { config as calendars } from "@/config/booking.config.ts";
import { getSettings } from "@/lib/settings.ts";
import { listBookingsDb } from "@/lib/bookingsDb.ts";
import { supabaseEnabled } from "@/lib/supabase.ts";
import { isAdmin } from "@/lib/admin.ts";
import { connectionStatus, listBookings, type Booking } from "@/lib/google.ts";
import { addDays, formatJa, localDateStr, zonedToUtc } from "@/lib/time.ts";
import AdminCancelButton from "@/components/AdminCancelButton";
import LineTestButton from "@/components/LineTestButton";
import { lineEnabled, listTargets } from "@/lib/line.ts";

export const dynamic = "force-dynamic";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const LOCATION = { google_meet: "Google Meet", zoom: "Zoom", in_person: "対面", phone: "電話" };

// Supabase があれば予約記録から、なければ Google カレンダーから一覧を取る
function fetchBookings(from: Date, to: Date): Promise<Booking[]> {
  return supabaseEnabled() ? listBookingsDb(from, to) : listBookings(calendars.bookingCalendar, from, to);
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { view } = await searchParams;
  const past = view === "past";
  const config = await getSettings();
  const tz = config.timeZone;
  const today = localDateStr(new Date(), tz);
  const now = new Date();

  const [status, bookings] = await Promise.all([
    connectionStatus(),
    (past
      ? fetchBookings(zonedToUtc(addDays(today, -30), "00:00", tz), now)
      : fetchBookings(now, zonedToUtc(addDays(today, 61), "00:00", tz))
    ).catch((e) => (console.error(e), null)),
  ]);
  const lineTargets = lineEnabled() ? await listTargets().then((t) => t.length).catch(() => null) : 0;
  const list = past ? (bookings ?? []).slice().reverse() : bookings ?? [];

  const inDays = (n: number) => zonedToUtc(addDays(today, n), "00:00", tz).getTime();
  const count = (to: number) => (past ? 0 : list.filter((b) => b.start.getTime() < to).length);

  const groups = new Map<string, Booking[]>();
  for (const b of list) {
    const d = localDateStr(b.start, tz);
    groups.set(d, [...(groups.get(d) ?? []), b]);
  }
  const t = (d: Date) => formatJa(d, tz, { hour: "2-digit", minute: "2-digit" });
  const dayLabel = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    const w = WEEK[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
    return `${m}月${dd}日(${w})${d === today ? "・今日" : ""}`;
  };

  return (
    <main className="wrap wide admin">
      <header className="admin-head">
        <div>
          <p className="muted small">{config.teamName}</p>
          <h1>管理画面</h1>
        </div>
        <nav className="admin-nav">
          <Link href="/" target="_blank">予約ページを見る ↗</Link>
          <Link href="/admin/settings">⚙ 設定を変更</Link>
          <Link href="/qr">QRコード</Link>
          <form method="post" action="/api/admin/logout"><button className="link">ログアウト</button></form>
        </nav>
      </header>

      <div className={`status ${status.ok ? (status.mode === "mock" ? "warn" : "good") : "bad"}`}>
        {status.ok ? (status.mode === "mock" ? "⚠ " : "● ") : "✕ "}
        {status.detail}
        {(status.mode === "mock" || !status.ok) && (
          <a className="btn sm" style={{ marginLeft: 12 }} href="/api/auth/google">Googleカレンダーと連携する</a>
        )}
        {status.mode === "google" && status.ok && (
          <a className="small" style={{ marginLeft: 12 }} href="/api/auth/google">別のアカウントで連携し直す</a>
        )}
      </div>

      <div className="status line">
        {lineEnabled() ? (
          <>
            LINE通知：{lineTargets === null ? "確認できません" : lineTargets ? `${lineTargets}か所に送ります` : "送り先なし（LINEグループに公式アカウントを招待してください）"}
            <span style={{ marginLeft: 12 }}><LineTestButton /></span>
          </>
        ) : (
          <>LINE通知：未設定</>
        )}
      </div>

      {!past && (
        <div className="stats">
          <div className="card stat"><span className="muted small">今日</span><strong>{count(inDays(1))}件</strong></div>
          <div className="card stat"><span className="muted small">7日以内</span><strong>{count(inDays(7))}件</strong></div>
          <div className="card stat"><span className="muted small">60日以内</span><strong>{list.length}件</strong></div>
        </div>
      )}

      <section className="card pad">
        <div className="section-head">
          <h2>{past ? "過去30日の予約" : "これからの予約"}</h2>
          <div className="tabs">
            <Link className={!past ? "on" : ""} href="/admin">今後</Link>
            <Link className={past ? "on" : ""} href="/admin?view=past">過去</Link>
          </div>
        </div>
        {bookings === null && <p className="err">予約一覧の取得に失敗しました。Google連携を確認してください。</p>}
        {bookings !== null && list.length === 0 && <p className="muted">予約はまだありません</p>}
        {[...groups].map(([d, items]) => (
          <div key={d} className="day-group">
            <h3>{dayLabel(d)}</h3>
            {items.map((b) => (
              <div key={b.id} className="booking-row">
                <div className="b-time">{t(b.start)}<span className="muted">〜{t(b.end)}</span></div>
                <div className="b-main">
                  <div><strong>{b.name || "（名前なし）"}</strong> 様{b.company && <span className="muted">｜{b.company}</span>}</div>
                  <div className="small muted">{b.menu}</div>
                  <div className="small"><a href={`mailto:${b.email}`}>{b.email}</a></div>
                  {b.message && <div className="small b-msg">{b.message}</div>}
                </div>
                <div className="b-actions">
                  {b.meetUrl && <a className="btn sm" href={b.meetUrl} target="_blank" rel="noreferrer">Meetを開く</a>}
                  {b.htmlLink && <a className="small" href={b.htmlLink} target="_blank" rel="noreferrer">カレンダーで見る</a>}
                  {!past && <AdminCancelButton eventId={b.id} label={`${dayLabel(d)} ${t(b.start)} ${b.name}様`} />}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="card pad">
        <h2>現在の設定</h2>
        <h3>担当者</h3>
        <p>{config.hostName || <span className="muted">未設定</span>}{config.hostEmail && <span className="muted">（{config.hostEmail}）</span>}</p>
        <h3>受付時間</h3>
        {config.availabilityMode === "keyword" && (
          <p className="small"><b>Googleカレンダーに「{config.availabilityKeyword}」と入っている予定の時間だけ</b>受け付けます（同じカレンダーの他の予定とは重ならないようにします）。下は終日の「{config.availabilityKeyword}」の日に使う時間です。</p>
        )}
        <ul className="hours">
          {[1, 2, 3, 4, 5, 6, 0].map((w) => {
            const hs = config.weeklyHours[w as 0];
            return (
              <li key={w}><span>{WEEK[w]}</span>{hs.length ? hs.map((h) => `${h.start}〜${h.end}`).join("、") : <span className="muted">休み</span>}</li>
            );
          })}
        </ul>
        {config.blockedDates.length > 0 && <p className="small">休業日: {config.blockedDates.join("、")}</p>}
        <h3>予約メニュー</h3>
        <div className="menus">
          {config.eventTypes.map((e) => (
            <div key={e.slug} className="menu-cfg" style={{ borderLeftColor: e.color }}>
              <strong>{e.name}{!e.active && <span className="muted small">（非公開）</span>}</strong>
              <div className="small muted">
                {e.durationMinutes}分・{e.intervalMinutes}分刻み・前後の間隔 {e.bufferBeforeMinutes}/{e.bufferAfterMinutes}分・
                {e.minNoticeMinutes >= 60 ? `${Math.round(e.minNoticeMinutes / 60)}時間前` : `${e.minNoticeMinutes}分前`}まで・{e.bookingWindowDays}日先まで・{LOCATION[e.location.type]}
              </div>
              <Link className="small" href={`/${e.slug}`} target="_blank">/{e.slug} ↗</Link>
            </div>
          ))}
        </div>
        <p><Link className="btn sm" href="/admin/settings">設定を変更する</Link></p>
      </section>
    </main>
  );
}
