// Google Calendar 連携（REST API を fetch で直接呼び出し）
import type { Interval } from "./slots.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
export const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

import { sb, supabaseEnabled } from "./supabase.ts";

// 連携の鍵（リフレッシュトークン）は、環境変数 GOOGLE_REFRESH_TOKEN か Supabase の booking_google に保存したもの
let tokenCache: { v: string | null; at: number } | null = null;
async function refreshToken(): Promise<string | null> {
  if (process.env.GOOGLE_REFRESH_TOKEN) return process.env.GOOGLE_REFRESH_TOKEN;
  if (!supabaseEnabled()) return null;
  if (tokenCache && Date.now() - tokenCache.at < 30000) return tokenCache.v;
  try {
    const rows = (await (await sb("/booking_google?select=refresh_token&id=eq.1")).json()) as { refresh_token: string }[];
    tokenCache = { v: rows[0]?.refresh_token ?? null, at: Date.now() };
  } catch (e) {
    console.error(e);
    tokenCache = { v: null, at: Date.now() };
  }
  return tokenCache.v;
}

/** 連携ボタンで取得したリフレッシュトークンを保存（Supabase） */
export async function saveRefreshToken(token: string): Promise<boolean> {
  if (!supabaseEnabled()) return false;
  await sb("/booking_google?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({ id: 1, refresh_token: token, updated_at: new Date().toISOString() }),
  });
  tokenCache = null;
  cached = null;
  return true;
}

/** Google と連携していない（デモ動作）か */
export async function isMock(): Promise<boolean> {
  if (process.env.MOCK_GOOGLE === "1" || !process.env.GOOGLE_CLIENT_ID) return true;
  return !(await refreshToken());
}

let cached: { token: string; exp: number; rt: string } | null = null;

async function accessToken(): Promise<string> {
  const rt = await refreshToken();
  if (!rt) throw new Error("Googleカレンダーと連携されていません");
  if (cached && cached.rt === rt && cached.exp > Date.now() + 60000) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (/invalid_grant/.test(t)) throw new Error("Google連携の期限が切れました。管理画面の「Googleカレンダーと連携する」を押し直してください");
    throw new Error(`Google token refresh failed: ${res.status} ${t}`);
  }
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000, rt };
  return cached.token;
}

async function gfetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  return res;
}

// ---------- モック（Google未設定時のデモ用） ----------
type MockEvent = { id: string; start: Date; end: Date; summary: string; attendee: string; meta: Record<string, string>; meetUrl?: string };
const g = globalThis as unknown as { __mockEvents?: MockEvent[] };
const mockEvents = (g.__mockEvents ??= []);

// ---------- 公開関数 ----------

/** optional に入れたカレンダーは、見られなくてもエラーにしない（担当者のカレンダーなど） */
export async function getBusy(calendars: string[], timeMin: Date, timeMax: Date, optional: string[] = []): Promise<Interval[]> {
  if (await isMock()) {
    return mockEvents.filter((e) => e.end > timeMin && e.start < timeMax).map((e) => ({ start: e.start, end: e.end }));
  }
  const res = await gfetch("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [...new Set([...calendars, ...optional])].map((id) => ({ id })) }),
  });
  if (!res.ok) throw new Error(`freeBusy failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const out: Interval[] = [];
  for (const [id, cal] of Object.entries(j.calendars ?? {}) as [string, { busy?: { start: string; end: string }[]; errors?: unknown[] }][]) {
    if (cal.errors?.length) {
      if (optional.includes(id) && !calendars.includes(id)) continue; // 共有されていない担当者カレンダーは無視
      throw new Error(`freeBusy calendar error: ${JSON.stringify(cal.errors)}`);
    }
    for (const b of cal.busy ?? []) out.push({ start: new Date(b.start), end: new Date(b.end) });
  }
  return out;
}

export type CreatedEvent = { id: string; htmlLink?: string; meetUrl?: string };

export async function createEvent(input: {
  id: string; // 事前に決めたイベントID（base32hex: a-v, 0-9）
  calendarId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendee: { email: string; name: string };
  extraAttendees?: { email: string; name: string }[]; // 担当者など
  googleMeet: boolean;
  location?: string;
  meta: Record<string, string>; // 管理画面用の予約情報（イベントの非公開プロパティに保存）
}): Promise<CreatedEvent> {
  if (await isMock()) {
    const id = input.id;
    const meetUrl = input.googleMeet ? "https://meet.google.com/xxx-mock-xxx" : undefined;
    mockEvents.push({ id, start: input.start, end: input.end, summary: input.summary, attendee: input.attendee.email, meta: input.meta, meetUrl });
    console.log("[mock] event created", input);
    return { id, meetUrl };
  }
  const body: Record<string, unknown> = {
    id: input.id,
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
    end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
    attendees: [input.attendee, ...(input.extraAttendees ?? [])].map((a) => ({ email: a.email, displayName: a.name })),
    reminders: { useDefault: true },
    extendedProperties: { private: { bookingApp: "1", ...input.meta } },
  };
  if (input.location) body.location = input.location;
  if (input.googleMeet) {
    body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
  }
  // sendUpdates=all → ゲストにGoogleから招待メールが届く
  const res = await gfetch(
    `/calendars/${encodeURIComponent(input.calendarId)}/events?sendUpdates=all&conferenceDataVersion=1`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`events.insert failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const meetUrl = j.hangoutLink ?? j.conferenceData?.entryPoints?.find((p: { entryPointType: string }) => p.entryPointType === "video")?.uri;
  return { id: j.id, htmlLink: j.htmlLink, meetUrl };
}

export type Booking = {
  id: string;
  start: Date;
  end: Date;
  slug: string;
  menu: string;
  name: string;
  email: string;
  company: string;
  message: string;
  meetUrl?: string;
  htmlLink?: string;
};

/** このアプリ経由で入った予約の一覧（Googleカレンダーから取得） */
export async function listBookings(calendarId: string, timeMin: Date, timeMax: Date): Promise<Booking[]> {
  const fromMeta = (id: string, start: Date, end: Date, m: Record<string, string>, meetUrl?: string, htmlLink?: string): Booking => ({
    id, start, end, meetUrl, htmlLink,
    slug: m.slug ?? "", menu: m.menu ?? "", name: m.name ?? "", email: m.email ?? "", company: m.company ?? "", message: m.message ?? "",
  });
  if (await isMock()) {
    return mockEvents
      .filter((e) => e.end > timeMin && e.start < timeMax)
      .sort((a, b) => +a.start - +b.start)
      .map((e) => fromMeta(e.id, e.start, e.end, e.meta, e.meetUrl));
  }
  const out: Booking[] = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      privateExtendedProperty: "bookingApp=1",
      maxResults: "250",
    });
    if (pageToken) q.set("pageToken", pageToken);
    const res = await gfetch(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    if (!res.ok) throw new Error(`events.list failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    for (const e of j.items ?? []) {
      if (e.status === "cancelled") continue;
      out.push(fromMeta(e.id, new Date(e.start.dateTime ?? e.start.date), new Date(e.end.dateTime ?? e.end.date), e.extendedProperties?.private ?? {}, e.hangoutLink, e.htmlLink));
    }
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

/** Google 連携が動いているかの確認 */
export async function connectionStatus(): Promise<{ mode: "mock" | "google"; ok: boolean; detail: string }> {
  if (await isMock()) return { mode: "mock", ok: true, detail: "デモモード（Google未連携・予約はメモリ上に保存）" };
  try {
    const now = new Date();
    await getBusy(["primary"], now, new Date(now.getTime() + 60000));
    return { mode: "google", ok: true, detail: "Googleカレンダーと連携中" };
  } catch (e) {
    return { mode: "google", ok: false, detail: String((e as Error).message).slice(0, 200) };
  }
}

export async function getEvent(calendarId: string, eventId: string): Promise<{ summary: string; start: Date; end: Date; status: string } | null> {
  if (await isMock()) {
    const e = mockEvents.find((x) => x.id === eventId);
    return e ? { summary: e.summary, start: e.start, end: e.end, status: "confirmed" } : null;
  }
  const res = await gfetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`events.get failed: ${res.status}`);
  const j = await res.json();
  return { summary: j.summary, start: new Date(j.start.dateTime ?? j.start.date), end: new Date(j.end.dateTime ?? j.end.date), status: j.status };
}

export async function cancelEvent(calendarId: string, eventId: string): Promise<void> {
  if (await isMock()) {
    const i = mockEvents.findIndex((x) => x.id === eventId);
    if (i >= 0) mockEvents.splice(i, 1);
    return;
  }
  const res = await gfetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE" });
  if (!res.ok && res.status !== 410 && res.status !== 404) throw new Error(`events.delete failed: ${res.status}`);
}

// ---------- OAuth（初回連携用） ----------
export function authUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ refresh_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`code exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Google Calendar のイベントIDとして使える文字列 (base32hex) */
export function newEventId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuv";
  const bytes = crypto.getRandomValues(new Uint8Array(26));
  return "bk" + Array.from(bytes, (b) => chars[b & 31]).join("");
}
