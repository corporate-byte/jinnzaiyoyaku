// 空き時間の元データ：
//  - 曜日モード：Googleカレンダーの予定（busy）だけ見て、受付時間は曜日ごとの設定
//  - キーワードモード：カレンダーに「キーワード（例：伏見）」が題名に入った予定がある時間だけ受付。
//    ほかの予定（同じカレンダー）と重なる時間は予約できない
import { config as calendars } from "../config/booking.config.ts";
import { getBusy, listEvents, type CalEvent } from "./google.ts";
import type { Settings } from "./settings.ts";
import type { Interval, WindowsByDay } from "./slots.ts";
import { addDays, localDateStr, weekdayOf, zonedToUtc } from "./time.ts";
import type { Weekday } from "../config/booking.config.ts";

export type Availability = { busy: Interval[]; windows?: WindowsByDay };

/** キーワードの予定から受付時間帯を、それ以外の予定から予定ありの時間を作る（テストしやすいように純粋関数） */
export function splitByKeyword(events: CalEvent[], keyword: string, s: Pick<Settings, "timeZone" | "weeklyHours">): Availability {
  const tz = s.timeZone;
  const kw = keyword.trim().toLowerCase();
  const windows: WindowsByDay = {};
  const busy: Interval[] = [];
  const push = (day: string, start: Date, end: Date) => (windows[day] ??= []).push({ start, end });
  for (const e of events) {
    // 予約アプリが作った予定（お客様の名前に「伏見」が入っている等）は受付時間にしない
    if (kw && !e.mine && e.summary.toLowerCase().includes(kw)) {
      if (e.allDay && e.startDate) {
        // 終日の「伏見」→ その日の受付時間（曜日ごとの設定）。設定がない曜日は 10:00〜19:00
        for (let d = e.startDate; d < (e.endDate ?? addDays(e.startDate, 1)); d = addDays(d, 1)) {
          const hours = s.weeklyHours[weekdayOf(d) as Weekday]?.length ? s.weeklyHours[weekdayOf(d) as Weekday] : [{ start: "10:00", end: "19:00" }];
          for (const h of hours) push(d, zonedToUtc(d, h.start, tz), zonedToUtc(d, h.end, tz));
        }
      } else {
        // 時間指定の「伏見」→ その時間。日をまたぐ場合は日ごとに分ける
        let cur = e.start;
        while (cur < e.end) {
          const day = localDateStr(cur, tz);
          const next = zonedToUtc(addDays(day, 1), "00:00", tz);
          const end = e.end < next ? e.end : next;
          push(day, cur, end);
          cur = end;
        }
      }
    } else if (e.busy && !e.allDay) {
      busy.push({ start: e.start, end: e.end });
    }
  }
  return { busy, windows };
}

export async function getAvailability(s: Settings, timeMin: Date, timeMax: Date): Promise<Availability> {
  const optional = s.hostEmail ? [s.hostEmail] : [];
  if (s.availabilityMode !== "keyword") {
    return { busy: await getBusy(calendars.busyCalendars, timeMin, timeMax, optional) };
  }
  // キーワードモード：連携カレンダー（と、見られれば担当者のカレンダー）の予定を題名つきで読む
  const all: CalEvent[] = [];
  for (const id of calendars.busyCalendars) all.push(...(await listEvents(id, timeMin, timeMax)));
  const extraBusy: Interval[] = [];
  for (const id of optional) {
    try {
      all.push(...(await listEvents(id, timeMin, timeMax)));
    } catch {
      // 題名が見られない（共有されていない）担当者カレンダーは「予定あり」だけ見る
      extraBusy.push(...(await getBusy([], timeMin, timeMax, [id]).catch(() => [])));
    }
  }
  const r = splitByKeyword(all, s.availabilityKeyword || "伏見", s);
  return { busy: [...r.busy, ...extraBusy], windows: r.windows };
}

/** 終日でない予定の時間を、日付の範囲として取得するときの範囲（前後1日の余裕） */
export function rangeFor(from: string, to: string, tz: string): [Date, Date] {
  return [zonedToUtc(addDays(from, -1), "00:00", tz), zonedToUtc(addDays(to, 2), "00:00", tz)];
}
