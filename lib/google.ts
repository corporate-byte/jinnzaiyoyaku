// Google Calendar 連携（REST API を fetch で直接呼び出し）
import type { Interval } from "./slots.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
export const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

export function isMock(): boolean {
  return process.env.MOCK_GOOGLE === "1" || !process.env.GOOGLE_REFRESH_TOKEN;
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
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
type MockEvent = { id: string; start: Date; end: Date; summary: string; attendee: string };
const g = globalThis as unknown as { __mockEvents?: MockEvent[] };
const mockEvents = (g.__mockEvents ??= []);

// ---------- 公開関数 ----------

export async function getBusy(calendars: string[], timeMin: Date, timeMax: Date): Promise<Interval[]> {
  if (isMock()) {
    return mockEvents.filter((e) => e.end > timeMin && e.start < timeMax).map((e) => ({ start: e.start, end: e.end }));
  }
  const res = await gfetch("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: calendars.map((id) => ({ id })) }),
  });
  if (!res.ok) throw new Error(`freeBusy failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const out: Interval[] = [];
  for (const cal of Object.values(j.calendars ?? {}) as { busy?: { start: string; end: string }[]; errors?: unknown[] }[]) {
    if (cal.errors?.length) throw new Error(`freeBusy calendar error: ${JSON.stringify(cal.errors)}`);
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
  googleMeet: boolean;
  location?: string;
}): Promise<CreatedEvent> {
  if (isMock()) {
    const id = input.id;
    mockEvents.push({ id, start: input.start, end: input.end, summary: input.summary, attendee: input.attendee.email });
    console.log("[mock] event created", input);
    return { id, meetUrl: input.googleMeet ? "https://meet.google.com/xxx-mock-xxx" : undefined };
  }
  const body: Record<string, unknown> = {
    id: input.id,
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
    end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
    attendees: [{ email: input.attendee.email, displayName: input.attendee.name }],
    reminders: { useDefault: true },
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

export async function getEvent(calendarId: string, eventId: string): Promise<{ summary: string; start: Date; end: Date; status: string } | null> {
  if (isMock()) {
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
  if (isMock()) {
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
