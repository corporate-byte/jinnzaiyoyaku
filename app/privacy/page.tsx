import { getSettings } from "@/lib/settings.ts";

export const dynamic = "force-dynamic";

export default async function Privacy() {
  const s = await getSettings();
  return (
    <main className="wrap">
      <div className="card pad legal">
        <h1>プライバシーポリシー</h1>
        <p>{s.teamName}（以下「当社」）は、面談予約ページ（以下「本サービス」）で取得する個人情報を次のとおり取り扱います。</p>
        <h2>1. 取得する情報</h2>
        <p>お名前、メールアドレス、会社名、メッセージ、予約日時。</p>
        <h2>2. 利用目的</h2>
        <p>面談の日程調整、Googleカレンダーへの予定登録と招待メールの送信、面談の実施および連絡のため。</p>
        <h2>3. 第三者への提供</h2>
        <p>法令に基づく場合を除き、本人の同意なく第三者に提供しません。予定の登録にGoogle（Googleカレンダー）を、データの保存にSupabaseを利用します。</p>
        <h2>4. Googleユーザーデータの取り扱い</h2>
        <p>本サービスは、当社担当者が連携したGoogleカレンダーについて、空き時間の確認と予約の予定作成・削除のためだけにアクセスします。取得したデータを広告や他の目的に利用したり、第三者に販売したりすることはありません。</p>
        <h2>5. 開示・訂正・削除</h2>
        <p>ご本人からの請求があった場合、合理的な範囲で速やかに対応します。予約確認の招待メールに記載の連絡先までご連絡ください。</p>
        <h2>6. 改定</h2>
        <p>本ポリシーは必要に応じて改定することがあります。</p>
      </div>
    </main>
  );
}
