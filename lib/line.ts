// LINE通知（LINE公式アカウントの Messaging API）
import { createHmac, timingSafeEqual } from "node:crypto";
import { sb, supabaseEnabled } from "./supabase.ts";

const API = "https://api.line.me/v2/bot";

export function lineEnabled(): boolean {
  return !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET && supabaseEnabled());
}

/** Webhook の署名確認（X-Line-Signature） */
export function verifyLineSignature(body: string, signature: string | null): boolean {
  if (!process.env.LINE_CHANNEL_SECRET || !signature) return false;
  const expected = createHmac("sha256", process.env.LINE_CHANNEL_SECRET).update(body).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function lineApi(path: string, body: unknown): Promise<void> {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LINE ${path} failed: ${res.status} ${await res.text()}`);
}

export async function lineReply(replyToken: string, text: string): Promise<void> {
  await lineApi("/message/reply", { replyToken, messages: [{ type: "text", text }] });
}

export async function addTarget(id: string, kind: "group" | "room" | "user"): Promise<void> {
  await sb("/booking_line_targets?on_conflict=id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: JSON.stringify({ id, kind }),
  });
}

export async function removeTarget(id: string): Promise<void> {
  await sb(`/booking_line_targets?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function listTargets(): Promise<{ id: string; kind: string }[]> {
  return (await (await sb("/booking_line_targets?select=id,kind&order=created_at")).json()) as { id: string; kind: string }[];
}

/** 登録されている全員に送る。送れた数を返す（失敗しても予約処理は止めない） */
export async function notifyLine(text: string): Promise<number> {
  if (!lineEnabled()) return 0;
  let ok = 0;
  for (const t of await listTargets()) {
    try {
      await lineApi("/message/push", { to: t.id, messages: [{ type: "text", text: text.slice(0, 4900) }] });
      ok++;
    } catch (e) {
      console.error("LINE push failed", t.kind, e);
    }
  }
  return ok;
}
