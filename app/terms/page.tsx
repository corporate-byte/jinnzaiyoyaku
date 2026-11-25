import { getSettings } from "@/lib/settings.ts";

export const dynamic = "force-dynamic";

export default async function Terms() {
  const s = await getSettings();
  return (
    <main className="wrap">
      <div className="card pad legal">
        <h1>利用規約</h1>
        <p>本規約は、{s.teamName}（以下「当社」）が提供する面談予約ページ（以下「本サービス」）の利用条件を定めます。</p>
        <h2>1. 予約</h2>
        <p>予約は、本サービスで日時を選び必要事項を入力して確定した時点で成立します。</p>
        <h2>2. キャンセル</h2>
        <p>予約のキャンセルは、招待メールに記載のキャンセル用リンクから行えます。</p>
        <h2>3. 禁止事項</h2>
        <p>虚偽の情報での予約、他人へのなりすまし、本サービスの運営を妨げる行為を禁止します。</p>
        <h2>4. 免責</h2>
        <p>通信障害等により本サービスが利用できない場合があります。当社はこれにより生じた損害について責任を負いません。</p>
        <h2>5. 改定</h2>
        <p>当社は必要に応じて本規約を改定できます。</p>
      </div>
    </main>
  );
}
