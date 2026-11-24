import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin.ts";
import { getSettings } from "@/lib/settings.ts";
import { supabaseEnabled } from "@/lib/supabase.ts";
import SettingsEditor from "@/components/SettingsEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const s = await getSettings();
  return (
    <main className="wrap wide admin">
      <header className="admin-head">
        <div>
          <p className="muted small"><Link href="/admin">← 管理画面に戻る</Link></p>
          <h1>設定の変更</h1>
        </div>
      </header>
      {!supabaseEnabled() && (
        <div className="status warn">⚠ データベース（Supabase）未接続のため、変更はサーバーを再起動すると元に戻ります。</div>
      )}
      <SettingsEditor initial={s} />
    </main>
  );
}
