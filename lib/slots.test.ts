import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, isSlotAvailable } from "./slots.ts";
import type { EventType } from "../config/booking.config.ts";

const ev: EventType = {
  slug: "t", name: "t", description: "", durationMinutes: 60, intervalMinutes: 15,
  bufferBeforeMinutes: 15, bufferAfterMinutes: 0, minNoticeMinutes: 0, bookingWindowDays: 30,
  location: { type: "google_meet" }, color: "#000", fields: { company: "optional", message: "optional" },
};
const rules = {
  timeZone: "Asia/Tokyo",
  weeklyHours: { 0: [], 1: [{ start: "10:00", end: "12:00" }], 2: [], 3: [], 4: [], 5: [], 6: [] } as any,
  blockedDates: [] as string[],
};
const now = new Date("2026-11-29T00:00:00+09:00"); // 日曜
const jst = (s: string) => new Date(s + "+09:00");

test("営業時間内に15分刻みで60分枠", () => {
  const r = computeSlots(ev, rules, [], "2026-11-30", "2026-11-30", now);
  assert.deepEqual(r["2026-11-30"].map((s) => new Date(s).toISOString()), [
    jst("2026-11-30T10:00").toISOString(), jst("2026-11-30T10:15").toISOString(), jst("2026-11-30T10:30").toISOString(),
    jst("2026-11-30T10:45").toISOString(), jst("2026-11-30T11:00").toISOString(),
  ]);
});

test("休みの曜日は空", () => {
  assert.deepEqual(computeSlots(ev, rules, [], "2026-12-01", "2026-12-01", now)["2026-12-01"], []);
});

test("既存予定と前バッファ15分を避ける", () => {
  const busy = [{ start: jst("2026-11-30T10:00"), end: jst("2026-11-30T10:30") }];
  const r = computeSlots(ev, rules, busy, "2026-11-30", "2026-11-30", now)["2026-11-30"];
  // 10:30 開始は前15分(10:15〜)が予定と重なるので不可、10:45 から
  assert.equal(r[0], jst("2026-11-30T10:45").toISOString());
  assert.equal(r.length, 2);
});

test("最短予約時間と予約可能期間", () => {
  const n = jst("2026-11-30T09:50");
  const r = computeSlots({ ...ev, minNoticeMinutes: 30 }, rules, [], "2026-11-30", "2026-11-30", n)["2026-11-30"];
  assert.equal(r[0], jst("2026-11-30T10:30").toISOString());
  const far = computeSlots({ ...ev, bookingWindowDays: 3 }, rules, [], "2026-12-07", "2026-12-07", now)["2026-12-07"];
  assert.deepEqual(far, []);
});

test("isSlotAvailable", () => {
  assert.equal(isSlotAvailable(ev, rules, [], jst("2026-11-30T10:15").toISOString(), now), true);
  assert.equal(isSlotAvailable(ev, rules, [], jst("2026-11-30T10:10").toISOString(), now), false);
});

// ---- キーワード（伏見）モード ----
import { splitByKeyword } from "./availability.ts";

const evs = (list: [string, string, string, boolean?][]) =>
  list.map(([summary, s, e, allDay]) =>
    allDay
      ? { summary, start: new Date(s + "T00:00:00+09:00"), end: new Date(e + "T00:00:00+09:00"), allDay: true, startDate: s, endDate: e, busy: true, mine: false }
      : { summary, start: jst(s), end: jst(e), allDay: false, busy: true, mine: false },
  );
const s2 = { timeZone: "Asia/Tokyo", weeklyHours: rules.weeklyHours };

test("伏見の予定の時間だけ予約でき、ほかの予定とは重ならない", () => {
  const av = splitByKeyword(evs([["伏見", "2026-12-02T13:00", "2026-12-02T17:00"], ["歯医者", "2026-12-02T14:00", "2026-12-02T15:00"]]), "伏見", s2);
  const ev2 = { ...ev, bufferBeforeMinutes: 0 };
  const r = computeSlots(ev2, rules, av.busy, "2026-12-01", "2026-12-02", now, av.windows);
  assert.deepEqual(r["2026-12-01"], []); // 伏見がない日は0
  assert.deepEqual(r["2026-12-02"].map((x) => new Date(x).toISOString()), [
    jst("2026-12-02T13:00").toISOString(), // 13:00-14:00
    jst("2026-12-02T15:00").toISOString(), jst("2026-12-02T15:15").toISOString(), jst("2026-12-02T15:30").toISOString(), jst("2026-12-02T15:45").toISOString(), jst("2026-12-02T16:00").toISOString(),
  ]);
});

test("終日の伏見はその曜日の受付時間、題名は部分一致、予約アプリの予定は対象外", () => {
  const list = evs([["【伏見】出勤", "2026-11-30", "2026-12-01", true]]);
  list.push({ summary: "転職相談 - 伏見太郎様", start: jst("2026-12-03T10:00"), end: jst("2026-12-03T11:00"), allDay: false, busy: true, mine: true });
  const av = splitByKeyword(list, "伏見", s2);
  const r = computeSlots(ev, rules, av.busy, "2026-11-30", "2026-12-03", now, av.windows);
  assert.equal(r["2026-11-30"].length, 5); // 月曜 10:00-12:00 の設定で 60分×15分刻み
  assert.deepEqual(r["2026-12-03"], []);
});
