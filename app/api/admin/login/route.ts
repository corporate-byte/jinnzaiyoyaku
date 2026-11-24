import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, sessionValue } from "@/lib/admin.ts";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const url = new URL("/admin", req.url);
  if (!checkPassword(String(form.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 800)); // 総当たり対策
    return NextResponse.redirect(new URL("/admin/login?error=1", req.url), 303);
  }
  const { value, maxAge } = sessionValue();
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(ADMIN_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge });
  return res;
}
