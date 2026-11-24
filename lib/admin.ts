import { cookies } from "next/headers";
import { safeEqual, sign, verify } from "./sign.ts";

const COOKIE = "admin_session";
const TTL_MS = 7 * 24 * 3600 * 1000;

/** 管理画面のパスワード（ADMIN_PASSWORD、未設定なら ADMIN_SECRET） */
export function checkPassword(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || "";
  return !!expected && safeEqual(pw, expected);
}

export function sessionValue(): { value: string; maxAge: number } {
  const exp = String(Date.now() + TTL_MS);
  return { value: `${exp}.${sign("admin:" + exp)}`, maxAge: TTL_MS / 1000 };
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const [exp, sig] = v.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try {
    return verify("admin:" + exp, sig);
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = COOKIE;
