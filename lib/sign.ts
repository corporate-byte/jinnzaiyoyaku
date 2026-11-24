import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET is not set");
  return s;
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url").slice(0, 32);
}

export function verify(value: string, sig: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
