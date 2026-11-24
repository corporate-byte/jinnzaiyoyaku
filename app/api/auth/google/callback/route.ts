import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google.ts";
import { verify } from "@/lib/sign.ts";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [nonce, sig] = (q.get("state") ?? "").split(".");
  if (!nonce || !sig || !verify(nonce, sig)) return new NextResponse("Invalid state", { status: 403 });
  const code = q.get("code");
  if (!code) return new NextResponse(`連携がキャンセルされました: ${esc(q.get("error") ?? "")}`, { status: 400 });
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const tok = await exchangeCode(code, `${appUrl}/api/auth/google/callback`);
  const html = `<!doctype html><meta charset="utf-8"><title>Google連携</title>
<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.7">
<h1>Google カレンダー連携 完了</h1>
${
  tok.refresh_token
    ? `<p>以下を環境変数 <code>GOOGLE_REFRESH_TOKEN</code> に設定し、<code>MOCK_GOOGLE</code> を削除（または 0）にしてサーバーを再起動してください。</p>
<textarea readonly style="width:100%;height:90px">${esc(tok.refresh_token)}</textarea>
<p style="color:#b00">※このトークンは他人に見せないでください。</p>`
    : `<p>リフレッシュトークンが返されませんでした。<a href="https://myaccount.google.com/permissions">Googleアカウントのアクセス権</a>からこのアプリを削除して、もう一度連携してください。</p>`
}</body>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
