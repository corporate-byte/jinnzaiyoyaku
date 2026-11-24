import { NextRequest, NextResponse } from "next/server";
import { authUrl } from "@/lib/google.ts";
import { safeEqual, sign } from "@/lib/sign.ts";

export const dynamic = "force-dynamic";

// 管理者が一度だけアクセスして Google アカウントを連携する: /api/auth/google?secret=ADMIN_SECRET
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("secret") ?? "";
  if (!process.env.ADMIN_SECRET || !safeEqual(s, process.env.ADMIN_SECRET)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!process.env.GOOGLE_CLIENT_ID) return new NextResponse("GOOGLE_CLIENT_ID が未設定です", { status: 500 });
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const nonce = crypto.randomUUID();
  return NextResponse.redirect(authUrl(`${appUrl}/api/auth/google/callback`, `${nonce}.${sign(nonce)}`));
}
