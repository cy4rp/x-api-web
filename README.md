# X API Web

X (Twitter) API v2 を組み込んだ Next.js Web アプリ。Vercel にデプロイし、環境変数を設定するだけで動作します。

## 機能

| 機能 | 必要な環境変数 | エンドポイント |
| --- | --- | --- |
| ツイート検索 (recent search) | `X_BEARER_TOKEN` | `GET /api/search?q=...` |
| ユーザー情報 + タイムライン | `X_BEARER_TOKEN` | `GET /api/users/:username` |
| X でログイン (OAuth 2.0 PKCE) | `X_CLIENT_ID`, `X_CLIENT_SECRET` | `GET /api/auth/login` |
| ログインユーザー取得 | 同上 | `GET /api/me` |
| ツイート投稿 | 同上 | `POST /api/tweets` `{ "text": "..." }` |
| アカウントマーケティング教科書 (`/benchmark`) | `X_BEARER_TOKEN` | `GET /api/benchmark/:username` |
| 設定状況の確認 | – | `GET /api/health` |

### アカウントマーケティング教科書 (/benchmark)

ベンチマークにしたいアカウントを複数登録すると、各アカウントのツイートをアカウント作成日基準で自動分類します。

| 章 | 期間 |
| --- | --- |
| 第1章 初日 | アカウント作成から24時間 |
| 第2章 アーリー段階 | 2日目〜3ヶ月 |
| 第3章 後期段階 | 4ヶ月目以降 |

各章で、投稿頻度・平均いいね・文字数・メディア比率・よく使うハッシュタグ・投稿時間帯などの傾向、エンゲージメント順の参考ツイート、使用画像/動画のギャラリーを横断的に閲覧できます。登録アカウントはブラウザ (localStorage) に保存されます。

制限: X API のユーザータイムラインは最新約3,200件までしか遡れないため、投稿数の多いアカウントでは「初日」「アーリー」に到達できない場合があります (UI に「未到達」と表示)。1アカウントあたりの取得ページ数は `BENCHMARK_MAX_PAGES` (既定 8 = 最大800件、1ページ=100件=APIリクエスト1回) で調整できます。

API キーはすべてサーバー側 (Route Handlers) でのみ使用され、ブラウザには送られません。
ログイン後のアクセストークンは AES-GCM で暗号化した httpOnly Cookie に保存されます。

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `X_BEARER_TOKEN` | 検索系を使う場合 | Developer Portal の App-only Bearer Token |
| `X_CLIENT_ID` | ログイン/投稿を使う場合 | OAuth 2.0 Client ID |
| `X_CLIENT_SECRET` | ログイン/投稿を使う場合 | OAuth 2.0 Client Secret |
| `SESSION_SECRET` | 任意 | Cookie 暗号化キー (未設定時は `X_CLIENT_SECRET`) |
| `BENCHMARK_MAX_PAGES` | 任意 | /benchmark で1アカウントあたり取得するタイムラインのページ数 (既定 8、最大 32) |
| `APP_URL` | 任意 | 公開 URL (例 `https://x-api-web.vercel.app`)。未設定時は Host ヘッダから自動判定 |

### X Developer Portal 側の設定 (ログイン/投稿を使う場合)

1. https://developer.x.com/en/portal/dashboard でアプリを開く
2. **User authentication settings** → **Set up**
   - App permissions: **Read and write**
   - Type of App: **Web App, Automated App or Bot**
   - Callback URI: `https://<デプロイ先ドメイン>/api/auth/callback`
   - Website URL: `https://<デプロイ先ドメイン>`
3. 発行された **Client ID / Client Secret** を Vercel の環境変数に設定

## Vercel での設定手順

- 本番 URL: https://x-api-web-omega.vercel.app
- プロジェクト: https://vercel.com/shoei-sugitas-projects/x-api-web

1. Vercel Dashboard → Project → **Settings → Environment Variables**
2. 上記の環境変数を追加 (Production / Preview)
3. **Deployments → Redeploy** で再デプロイ

## ローカル開発

```bash
cp .env.example .env.local   # 値を記入
npm install
npm run dev                  # http://localhost:3000
```
