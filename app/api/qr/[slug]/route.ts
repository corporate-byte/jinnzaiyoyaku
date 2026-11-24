import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getEventType } from "@/config/booking.config.ts";
import { baseUrl } from "@/lib/baseUrl.ts";

export const dynamic = "force-dynamic";

// /api/qr/{slug}?format=png|svg  → 予約ページURLのQRコード画像
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isTop = slug === "top";
  if (!isTop && !getEventType(slug)) return new NextResponse("Not found", { status: 404 });
  const url = `${await baseUrl()}/${isTop ? "" : slug}`;
  const opts = { margin: 2, errorCorrectionLevel: "M" as const };
  const name = `qr-${slug}`;
  if (req.nextUrl.searchParams.get("format") === "svg") {
    const svg = await QRCode.toString(url, { ...opts, type: "svg" });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `inline; filename="${name}.svg"`, "Cache-Control": "no-store" } });
  }
  const png = await QRCode.toBuffer(url, { ...opts, width: 1024 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `inline; filename="${name}.png"`, "Cache-Control": "no-store" } });
}
