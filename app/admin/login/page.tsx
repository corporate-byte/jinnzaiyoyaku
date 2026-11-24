import { config } from "@/config/booking.config.ts";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="wrap">
      <form className="card pad form login" method="post" action="/api/admin/login">
        <h1>管理画面ログイン</h1>
        <p className="muted small">{config.teamName}</p>
        <label>
          パスワード
          <input type="password" name="password" required autoFocus autoComplete="current-password" />
        </label>
        {error && <p className="err">パスワードが違います</p>}
        <button className="btn">ログイン</button>
      </form>
    </main>
  );
}
