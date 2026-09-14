"use client";

import { useEffect, useState } from "react";
import type { SearchResponse, Tweet, XUser } from "@/lib/x";

type Config = { bearerToken: boolean; oauth: boolean; sessionSecret: boolean };
type ApiError = { error: string; status?: number; details?: unknown };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) {
    const e = body as ApiError;
    const detail = e.details ? ` — ${JSON.stringify(e.details)}` : "";
    throw new Error(`${e.error}${detail}`);
  }
  return body as T;
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"
      }`}
    >
      {ok ? "✓" : "–"} {label}
    </span>
  );
}

function TweetCard({ tweet, author }: { tweet: Tweet; author?: XUser }) {
  const m = tweet.public_metrics;
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      {author && (
        <div className="mb-1 flex items-center gap-2 text-zinc-600">
          {author.profile_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.profile_image_url} alt="" className="h-6 w-6 rounded-full" />
          )}
          <span className="font-medium text-zinc-900">{author.name}</span>
          <span>@{author.username}</span>
        </div>
      )}
      <p className="whitespace-pre-wrap text-zinc-900">{tweet.text}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
        {tweet.created_at && <span>{new Date(tweet.created_at).toLocaleString()}</span>}
        {m && (
          <>
            <span>♥ {m.like_count}</span>
            <span>↻ {m.retweet_count}</span>
            <span>💬 {m.reply_count}</span>
          </>
        )}
        <a
          className="text-sky-600 hover:underline"
          href={`https://x.com/${author?.username ?? "i"}/status/${tweet.id}`}
          target="_blank"
          rel="noreferrer"
        >
          open
        </a>
      </div>
    </li>
  );
}

export function XClient({ config, authMsg }: { config: Config; authMsg: string | null }) {
  const [me, setMe] = useState<XUser | null>(null);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<{ user: XUser; tweets: Tweet[] } | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [text, setText] = useState("");
  const [postMsg, setPostMsg] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (window.location.search) window.history.replaceState({}, "", "/");
    if (!config.oauth) return;
    api<{ user: XUser | null }>("/api/me")
      .then((r) => setMe(r.user))
      .catch(() => setMe(null));
  }, [config.oauth]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchErr(null);
    try {
      setSearch(await api<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`));
    } catch (err) {
      setSearch(null);
      setSearchErr((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function onProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoadingProfile(true);
    setProfileErr(null);
    try {
      setProfile(await api(`/api/users/${encodeURIComponent(username.replace(/^@/, ""))}`));
    } catch (err) {
      setProfile(null);
      setProfileErr((err as Error).message);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function onPost(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    setPostMsg(null);
    try {
      const r = await api<{ data?: { id: string } }>("/api/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setPostMsg(`投稿しました (id: ${r.data?.id})`);
      setText("");
    } catch (err) {
      setPostMsg(`投稿に失敗しました: ${(err as Error).message}`);
    } finally {
      setPosting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
  }

  const authors = new Map((search?.includes?.users ?? []).map((u) => [u.id, u]));

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-semibold">X API Web</h1>
          <div className="flex flex-wrap gap-2">
            <Badge ok={config.bearerToken} label="X_BEARER_TOKEN" />
            <Badge ok={config.oauth} label="OAuth (CLIENT_ID/SECRET)" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
        {!config.bearerToken && !config.oauth && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            環境変数が未設定です。Vercel の Project Settings → Environment Variables で
            <code className="mx-1 rounded bg-amber-100 px-1">X_BEARER_TOKEN</code>
            (検索・ユーザー取得) と
            <code className="mx-1 rounded bg-amber-100 px-1">X_CLIENT_ID</code>/
            <code className="mx-1 rounded bg-amber-100 px-1">X_CLIENT_SECRET</code>
            (ログイン・投稿) を設定して再デプロイしてください。
          </div>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">ツイート検索 (recent search)</h2>
          <form onSubmit={onSearch} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="例: bitcoin lang:ja -is:retweet"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!config.bearerToken}
            />
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              disabled={!config.bearerToken || searching || !query.trim()}
            >
              {searching ? "検索中…" : "検索"}
            </button>
          </form>
          {searchErr && <p className="mt-3 text-sm text-red-600">{searchErr}</p>}
          {search && (
            <ul className="mt-4 flex flex-col gap-3">
              {(search.data ?? []).length === 0 && <li className="text-sm text-zinc-500">結果なし</li>}
              {(search.data ?? []).map((t) => (
                <TweetCard key={t.id} tweet={t} author={t.author_id ? authors.get(t.author_id) : undefined} />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">ユーザー検索 / タイムライン</h2>
          <form onSubmit={onProfile} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!config.bearerToken}
            />
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              disabled={!config.bearerToken || loadingProfile || !username.trim()}
            >
              {loadingProfile ? "取得中…" : "取得"}
            </button>
          </form>
          {profileErr && <p className="mt-3 text-sm text-red-600">{profileErr}</p>}
          {profile && (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                {profile.user.profile_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.user.profile_image_url} alt="" className="h-12 w-12 rounded-full" />
                )}
                <div>
                  <div className="font-semibold">{profile.user.name}</div>
                  <div className="text-sm text-zinc-500">@{profile.user.username}</div>
                </div>
              </div>
              {profile.user.description && <p className="mt-2 text-sm">{profile.user.description}</p>}
              {profile.user.public_metrics && (
                <p className="mt-1 text-xs text-zinc-500">
                  フォロワー {profile.user.public_metrics.followers_count.toLocaleString()} / フォロー{" "}
                  {profile.user.public_metrics.following_count.toLocaleString()} / ツイート{" "}
                  {profile.user.public_metrics.tweet_count.toLocaleString()}
                </p>
              )}
              <ul className="mt-4 flex flex-col gap-3">
                {profile.tweets.map((t) => (
                  <TweetCard key={t.id} tweet={t} author={profile.user} />
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">ログイン & 投稿 (OAuth 2.0)</h2>
          {authMsg && <p className="mb-3 text-sm text-zinc-700">{authMsg}</p>}
          {!config.oauth ? (
            <p className="text-sm text-zinc-500">X_CLIENT_ID / X_CLIENT_SECRET を設定すると有効になります。</p>
          ) : !me ? (
            <a
              href="/api/auth/login"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              X でログイン
            </a>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span>
                  ログイン中: <span className="font-medium">{me.name}</span> @{me.username}
                </span>
                <button onClick={logout} className="text-zinc-500 hover:underline">
                  ログアウト
                </button>
              </div>
              <form onSubmit={onPost} className="flex flex-col gap-2">
                <textarea
                  className="min-h-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="いまどうしてる？"
                  value={text}
                  maxLength={280}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{text.length}/280</span>
                  <button
                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    disabled={posting || !text.trim()}
                  >
                    {posting ? "投稿中…" : "投稿"}
                  </button>
                </div>
              </form>
              {postMsg && <p className="mt-2 text-sm">{postMsg}</p>}
            </div>
          )}
        </section>

        <section className="text-xs text-zinc-500">
          API: <code>GET /api/health</code>, <code>GET /api/search?q=</code>, <code>GET /api/users/:username</code>,{" "}
          <code>GET /api/me</code>, <code>POST /api/tweets</code>
        </section>
      </main>
    </div>
  );
}
