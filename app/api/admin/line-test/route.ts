import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin.ts";
import { lineEnabled, notifyLine } from "@/lib/line.ts";

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "ログインし直してください" }, { status: 401 });
  if (!lineEnabled()) return NextResponse.json({ error: "LINEの設定（LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET）がまだです" }, { status: 400 });
  const n = await notifyLine("🔔 テスト通知\n面談予約アプリからのテストです。予約・キャンセルがあるとここにお知らせします。");
  return n ? NextResponse.json({ ok: true, sent: n }) : NextResponse.json({ error: "送り先がありません。LINEグループに公式アカウントを招待してください" }, { status: 400 });
}
