// タイムゾーン補助（外部ライブラリなし）

/** その瞬間における tz のUTCオフセット（分）。例: Asia/Tokyo → 540 */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** tz の壁時計時刻 → UTC の Date */
export function zonedToUtc(dateStr: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let off = tzOffsetMinutes(new Date(guess), timeZone);
  let t = guess - off * 60000;
  // DST境界での補正
  const off2 = tzOffsetMinutes(new Date(t), timeZone);
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}

/** UTC の Date → tz での "YYYY-MM-DD" */
export function localDateStr(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** "YYYY-MM-DD" に n 日足す */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" の曜日 (0=日) */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatJa(date: Date, timeZone: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone, ...opts }).format(date);
}
