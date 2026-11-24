// ============================================================
// 予約ページの設定の「初期値」。
// Supabase に接続している場合、実際の設定は管理画面（/admin/settings）から変更し、
// Supabase の booking_settings / booking_event_types に保存されます。
// busyCalendars / bookingCalendar（Googleカレンダーの指定）だけはここで設定します。
// ============================================================

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = 日曜

export type EventType = {
  slug: string; // URL: /{slug}
  name: string;
  description: string; // 改行可
  durationMinutes: number;
  intervalMinutes: number; // 開始時刻の刻み
  bufferBeforeMinutes: number; // 前の予定との間隔
  bufferAfterMinutes: number; // 後の予定との間隔
  minNoticeMinutes: number; // 何分前まで予約可能か
  bookingWindowDays: number; // 何日先まで予約可能か
  location: { type: "google_meet" } | { type: "zoom"; url: string } | { type: "in_person"; address: string } | { type: "phone" };
  color: string;
  fields: { company: "required" | "optional" | "hidden"; message: "required" | "optional" | "hidden" };
};

export const config = {
  teamName: "求職者送客の窓口",
  hostName: "担当者",
  timeZone: "Asia/Tokyo",
  // 空き時間の判定に使うGoogleカレンダー（"primary" = 連携したアカウントのメインカレンダー）
  busyCalendars: ["primary"],
  // 予約を書き込むカレンダー
  bookingCalendar: "primary",
  // 曜日ごとの受付時間（ローカル時刻 "HH:MM"）。複数枠可。空配列 = 休み
  weeklyHours: {
    0: [],
    1: [{ start: "10:00", end: "19:00" }],
    2: [{ start: "10:00", end: "19:00" }],
    3: [{ start: "10:00", end: "19:00" }],
    4: [{ start: "10:00", end: "19:00" }],
    5: [{ start: "10:00", end: "19:00" }],
    6: [],
  } as Record<Weekday, { start: string; end: string }[]>,
  // 受付しない日（"YYYY-MM-DD"）
  blockedDates: [] as string[],
  eventTypes: [
    {
      slug: "career-60",
      name: "転職相談・キャリア面談（60分）",
      description:
        "■ 概要\nこれまでのご経歴やご希望を伺い、最適なキャリアプランをご提案します。\n\n■ 注意事項\n・オンライン（Google Meet）で実施します\n・開始時刻の5分前には入室をお願いします",
      durationMinutes: 60,
      intervalMinutes: 15,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 0,
      minNoticeMinutes: 60 * 21, // Jicooの「21時間前まで」に相当
      bookingWindowDays: 30,
      location: { type: "google_meet" },
      color: "#1F74F2",
      fields: { company: "optional", message: "optional" },
    },
    {
      slug: "intro-30",
      name: "カジュアル面談（30分）",
      description: "まずは気軽にお話ししましょう。",
      durationMinutes: 30,
      intervalMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minNoticeMinutes: 120,
      bookingWindowDays: 14,
      location: { type: "google_meet" },
      color: "#0E9F6E",
      fields: { company: "optional", message: "optional" },
    },
  ] satisfies EventType[] as EventType[],
};

export function getEventType(slug: string): EventType | undefined {
  return config.eventTypes.find((e) => e.slug === slug);
}
