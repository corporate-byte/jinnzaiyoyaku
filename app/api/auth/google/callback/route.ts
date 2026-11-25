import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveRefreshToken } from "@/lib/google.ts";
import { verify } from "@/lib/sign.ts";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [nonce, sig] = (q.get("state") ?? "").split(".");
  if (!nonce || !sig || !verify(nonce, sig)) return new NextResponse("Invalid state", { status: 403 });
  const code = q.get("code");
  if (!code) return new NextResponse(`連携がキャンセルされました: ${esc(q.get("error") ?? "")}`, { status: 400 });
  const appUrl = (process.env.APP_URL?.trim() || req.nextUrl.origin).replace(/\/+$/, "");
  let tok: { refresh_token?: string };
  try {
    tok = await exchangeCode(code, `${appUrl}/api/auth/google/callback`);
  } catch (e) {
    const msg = String((e as Error).message);
    const hint = /invalid_client|unauthorized_client/.test(msg)
      ? "Vercel の GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が Google Cloud のクライアントと一致しているか確認してください。"
      : /redirect_uri_mismatch/.test(msg)
        ? "Google Cloud のクライアントの「承認済みのリダイレクト URI」を確認してください。"
        : "";
    return new NextResponse(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.7"><h1>連携できませんでした</h1><p>${esc(hint)}</p><pre style="white-space:pre-wrap;background:#f4f4f4;padding:10px;font-size:12px">${esc(msg.slice(0, 400))}</pre><p><a href="/admin">管理画面に戻る</a></p></body>`, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  let saved = false;
  if (tok.refresh_token) {
    try {
      saved = await saveRefreshToken(tok.refresh_token);
    } catch (e) {
      console.error(e);
    }
  }
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google連携</title>
<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.7">
${
  saved
    ? `<h1>✅ Googleカレンダーと連携しました</h1><p>これで予約がGoogleカレンダーに入るようになりました。</p><p><a href="/admin">管理画面に戻る</a></p>`
    : tok.refresh_token
      ? `<h1>Google カレンダー連携</h1><p>データベースに保存できなかったため、下の文字列を Vercel の環境変数 <code>GOOGLE_REFRESH_TOKEN</code> に設定して Redeploy してください。</p>
<textarea readonly style="width:100%;height:90px">${esc(tok.refresh_token)}</textarea><p style="color:#b00">※このトークンは他人に見せないでください。</p>`
      : `<h1>連携できませんでした</h1><p>Googleから鍵が返されませんでした。<a href="https://myaccount.google.com/permissions">Googleアカウントのアクセス権</a>から「面談予約」を削除して、もう一度連携してください。</p>`
}</body>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
