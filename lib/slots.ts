import type { EventType, Weekday } from "../config/booking.config.ts";
import { addDays, localDateStr, weekdayOf, zonedToUtc } from "./time.ts";

export type Interval = { start: Date; end: Date };

export type SlotRules = {
  timeZone: string;
  weeklyHours: Record<Weekday, { start: string; end: string }[]>;
  blockedDates: string[];
};

/**
 * 指定期間 [fromDate, toDate]（ローカル日付, 両端含む）の予約可能な開始時刻を日付ごとに返す。
 * busy は Google カレンダーの予定（UTC）。
 */
export function computeSlots(
  ev: EventType,
  rules: SlotRules,
  busy: Interval[],
  fromDate: string,
  toDate: string,
  now: Date = new Date(),
): Record<string, string[]> {
  const tz = rules.timeZone;
  const earliest = now.getTime() + ev.minNoticeMinutes * 60000;
  const lastDate = addDays(localDateStr(now, tz), ev.bookingWindowDays);
  const durMs = ev.durationMinutes * 60000;
  const stepMs = ev.intervalMinutes * 60000;
  const before = ev.bufferBeforeMinutes * 60000;
  const after = ev.bufferAfterMinutes * 60000;

  const result: Record<string, string[]> = {};
  for (let day = fromDate; day <= toDate; day = addDays(day, 1)) {
    const list: string[] = [];
    if (day <= lastDate && !rules.blockedDates.includes(day)) {
      const windows = rules.weeklyHours[weekdayOf(day) as Weekday] ?? [];
      for (const w of windows) {
        const wStart = zonedToUtc(day, w.start, tz).getTime();
        const wEnd = zonedToUtc(day, w.end, tz).getTime();
        for (let s = wStart; s + durMs <= wEnd; s += stepMs) {
          if (s < earliest) continue;
          const e = s + durMs;
          // 前後のバッファを含めて既存予定と重ならないか
          const clash = busy.some((b) => s - before < b.end.getTime() && e + after > b.start.getTime());
          if (!clash) list.push(new Date(s).toISOString());
        }
      }
    }
    result[day] = list;
  }
  return result;
}

/** 単一の開始時刻がまだ空いているか（予約確定時の再チェック用） */
export function isSlotAvailable(ev: EventType, rules: SlotRules, busy: Interval[], startIso: string, now = new Date()): boolean {
  const day = localDateStr(new Date(startIso), rules.timeZone);
  return (computeSlots(ev, rules, busy, day, day, now)[day] ?? []).includes(new Date(startIso).toISOString());
}
