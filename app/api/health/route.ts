import { NextResponse } from "next/server";
import { rpc, supabaseEnabled } from "@/lib/supabase.ts";
import { isMock } from "@/lib/google.ts";

export const dynamic = "force-dynamic";

// 接続確認用（キーの値は出さない）: /api/health
export async function GET() {
  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_SECRET: !!process.env.ADMIN_SECRET,
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    APP_URL: !!process.env.APP_URL,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
    MOCK_GOOGLE_残っている: process.env.MOCK_GOOGLE === "1",
  };
  let supabase = "未設定";
  if (supabaseEnabled()) {
    try {
      const s = await rpc<{ teamName?: string } | null>("booking_get_settings");
      supabase = s?.teamName ? "接続OK" : "接続できたが設定が空";
    } catch (e) {
      supabase = "接続エラー: " + String((e as Error).message).replace(/sb_secret_\S+|eyJ\S+/g, "***").slice(0, 200);
    }
  }
  return NextResponse.json({ supabase, google: (await isMock()) ? "デモモード" : "Google連携", env }, { headers: { "Cache-Control": "no-store" } });
}
