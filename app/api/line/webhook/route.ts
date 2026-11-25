import { NextRequest, NextResponse } from "next/server";
import { addTarget, lineReply, removeTarget, verifyLineSignature } from "@/lib/line.ts";

export const dynamic = "force-dynamic";

type Src = { type: "group" | "room" | "user"; groupId?: string; roomId?: string; userId?: string };
type Ev = { type: string; replyToken?: string; source?: Src; message?: { type: string; text?: string } };

const idOf = (s: Src) => s.groupId ?? s.roomId ?? s.userId ?? "";

// LINE公式アカウントの Webhook。グループに招待・友だち追加で通知先に登録、「解除」で外す
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!verifyLineSignature(body, req.headers.get("x-line-signature"))) return new NextResponse("bad signature", { status: 401 });
  const { events = [] } = JSON.parse(body) as { events?: Ev[] };
  for (const ev of events) {
    const src = ev.source;
    if (!src) continue;
    const id = idOf(src);
    try {
      const text = ev.message?.type === "text" ? (ev.message.text ?? "").trim() : "";
      if (ev.type === "join" || ev.type === "follow" || text === "登録" || text === "通知登録") {
        await addTarget(id, src.type);
        if (ev.replyToken) await lineReply(ev.replyToken, "✅ 面談予約の通知先に登録しました。\n予約・キャンセルがあるとここにお知らせします。\n（やめるときは「解除」と送ってください）");
      } else if (ev.type === "leave" || ev.type === "unfollow") {
        await removeTarget(id);
      } else if (text === "解除" || text === "通知解除") {
        await removeTarget(id);
        if (ev.replyToken) await lineReply(ev.replyToken, "面談予約の通知を止めました。（また受け取るときは「登録」と送ってください）");
      }
    } catch (e) {
      console.error("LINE webhook error", e);
    }
  }
  return NextResponse.json({ ok: true });
}
