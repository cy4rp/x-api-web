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
| 設定状況の確認 | – | `GET /api/health` |

API キーはすべてサーバー側 (Route Handlers) でのみ使用され、ブラウザには送られません。
ログイン後のアクセストークンは AES-GCM で暗号化した httpOnly Cookie に保存されます。

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `X_BEARER_TOKEN` | 検索系を使う場合 | Developer Portal の App-only Bearer Token |
| `X_CLIENT_ID` | ログイン/投稿を使う場合 | OAuth 2.0 Client ID |
| `X_CLIENT_SECRET` | ログイン/投稿を使う場合 | OAuth 2.0 Client Secret |
| `SESSION_SECRET` | 任意 | Cookie 暗号化キー (未設定時は `X_CLIENT_SECRET`) |
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

1. Vercel Dashboard → Project → **Settings → Environment Variables**
2. 上記の環境変数を追加 (Production / Preview)
3. **Deployments → Redeploy** で再デプロイ

## ローカル開発

```bash
cp .env.example .env.local   # 値を記入
npm install
npm run dev                  # http://localhost:3000
```
