"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PHASES, engagement, type BenchmarkResult, type BenchmarkTweet, type PhaseId } from "@/lib/benchmark";

const STORAGE_KEY = "benchmark_accounts";

type Entry = { username: string; status: "ok" | "error"; data?: BenchmarkResult; error?: string };

function loadAccounts(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveAccounts(list: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function fmt(n: number) {
  return n.toLocaleString();
}

function KindTag({ kind }: { kind: BenchmarkTweet["kind"] }) {
  const label = { post: "投稿", reply: "リプ", retweet: "RT", quote: "引用" }[kind];
  return <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{label}</span>;
}

function TweetCard({ t }: { t: BenchmarkTweet }) {
  const m = t.public_metrics;
  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="font-medium text-zinc-800">@{t.username}</span>
        <KindTag kind={t.kind} />
        <span>作成 {t.ageDays} 日目</span>
        {t.created_at && <span>{new Date(t.created_at).toLocaleDateString()}</span>}
      </div>
      <p className="whitespace-pre-wrap text-zinc-900">{t.text}</p>
      {t.media.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {t.media.map((md) => {
            const src = md.url ?? md.preview_image_url;
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={md.media_key} src={src} alt={md.alt_text ?? ""} className="h-24 rounded object-cover" />
            ) : null;
          })}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
        {m && (
          <>
            <span>♥ {fmt(m.like_count)}</span>
            <span>↻ {fmt(m.retweet_count)}</span>
            <span>💬 {fmt(m.reply_count)}</span>
          </>
        )}
        <a
          className="text-sky-600 hover:underline"
          href={`https://x.com/${t.username}/status/${t.id}`}
          target="_blank"
          rel="noreferrer"
        >
          open
        </a>
      </div>
    </li>
  );
}

export function BenchmarkClient({ hasBearer }: { hasBearer: boolean }) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [phase, setPhase] = useState<PhaseId>("day1");

  function load(u: string) {
    if (!hasBearer) return;
    fetch(`/api/benchmark/${encodeURIComponent(u)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error + (body.details ? ` — ${JSON.stringify(body.details)}` : ""));
        setEntries((prev) => ({ ...prev, [u]: { username: u, status: "ok", data: body as BenchmarkResult } }));
      })
      .catch((e: Error) => setEntries((prev) => ({ ...prev, [u]: { username: u, status: "error", error: e.message } })));
  }

  useEffect(() => {
    const list = loadAccounts();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccounts(list);
    list.forEach(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addAccounts(e: React.FormEvent) {
    e.preventDefault();
    const names = input
      .split(/[\s,、]+/)
      .map((s) => s.trim().replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, ""))
      .filter(Boolean)
      .map((s) => s.toLowerCase());
    const next = Array.from(new Set([...accounts, ...names]));
    setAccounts(next);
    saveAccounts(next);
    setInput("");
    names.filter((n) => !accounts.includes(n)).forEach(load);
  }

  function remove(u: string) {
    const next = accounts.filter((a) => a !== u);
    setAccounts(next);
    saveAccounts(next);
    setEntries((prev) => {
      const copy = { ...prev };
      delete copy[u];
      return copy;
    });
  }

  function reload(u: string) {
    setEntries((prev) => {
      const copy = { ...prev };
      delete copy[u];
      return copy;
    });
    load(u);
  }

  const loaded = useMemo(
    () => accounts.map((u) => entries[u]).filter((e): e is Entry & { data: BenchmarkResult } => e?.status === "ok"),
    [accounts, entries],
  );

  const current = useMemo(() => {
    const perAccount = loaded.map((e) => ({
      user: e.data.user,
      covered: e.data.coverage[phase],
      phase: e.data.phases.find((p) => p.id === phase)!,
    }));
    const tweets = perAccount
      .flatMap((a) => a.phase.top)
      .sort((a, b) => engagement(b) - engagement(a))
      .slice(0, 30);
    const images = perAccount.flatMap((a) => a.phase.images).slice(0, 60);
    const withData = perAccount.filter((a) => a.phase.stats.count > 0);
    const avgOf = (f: (s: (typeof perAccount)[number]["phase"]["stats"]) => number) =>
      withData.length ? Math.round((withData.reduce((s, a) => s + f(a.phase.stats), 0) / withData.length) * 10) / 10 : 0;
    const hashtagMap = new Map<string, number>();
    for (const a of perAccount) for (const h of a.phase.stats.hashtags) hashtagMap.set(h.tag, (hashtagMap.get(h.tag) ?? 0) + h.count);
    return {
      perAccount,
      tweets,
      images,
      summary: {
        postsPerDay: avgOf((s) => s.postsPerDay),
        avgLikes: avgOf((s) => s.avgLikes),
        avgLength: avgOf((s) => s.avgLength),
        mediaRatio: avgOf((s) => s.mediaRatio),
        replyShare: avgOf((s) => (s.count ? Math.round((s.replyCount / s.count) * 100) : 0)),
        hashtags: [...hashtagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
      },
    };
  }, [loaded, phase]);

  const phaseMeta = PHASES.find((p) => p.id === phase)!;

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">X アカウントマーケティング教科書</h1>
            <p className="text-xs text-zinc-500">
              ベンチマークアカウントの投稿を「初日 / アーリー / 後期」の3段階に自動分類して学ぶ
            </p>
          </div>
          <Link href="/" className="text-sm text-sky-600 hover:underline">
            ← トップ
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        {!hasBearer && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <code className="rounded bg-amber-100 px-1">X_BEARER_TOKEN</code> が未設定のためデータを取得できません。Vercel の環境変数に設定して再デプロイしてください。
          </div>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">ベンチマークアカウント</h2>
          <form onSubmit={addAccounts} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="@account1 @account2 ... (スペース/カンマ区切りで複数可)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              disabled={!input.trim()}
            >
              追加
            </button>
          </form>
          <ul className="mt-3 flex flex-wrap gap-2">
            {accounts.length === 0 && <li className="text-sm text-zinc-500">まだ登録されていません</li>}
            {accounts.map((u) => {
              const e = entries[u];
              return (
                <li
                  key={u}
                  className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm"
                  title={e?.error}
                >
                  {e?.data?.user.profile_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.data.user.profile_image_url} alt="" className="h-5 w-5 rounded-full" />
                  )}
                  <span>@{u}</span>
                  {!e && hasBearer && <span className="text-xs text-zinc-400">取得中…</span>}
                  {e?.status === "error" && <span className="text-xs text-red-600">エラー</span>}
                  {e?.status === "ok" && (
                    <span className="text-xs text-zinc-500">
                      {fmt(e.data!.fetchedTweets)}件{e.data!.truncated ? "+" : ""}
                    </span>
                  )}
                  <button onClick={() => reload(u)} className="text-xs text-zinc-400 hover:text-zinc-700" title="再取得">
                    ↻
                  </button>
                  <button onClick={() => remove(u)} className="text-xs text-zinc-400 hover:text-red-600" title="削除">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          {Object.values(entries).some((e) => e.status === "error") && (
            <ul className="mt-2 text-xs text-red-600">
              {Object.values(entries)
                .filter((e) => e.status === "error")
                .map((e) => (
                  <li key={e.username}>
                    @{e.username}: {e.error}
                  </li>
                ))}
            </ul>
          )}
        </section>

        <nav className="grid grid-cols-3 gap-2">
          {PHASES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              className={`rounded-xl border p-4 text-left transition ${
                phase === p.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:border-zinc-400"
              }`}
            >
              <div className="text-xs opacity-70">第{i + 1}章</div>
              <div className="text-base font-semibold">{p.label}</div>
              <div className="text-xs opacity-70">{p.range}</div>
            </button>
          ))}
        </nav>

        {loaded.length > 0 && (
          <>
            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">
                {phaseMeta.label}
                <span className="ml-2 text-sm font-normal text-zinc-500">{phaseMeta.range}</span>
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["投稿/日", current.summary.postsPerDay],
                  ["平均いいね", current.summary.avgLikes],
                  ["平均文字数", current.summary.avgLength],
                  ["画像/動画付き", `${current.summary.mediaRatio}%`],
                  ["リプ比率", `${current.summary.replyShare}%`],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">{label}</div>
                    <div className="text-xl font-semibold">{value}</div>
                  </div>
                ))}
              </div>
              {current.summary.hashtags.length > 0 && (
                <p className="mt-3 text-xs text-zinc-600">
                  よく使うタグ:{" "}
                  {current.summary.hashtags.map(([tag, c]) => (
                    <span key={tag} className="mr-2">
                      #{tag}({c})
                    </span>
                  ))}
                </p>
              )}

              <table className="mt-4 w-full text-left text-xs">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-1">アカウント</th>
                    <th>投稿数</th>
                    <th>投稿/日</th>
                    <th>平均♥</th>
                    <th>平均↻</th>
                    <th>文字数</th>
                    <th>メディア</th>
                    <th>投稿時間(UTC)</th>
                    <th>データ</th>
                  </tr>
                </thead>
                <tbody>
                  {current.perAccount.map((a) => (
                    <tr key={a.user.id} className="border-t border-zinc-100">
                      <td className="py-1.5 font-medium">@{a.user.username}</td>
                      <td>{fmt(a.phase.stats.count)}</td>
                      <td>{a.phase.stats.postsPerDay}</td>
                      <td>{fmt(a.phase.stats.avgLikes)}</td>
                      <td>{fmt(a.phase.stats.avgRetweets)}</td>
                      <td>{a.phase.stats.avgLength}</td>
                      <td>{a.phase.stats.mediaRatio}%</td>
                      <td>{a.phase.stats.bestHours.map((h) => `${h.hour}時`).join(", ")}</td>
                      <td className={a.covered ? "text-emerald-700" : "text-amber-700"}>
                        {a.covered ? "取得済" : "未到達"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {current.perAccount.some((a) => !a.covered) && (
                <p className="mt-2 text-xs text-amber-700">
                  「未到達」= X API のタイムライン取得上限(最新約3,200件)により、この期間まで遡れていません。
                  <code className="mx-1 rounded bg-zinc-100 px-1">?pages=</code>を増やすか、投稿数の少ないアカウントで比較してください。
                </p>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold">参考ツイート（エンゲージメント順）</h2>
              {current.tweets.length === 0 ? (
                <p className="text-sm text-zinc-500">この期間のツイートは取得できませんでした。</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {current.tweets.map((t) => (
                    <TweetCard key={`${t.username}-${t.id}`} t={t} />
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold">使用画像・メディア</h2>
              {current.images.length === 0 ? (
                <p className="text-sm text-zinc-500">この期間のメディアはありません。</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {current.images.map((img, i) => (
                    <a
                      key={`${img.tweetId}-${i}`}
                      href={`https://x.com/${img.username}/status/${img.tweetId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100"
                      title={`@${img.username}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                        @{img.username}
                        {img.type !== "photo" ? ` · ${img.type === "video" ? "動画" : "GIF"}` : ""}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
