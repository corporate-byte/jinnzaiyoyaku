"use client";
import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string;
  color: string;
  timeZone: string;
  durationMinutes: number;
  windowDays: number;
  fields: { company: "required" | "optional" | "hidden"; message: "required" | "optional" | "hidden" };
};

type Done = { label: string; meetUrl: string | null; locationText: string | null; cancelUrl: string };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function ymd(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}
function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
function dateLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}月${d}日(${WEEK[w]})`;
}

export default function BookingWidget({ slug, color, timeZone, durationMinutes, windowDays, fields }: Props) {
  const today = useMemo(() => todayIn(timeZone), [timeZone]);
  const [ty, tm] = today.split("-").map(Number);
  const lastDay = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return ymd(y, m - 1, d + windowDays);
  }, [today, windowDays]);

  const [month, setMonth] = useState({ y: ty, m: tm - 1 }); // m: 0-11
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [reload, setReload] = useState(0);

  const firstOfMonth = ymd(month.y, month.m, 1);
  const lastOfMonth = ymd(month.y, month.m + 1, 0);
  const canPrev = firstOfMonth > today;
  const canNext = lastOfMonth < lastDay;

  useEffect(() => {
    const from = firstOfMonth < today ? today : firstOfMonth;
    const to = lastOfMonth > lastDay ? lastDay : lastOfMonth;
    if (from > to) return;
    let alive = true;
    setLoading(true);
    setLoadError("");
    fetch(`/api/slots?slug=${encodeURIComponent(slug)}&from=${from}&to=${to}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "error");
        return j;
      })
      .then((j) => {
        if (!alive) return;
        setSlots((s) => ({ ...s, ...j.slots }));
        // まだ日付未選択なら最初の空き日を自動選択
        setDay((cur) => cur ?? (Object.keys(j.slots).sort().find((k) => j.slots[k].length > 0) || null));
      })
      .catch((e) => alive && setLoadError(e.message || "空き時間の取得に失敗しました"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, firstOfMonth, lastOfMonth, today, lastDay, reload]);

  // カレンダーのマス目
  const cells: (string | null)[] = [];
  const startW = new Date(Date.UTC(month.y, month.m, 1)).getUTCDay();
  for (let i = 0; i < startW; i++) cells.push(null);
  const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(month.y, month.m, d));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!start) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, start, ...form }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "予約に失敗しました");
        if (r.status === 409) {
          setSlots({});
          setReload((n) => n + 1);
        }
        return;
      }
      setDone(j);
      setStep("done");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  const style = { "--accent": color } as React.CSSProperties;

  if (step === "done" && done) {
    return (
      <section className="panel" style={style}>
        <div className="done">
          <div className="check">✓</div>
          <h2>予約が確定しました</h2>
          <p className="big">{done.label}〜（{durationMinutes}分）</p>
          {done.meetUrl && (
            <p>
              Google Meet: <a href={done.meetUrl} target="_blank" rel="noreferrer">{done.meetUrl}</a>
            </p>
          )}
          {done.locationText && <p>場所: {done.locationText}</p>}
          <p className="muted">
            {form.email} 宛にGoogleカレンダーの招待メールをお送りしました。
          </p>
          <p className="small">
            <a href={done.cancelUrl}>予約をキャンセルする</a>
          </p>
        </div>
      </section>
    );
  }

  if (step === "form" && start) {
    const label = (k: "company" | "message", t: string) => `${t}${fields[k] === "required" ? "（必須）" : "（任意）"}`;
    return (
      <section className="panel" style={style}>
        <button className="link" onClick={() => setStep("pick")}>← 日時を選び直す</button>
        <div className="chosen">
          📅 {dateLabel(day!)} {timeLabel(start, timeZone)}〜（{durationMinutes}分）
        </div>
        <form onSubmit={submit} className="form">
          <label>
            お名前（必須）
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          </label>
          <label>
            メールアドレス（必須）
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
          </label>
          {fields.company !== "hidden" && (
            <label>
              {label("company", "会社名")}
              <input required={fields.company === "required"} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" />
            </label>
          )}
          {fields.message !== "hidden" && (
            <label>
              {label("message", "メッセージ")}
              <textarea rows={4} required={fields.message === "required"} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
          )}
          {error && <p className="err">{error}</p>}
          <button className="btn" disabled={submitting}>{submitting ? "予約中…" : "予約を確定する"}</button>
        </form>
      </section>
    );
  }

  const daySlots = day ? slots[day] ?? [] : [];
  return (
    <section className="panel pick" style={style}>
      <div className="cal">
        <div className="cal-head">
          <button aria-label="前の月" disabled={!canPrev} onClick={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}>‹</button>
          <strong>{month.y}年{month.m + 1}月</strong>
          <button aria-label="次の月" disabled={!canNext} onClick={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}>›</button>
        </div>
        <div className="grid">
          {WEEK.map((w, i) => (
            <div key={w} className={`wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</div>
          ))}
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const has = (slots[c]?.length ?? 0) > 0;
            return (
              <button
                key={c}
                className={`day ${has ? "has" : ""} ${c === day ? "sel" : ""} ${c === today ? "today" : ""}`}
                disabled={!has}
                onClick={() => setDay(c)}
              >
                {Number(c.slice(8))}
              </button>
            );
          })}
        </div>
        {loading && <p className="muted small">読み込み中…</p>}
        {loadError && <p className="err">{loadError}</p>}
      </div>
      <div className="times">
        <h3>{day ? dateLabel(day) : "日付を選択してください"}</h3>
        {day && daySlots.length === 0 && !loading && <p className="muted">この日は空きがありません</p>}
        <div className="time-list">
          {daySlots.map((s) => (
            <button
              key={s}
              className="time"
              onClick={() => {
                setStart(s);
                setStep("form");
                setError("");
              }}
            >
              {timeLabel(s, timeZone)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
