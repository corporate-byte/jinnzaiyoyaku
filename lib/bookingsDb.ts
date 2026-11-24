// 予約の記録（Supabase の bookings テーブル）。Supabase 未設定なら何もしない。
import { sb, supabaseEnabled } from "./supabase.ts";
import type { Booking } from "./google.ts";

type Row = {
  id: string; slug: string; menu: string; start_at: string; end_at: string; name: string; email: string;
  company: string | null; message: string | null; meet_url: string | null; status: string;
};

export async function recordBooking(b: Omit<Booking, "htmlLink">): Promise<void> {
  if (!supabaseEnabled()) return;
  await sb("/bookings", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id: b.id, slug: b.slug, menu: b.menu, start_at: b.start.toISOString(), end_at: b.end.toISOString(),
      name: b.name, email: b.email, company: b.company || null, message: b.message || null, meet_url: b.meetUrl ?? null, status: "confirmed",
    }),
  });
}

export async function markCancelled(id: string, by: "guest" | "admin"): Promise<void> {
  if (!supabaseEnabled()) return;
  await sb(`/bookings?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: by }),
  });
}

export async function listBookingsDb(from: Date, to: Date): Promise<Booking[]> {
  const q = new URLSearchParams({ select: "*", status: "eq.confirmed", order: "start_at.asc" });
  q.append("start_at", `gte.${from.toISOString()}`);
  q.append("start_at", `lt.${to.toISOString()}`);
  const rows = (await (await sb(`/bookings?${q}`)).json()) as Row[];
  return rows.map((r) => ({
    id: r.id, slug: r.slug, menu: r.menu, start: new Date(r.start_at), end: new Date(r.end_at), name: r.name, email: r.email,
    company: r.company ?? "", message: r.message ?? "", meetUrl: r.meet_url ?? undefined,
  }));
}
