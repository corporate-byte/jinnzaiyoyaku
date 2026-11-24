import { NextRequest, NextResponse } from "next/server";
import { authUrl } from "@/lib/google.ts";
import { safeEqual, sign } from "@/lib/sign.ts";
import { isAdmin } from "@/lib/admin.ts";

export const dynamic = "force-dynamic";

// 管理者が一度だけアクセスして Google アカウントを連携する（管理画面にログイン中、または ?secret=ADMIN_SECRET）
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("secret") ?? "";
  const bySecret = !!process.env.ADMIN_SECRET && safeEqual(s, process.env.ADMIN_SECRET);
  if (!bySecret && !(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!process.env.GOOGLE_CLIENT_ID) return new NextResponse("Vercel の環境変数 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / APP_URL を設定して Redeploy してください", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const nonce = crypto.randomUUID();
  return NextResponse.redirect(authUrl(`${appUrl}/api/auth/google/callback`, `${nonce}.${sign(nonce)}`));
}
