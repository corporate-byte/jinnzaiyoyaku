"use client";
import { useState } from "react";
import type { Settings, Menu } from "@/lib/settings";

const DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const COLORS = ["#1F74F2", "#0E9F6E", "#E8590C", "#D6336C", "#7048E8", "#495057"];

const newMenu = (n: number): Menu => ({
  slug: `menu-${n}`,
  name: "新しいメニュー（30分）",
  description: "",
  durationMinutes: 30,
  intervalMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minNoticeMinutes: 120,
  bookingWindowDays: 30,
  location: { type: "google_meet" },
  color: COLORS[n % COLORS.length],
  fields: { company: "optional", message: "optional" },
  active: true,
});

export default function SettingsEditor({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newDate, setNewDate] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const up = (f: (d: Settings) => void) =>
    setS((cur) => {
      const d = structuredClone(cur);
      f(d);
      return d;
    });
  const upMenu = (i: number, f: (m: Menu) => void) => up((d) => f(d.eventTypes[i]));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      const j = await r.json();
      if (!r.ok) setMsg({ ok: false, text: j.error || "保存に失敗しました" });
      else {
        setS(j.settings);
        setMsg({ ok: true, text: "保存しました。予約ページにすぐ反映されます。" });
      }
    } catch {
      setMsg({ ok: false, text: "通信エラーが発生しました" });
    } finally {
      setSaving(false);
    }
  }

  // 「締切」は 時間 or 分 で入力
  const noticeHours = (m: Menu) => m.minNoticeMinutes / 60;

  return (
    <div className="settings">
      <section className="card pad">
        <h2>基本</h2>
        <label className="field">
          チーム名（予約ページの上に表示）
          <input value={s.teamName} onChange={(e) => up((d) => void (d.teamName = e.target.value))} />
        </label>
        <div className="menu-form" style={{ padding: "12px 0 0" }}>
          <label className="field">
            担当者名（予約ページに表示）
            <input value={s.hostName} placeholder="例：松本" onChange={(e) => up((d) => void (d.hostName = e.target.value))} />
          </label>
          <label className="field">
            担当者のメールアドレス
            <input type="email" value={s.hostEmail} placeholder="例：matsumoto@example.com" onChange={(e) => up((d) => void (d.hostEmail = e.target.value))} />
          </label>
        </div>
        <p className="muted small">メールアドレスを入れると、予約が入るたびに担当者にもGoogleカレンダーの招待が届き、担当者のカレンダーに予定が入ります。担当者のカレンダーが連携アカウントに共有されていれば、その予定がある時間も予約できなくなります。</p>
      </section>

      <section className="card pad">
        <h2>受付時間</h2>
        <p className="muted small">曜日ごとに受け付ける時間帯。「＋時間帯」で昼休みを分けるなど複数設定できます。</p>
        <div className="hours-edit">
          {DAYS.map((w) => {
            const list = s.weeklyHours[w];
            return (
              <div key={w} className="hour-row">
                <span className={`wd-l ${w === 0 ? "sun" : w === 6 ? "sat" : ""}`}>{WEEK[w]}</span>
                <div className="ranges">
                  {list.length === 0 && <span className="muted">休み</span>}
                  {list.map((r, i) => (
                    <span key={i} className="range">
                      <input type="time" step={900} value={r.start} onChange={(e) => up((d) => void (d.weeklyHours[w][i].start = e.target.value))} />
                      〜
                      <input type="time" step={900} value={r.end} onChange={(e) => up((d) => void (d.weeklyHours[w][i].end = e.target.value))} />
                      <button className="x" aria-label="削除" onClick={() => up((d) => void d.weeklyHours[w].splice(i, 1))}>×</button>
                    </span>
                  ))}
                  <button
                    className="link small"
                    onClick={() =>
                      up((d) => {
                        const last = d.weeklyHours[w].at(-1);
                        d.weeklyHours[w].push(last ? { start: last.end < "18:00" ? last.end : "18:00", end: "19:00" } : { start: "10:00", end: "19:00" });
                      })
                    }
                  >
                    ＋時間帯
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card pad">
        <h2>休業日</h2>
        <p className="muted small">この日は予約を受け付けません（祝日・お休みなど）。</p>
        <div className="chips">
          {s.blockedDates.length === 0 && <span className="muted">なし</span>}
          {s.blockedDates.map((d) => (
            <span key={d} className="chip">
              {d}
              <button className="x" aria-label="削除" onClick={() => up((x) => void (x.blockedDates = x.blockedDates.filter((y) => y !== d)))}>×</button>
            </span>
          ))}
        </div>
        <div className="row-inline">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button
            className="btn sm"
            disabled={!newDate}
            onClick={() => {
              up((x) => void (x.blockedDates = [...new Set([...x.blockedDates, newDate])].sort()));
              setNewDate("");
            }}
          >
            追加
          </button>
        </div>
      </section>

      <section className="card pad">
        <div className="section-head">
          <h2>予約メニュー</h2>
          <button
            className="btn sm"
            onClick={() => {
              up((d) => void d.eventTypes.push(newMenu(d.eventTypes.length + 1)));
              setOpen(s.eventTypes.length);
            }}
          >
            ＋ メニューを追加
          </button>
        </div>
        {s.eventTypes.map((m, i) => (
          <div key={i} className="menu-edit" style={{ borderLeftColor: m.color }}>
            <button className="menu-edit-head" onClick={() => setOpen(open === i ? null : i)}>
              <strong>{m.name || "（名前なし）"}</strong>
              <span className="muted small">
                {m.durationMinutes}分・/{m.slug}
                {!m.active && "・非公開"}
              </span>
              <span className="muted">{open === i ? "▲" : "▼"}</span>
            </button>
            {open === i && (
              <div className="menu-form">
                <label className="field full">
                  メニュー名
                  <input value={m.name} onChange={(e) => upMenu(i, (x) => void (x.name = e.target.value))} />
                </label>
                <label className="field full">
                  説明（予約ページの左側に表示）
                  <textarea rows={5} value={m.description} onChange={(e) => upMenu(i, (x) => void (x.description = e.target.value))} />
                </label>
                <label className="field">
                  所要時間（分）
                  <input type="number" min={5} step={5} value={m.durationMinutes} onChange={(e) => upMenu(i, (x) => void (x.durationMinutes = +e.target.value))} />
                </label>
                <label className="field">
                  開始時刻の刻み（分）
                  <select value={m.intervalMinutes} onChange={(e) => upMenu(i, (x) => void (x.intervalMinutes = +e.target.value))}>
                    {[10, 15, 20, 30, 60].map((v) => <option key={v} value={v}>{v}分ごと</option>)}
                  </select>
                </label>
                <label className="field">
                  前の予定との間隔（分）
                  <input type="number" min={0} step={5} value={m.bufferBeforeMinutes} onChange={(e) => upMenu(i, (x) => void (x.bufferBeforeMinutes = +e.target.value))} />
                </label>
                <label className="field">
                  後の予定との間隔（分）
                  <input type="number" min={0} step={5} value={m.bufferAfterMinutes} onChange={(e) => upMenu(i, (x) => void (x.bufferAfterMinutes = +e.target.value))} />
                </label>
                <label className="field">
                  何時間前まで予約できるか
                  <input type="number" min={0} step={0.5} value={noticeHours(m)} onChange={(e) => upMenu(i, (x) => void (x.minNoticeMinutes = Math.round(+e.target.value * 60)))} />
                </label>
                <label className="field">
                  何日先まで予約できるか
                  <input type="number" min={1} value={m.bookingWindowDays} onChange={(e) => upMenu(i, (x) => void (x.bookingWindowDays = +e.target.value))} />
                </label>
                <label className="field">
                  場所
                  <select
                    value={m.location.type}
                    onChange={(e) =>
                      upMenu(i, (x) => {
                        const t = e.target.value;
                        x.location = t === "zoom" ? { type: "zoom", url: "" } : t === "in_person" ? { type: "in_person", address: "" } : t === "phone" ? { type: "phone" } : { type: "google_meet" };
                      })
                    }
                  >
                    <option value="google_meet">Google Meet（自動発行）</option>
                    <option value="zoom">Zoom（固定URL）</option>
                    <option value="in_person">対面</option>
                    <option value="phone">電話</option>
                  </select>
                </label>
                {m.location.type === "zoom" && (
                  <label className="field">
                    Zoom URL
                    <input value={m.location.url} onChange={(e) => upMenu(i, (x) => void (x.location = { type: "zoom", url: e.target.value }))} />
                  </label>
                )}
                {m.location.type === "in_person" && (
                  <label className="field">
                    住所
                    <input value={m.location.address} onChange={(e) => upMenu(i, (x) => void (x.location = { type: "in_person", address: e.target.value }))} />
                  </label>
                )}
                <label className="field">
                  会社名の入力
                  <select value={m.fields.company} onChange={(e) => upMenu(i, (x) => void (x.fields.company = e.target.value as Menu["fields"]["company"]))}>
                    <option value="optional">任意</option><option value="required">必須</option><option value="hidden">表示しない</option>
                  </select>
                </label>
                <label className="field">
                  メッセージの入力
                  <select value={m.fields.message} onChange={(e) => upMenu(i, (x) => void (x.fields.message = e.target.value as Menu["fields"]["message"]))}>
                    <option value="optional">任意</option><option value="required">必須</option><option value="hidden">表示しない</option>
                  </select>
                </label>
                <label className="field">
                  URL名（半角英数字）
                  <input value={m.slug} onChange={(e) => upMenu(i, (x) => void (x.slug = e.target.value.toLowerCase()))} />
                </label>
                <div className="field">
                  色
                  <div className="colors">
                    {COLORS.map((c) => (
                      <button key={c} className={`color ${m.color === c ? "on" : ""}`} style={{ background: c }} aria-label={c} onClick={() => upMenu(i, (x) => void (x.color = c))} />
                    ))}
                  </div>
                </div>
                <label className="field field-check">
                  <input type="checkbox" checked={m.active} onChange={(e) => upMenu(i, (x) => void (x.active = e.target.checked))} />
                  予約ページに表示する
                </label>
                <div className="field full menu-actions">
                  <button
                    className="link danger-text small"
                    onClick={() => {
                      if (confirm(`「${m.name}」を削除しますか？（保存するまで確定しません）`)) {
                        up((d) => void d.eventTypes.splice(i, 1));
                        setOpen(null);
                      }
                    }}
                  >
                    このメニューを削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="save-bar">
        {msg && <span className={msg.ok ? "ok" : "err"}>{msg.text}</span>}
        <button className="btn" disabled={saving} onClick={save}>{saving ? "保存中…" : "保存する"}</button>
      </div>
    </div>
  );
}
