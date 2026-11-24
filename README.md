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

## 2. メニュー・受付時間の変更

`config/booking.config.ts` を編集します。
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
