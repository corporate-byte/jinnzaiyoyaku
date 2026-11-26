import type { EventType, Weekday } from "../config/booking.config.ts";
import { addDays, localDateStr, weekdayOf, zonedToUtc } from "./time.ts";

export type Interval = { start: Date; end: Date };

export type SlotRules = {
  timeZone: string;
  weeklyHours: Record<Weekday, { start: string; end: string }[]>;
  blockedDates: string[];
};

/** 日付（ローカル "YYYY-MM-DD"）ごとの受付できる時間帯。指定すると曜日ごとの受付時間の代わりに使う */
export type WindowsByDay = Record<string, Interval[]>;

/**
 * 指定期間 [fromDate, toDate]（ローカル日付, 両端含む）の予約可能な開始時刻を日付ごとに返す。
 * busy は Google カレンダーの予定（UTC）。windows を渡すと、その時間帯の中だけで枠を作る。
 */
export function computeSlots(
  ev: EventType,
  rules: SlotRules,
  busy: Interval[],
  fromDate: string,
  toDate: string,
  now: Date = new Date(),
  windows?: WindowsByDay,
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
    const set = new Set<string>();
    if (day <= lastDate && !rules.blockedDates.includes(day)) {
      const dayStart = zonedToUtc(day, "00:00", tz).getTime();
      const ranges = windows
        ? (windows[day] ?? []).map((w) => [w.start.getTime(), w.end.getTime()] as const)
        : (rules.weeklyHours[weekdayOf(day) as Weekday] ?? []).map(
            (w) => [zonedToUtc(day, w.start, tz).getTime(), zonedToUtc(day, w.end, tz).getTime()] as const,
          );
      for (const [wStart, wEnd] of ranges) {
        // 開始時刻はその日の0時から「刻み」ごとにそろえる（10:10開始の予定でも 10:15, 10:30… になる）
        const first = dayStart + Math.ceil((wStart - dayStart) / stepMs) * stepMs;
        for (let s = first; s + durMs <= wEnd; s += stepMs) {
          if (s < earliest) continue;
          if (localDateStr(new Date(s), tz) !== day) continue;
          const e = s + durMs;
          // 前後のバッファを含めて既存予定と重ならないか
          const clash = busy.some((b) => s - before < b.end.getTime() && e + after > b.start.getTime());
          if (!clash) set.add(new Date(s).toISOString());
        }
      }
    }
    result[day] = [...set].sort();
  }
  return result;
}

/** 単一の開始時刻がまだ空いているか（予約確定時の再チェック用） */
export function isSlotAvailable(
  ev: EventType,
  rules: SlotRules,
  busy: Interval[],
  startIso: string,
  now = new Date(),
  windows?: WindowsByDay,
): boolean {
  const day = localDateStr(new Date(startIso), rules.timeZone);
  return (computeSlots(ev, rules, busy, day, day, now, windows)[day] ?? []).includes(new Date(startIso).toISOString());
}
