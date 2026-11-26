// 予約の設定（受付時間・メニューなど）。Supabase があればそこから、なければ config/booking.config.ts の値（メモリ上で編集可）。
import { config as defaults, type EventType, type Weekday } from "../config/booking.config.ts";
import type { SlotRules } from "./slots.ts";
import { rpc, supabaseEnabled } from "./supabase.ts";

export type Menu = EventType & { active: boolean };
export type Hours = Record<Weekday, { start: string; end: string }[]>;
export type Settings = {
  teamName: string;
  hostName: string;
  hostEmail: string;
  availabilityMode: "weekly" | "keyword"; // weekly=曜日ごとの受付時間 / keyword=カレンダーのキーワード予定の時間だけ
  availabilityKeyword: string;
  timeZone: string;
  weeklyHours: Hours;
  blockedDates: string[];
  eventTypes: Menu[];
};

const g = globalThis as unknown as { __settings?: Settings; __settingsCache?: { at: number; v: Settings } };

function fromDefaults(): Settings {
  return {
    teamName: defaults.teamName,
    hostName: defaults.hostName,
    hostEmail: defaults.hostEmail,
    availabilityMode: "weekly" as Settings["availabilityMode"],
    availabilityKeyword: "伏見",
    timeZone: defaults.timeZone,
    weeklyHours: structuredClone(defaults.weeklyHours),
    blockedDates: [...defaults.blockedDates],
    eventTypes: defaults.eventTypes.map((e) => ({ ...structuredClone(e), active: true })),
  };
}

export async function getSettings(): Promise<Settings> {
  if (!supabaseEnabled()) return (g.__settings ??= fromDefaults());
  const c = g.__settingsCache;
  if (c && Date.now() - c.at < 5000) return c.v; // 同じリクエスト内の多重読み込みを避ける短いキャッシュ
  const v = await rpc<Settings | null>("booking_get_settings");
  const s = v && v.eventTypes ? { ...v, hostName: v.hostName ?? "", hostEmail: v.hostEmail ?? "", availabilityMode: (v.availabilityMode === "keyword" ? "keyword" : "weekly") as Settings["availabilityMode"], availabilityKeyword: v.availabilityKeyword || "伏見" } : fromDefaults();
  g.__settingsCache = { at: Date.now(), v: s };
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  if (!supabaseEnabled()) {
    g.__settings = s;
    return;
  }
  await rpc("booking_save_settings", { payload: s });
  g.__settingsCache = undefined;
}

/** 予約ページに出すメニュー（非公開を除く） */
export async function findMenu(slug: string): Promise<Menu | undefined> {
  return (await getSettings()).eventTypes.find((e) => e.slug === slug && e.active);
}

export function rulesOf(s: Settings): SlotRules {
  return { timeZone: s.timeZone, weeklyHours: s.weeklyHours, blockedDates: s.blockedDates };
}

// ---------- 入力チェック ----------
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

function int(v: unknown, min: number, max: number, label: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}は${min}〜${max}の整数で入力してください`);
  return n;
}
function str(v: unknown, max: number, label: string, required = true): string {
  const s = String(v ?? "").trim();
  if (required && !s) throw new Error(`${label}を入力してください`);
  if (s.length > max) throw new Error(`${label}は${max}文字以内にしてください`);
  return s;
}

/** 画面から送られた設定を検証して正規化する。問題があれば日本語のエラーを投げる */
export function validateSettings(input: unknown): Settings {
  const x = input as Record<string, unknown>;
  if (!x || typeof x !== "object") throw new Error("設定の形式が正しくありません");
  const weeklyHours = {} as Hours;
  const wh = (x.weeklyHours ?? {}) as Record<string, unknown>;
  const DAY = "日月火水木金土";
  for (let d = 0; d < 7; d++) {
    const list = Array.isArray(wh[d]) ? (wh[d] as { start: string; end: string }[]) : [];
    if (list.length > 6) throw new Error(`${DAY[d]}曜日の受付時間が多すぎます`);
    const ranges = list.map((r) => {
      if (!HHMM.test(r?.start) || !HHMM.test(r?.end)) throw new Error(`${DAY[d]}曜日の時刻は「10:00」の形で入力してください`);
      if (r.start >= r.end) throw new Error(`${DAY[d]}曜日：終了は開始より後にしてください`);
      return { start: r.start, end: r.end };
    });
    ranges.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < ranges.length; i++) if (ranges[i].start < ranges[i - 1].end) throw new Error(`${DAY[d]}曜日の受付時間が重なっています`);
    weeklyHours[d as Weekday] = ranges;
  }
  const blockedDates = [...new Set((Array.isArray(x.blockedDates) ? x.blockedDates : []).map(String))].filter((d) => DATE.test(d)).sort();
  const evs = Array.isArray(x.eventTypes) ? x.eventTypes : [];
  if (evs.length === 0) throw new Error("メニューを1つ以上作ってください");
  if (evs.length > 30) throw new Error("メニューは30個までです");
  const seen = new Set<string>();
  const eventTypes: Menu[] = evs.map((raw: Record<string, unknown>, i: number) => {
    const n = `メニュー${i + 1}`;
    const slug = String(raw.slug ?? "").trim();
    if (!SLUG.test(slug)) throw new Error(`${n}のURL名は半角英小文字・数字・ハイフンで入力してください`);
    if (seen.has(slug)) throw new Error(`URL名「${slug}」が重複しています`);
    if (["admin", "api", "qr", "cancel"].includes(slug)) throw new Error(`URL名「${slug}」は使えません`);
    seen.add(slug);
    const loc = (raw.location ?? {}) as Record<string, string>;
    let location: EventType["location"];
    if (loc.type === "zoom") location = { type: "zoom", url: str(loc.url, 500, `${n}のZoom URL`) };
    else if (loc.type === "in_person") location = { type: "in_person", address: str(loc.address, 300, `${n}の住所`) };
    else if (loc.type === "phone") location = { type: "phone" };
    else location = { type: "google_meet" };
    const f = (raw.fields ?? {}) as Record<string, string>;
    const fld = (v: string) => (v === "required" || v === "hidden" ? v : "optional") as "required" | "optional" | "hidden";
    const color = String(raw.color ?? "#1F74F2");
    return {
      slug,
      name: str(raw.name, 100, `${n}の名前`),
      description: str(raw.description, 3000, `${n}の説明`, false),
      durationMinutes: int(raw.durationMinutes, 5, 480, `${n}の所要時間`),
      intervalMinutes: int(raw.intervalMinutes, 5, 240, `${n}の刻み`),
      bufferBeforeMinutes: int(raw.bufferBeforeMinutes, 0, 240, `${n}の前の間隔`),
      bufferAfterMinutes: int(raw.bufferAfterMinutes, 0, 240, `${n}の後の間隔`),
      minNoticeMinutes: int(raw.minNoticeMinutes, 0, 60 * 24 * 30, `${n}の締切`),
      bookingWindowDays: int(raw.bookingWindowDays, 1, 365, `${n}の予約可能期間`),
      location,
      color: COLOR.test(color) ? color : "#1F74F2",
      fields: { company: fld(f.company), message: fld(f.message) },
      active: raw.active !== false,
    };
  });
  const hostEmail = String(x.hostEmail ?? "").trim();
  if (hostEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail)) throw new Error("担当者のメールアドレスが正しくありません");
  return {
    teamName: str(x.teamName, 100, "チーム名"),
    hostName: str(x.hostName, 50, "担当者名", false),
    hostEmail: hostEmail.slice(0, 200),
    availabilityMode: (x.availabilityMode === "keyword" ? "keyword" : "weekly") as Settings["availabilityMode"],
    availabilityKeyword: x.availabilityMode === "keyword" ? str(x.availabilityKeyword, 30, "受付に使うキーワード") : String(x.availabilityKeyword ?? "伏見").trim().slice(0, 30) || "伏見",
    timeZone: "Asia/Tokyo",
    weeklyHours,
    blockedDates,
    eventTypes,
  };
}
