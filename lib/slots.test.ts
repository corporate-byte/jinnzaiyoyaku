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
