# 予約カレンダーアプリ（Googleカレンダー連携）

Jicoo のような「空き時間を選ぶだけで予約できる」ページです。

- Googleカレンダーの予定を見て、**空いている時間だけ**を表示
- 予約するとGoogleカレンダーに予定を作成し、**Google Meet URLを自動発行**
- ゲストにGoogleから**招待メールが自動送信**（メール配信サービス不要）
- 予定の前後バッファ、受付時間、何時間前まで予約可能か、何日先まで予約可能か を設定可能
- ゲスト用のキャンセルリンク（署名付き・改ざん不可）
- スマホ対応

## 1. まずデモで動かす（Google設定なし）

```bash
npm install
cp .env.example .env.local   # MOCK_GOOGLE=1 のままでOK
npm run dev
```
http://localhost:3000 を開く。予約はメモリ上に保存されます。

## 管理画面

`/admin` を開き、パスワード（`ADMIN_PASSWORD`、未設定なら `ADMIN_SECRET`）でログインします。
- これからの予約・過去30日の予約の一覧（お名前・会社名・メール・メッセージ・Meetリンク）
- 予約のキャンセル（お客様にもGoogleからキャンセル通知が届きます）
- Google連携の状態、現在の受付時間・メニュー設定の確認
- **設定の変更（`/admin/settings`）**：チーム名・曜日ごとの受付時間・休業日・予約メニュー（追加/削除/非公開、所要時間、刻み、前後の間隔、締切、予約可能期間、場所、入力項目、色）
- QRコードページ（`/qr`）へのリンク

## データの保存先（Supabase: mambalike-app）

| テーブル | 中身 |
|---|---|
| `booking_settings` | 全体設定（チーム名・受付時間・休業日）※1行だけ |
| `booking_event_types` | 予約メニュー（1行＝1メニュー） |
| `bookings` | 予約の記録（予約・キャンセル時に自動で書き込み） |

すべて RLS 有効・ポリシーなし（アプリのサーバーだけが `SUPABASE_SERVICE_ROLE_KEY` で読み書き）。
`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定しないと、設定はメモリ上だけ（再起動で元に戻る）になります。
空き時間の判定は引き続き Googleカレンダーの予定で行います。

## 2. メニュー・受付時間の変更

管理画面の「⚙ 設定を変更」から行います（Supabase未接続時の初期値は `config/booking.config.ts`）。
- `weeklyHours` … 曜日ごとの受付時間
- `eventTypes` … 予約メニュー（所要時間、刻み、バッファ、締切、説明文など）
- `blockedDates` … 休業日

## 3. Googleカレンダーと連携する

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」で **Google Calendar API** を有効化
3. 「OAuth同意画面」を設定（外部 / 自分をテストユーザーに追加 → 本番運用時は「公開」に）
4. 「認証情報」→「OAuthクライアントID」→ 種類 **ウェブアプリケーション**
   - 承認済みリダイレクトURI: `{APP_URL}/api/auth/google/callback`
     （例: `http://localhost:3000/api/auth/google/callback`、本番は `https://あなたのドメイン/api/auth/google/callback`）
5. `.env.local` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `APP_URL` / `ADMIN_SECRET` を設定して起動
6. ブラウザで `{APP_URL}/api/auth/google?secret={ADMIN_SECRET}` を開き、予約を受けるGoogleアカウントでログイン
7. 表示されたリフレッシュトークンを `GOOGLE_REFRESH_TOKEN` に設定し、`MOCK_GOOGLE` を削除して再起動

> ⚠ OAuth同意画面が「テスト」状態のままだと、リフレッシュトークンが7日で失効します。運用時は「本番環境に公開」してください。

## 4. 公開（例: Vercel）

GitHubにpushして [Vercel](https://vercel.com) でインポート → Environment Variables に `.env.local` と同じ値（`MOCK_GOOGLE` 以外）を設定 → デプロイ。
`APP_URL` とGoogleのリダイレクトURIを本番URLに合わせてください。

## テスト

```bash
npm test
```
