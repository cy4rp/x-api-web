import type { Media, Tweet, XUser } from "./x";

export type PhaseId = "day1" | "early" | "late";

export const PHASES: { id: PhaseId; label: string; range: string }[] = [
  { id: "day1", label: "初日", range: "アカウント作成から24時間" },
  { id: "early", label: "アーリー段階", range: "2日目〜3ヶ月" },
  { id: "late", label: "後期段階", range: "4ヶ月目以降" },
];

const DAY = 24 * 60 * 60 * 1000;
const EARLY_END = 90 * DAY;

export function classify(userCreatedAt: string, tweetCreatedAt: string): PhaseId {
  const age = new Date(tweetCreatedAt).getTime() - new Date(userCreatedAt).getTime();
  if (age < DAY) return "day1";
  if (age < EARLY_END) return "early";
  return "late";
}

export type BenchmarkTweet = Tweet & {
  username: string;
  author_name: string;
  ageDays: number;
  kind: "post" | "reply" | "retweet" | "quote";
  media: Media[];
};

export type PhaseStats = {
  count: number;
  originalCount: number;
  replyCount: number;
  retweetCount: number;
  spanDays: number;
  postsPerDay: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgLength: number;
  mediaRatio: number;
  hashtags: { tag: string; count: number }[];
  bestHours: { hour: number; count: number }[];
};

export type PhaseData = {
  id: PhaseId;
  stats: PhaseStats;
  top: BenchmarkTweet[];
  images: { url: string; tweetId: string; username: string; type: Media["type"] }[];
};

export type BenchmarkResult = {
  user: XUser;
  fetchedTweets: number;
  truncated: boolean;
  oldestFetched: string | null;
  coverage: Record<PhaseId, boolean>;
  phases: PhaseData[];
};

function kindOf(t: Tweet): BenchmarkTweet["kind"] {
  const ref = t.referenced_tweets?.[0]?.type;
  if (ref === "retweeted") return "retweet";
  if (ref === "replied_to") return "reply";
  if (ref === "quoted") return "quote";
  return "post";
}

export function engagement(t: Tweet) {
  const m = t.public_metrics;
  return m ? m.like_count + m.retweet_count * 2 + m.reply_count + m.quote_count * 2 : 0;
}

export function enrich(user: XUser, tweets: Tweet[], media: Media[]): BenchmarkTweet[] {
  const byKey = new Map(media.map((m) => [m.media_key, m]));
  return tweets
    .filter((t) => t.created_at)
    .map((t) => ({
      ...t,
      username: user.username,
      author_name: user.name,
      ageDays: user.created_at
        ? Math.floor((new Date(t.created_at!).getTime() - new Date(user.created_at).getTime()) / DAY)
        : 0,
      kind: kindOf(t),
      media: (t.attachments?.media_keys ?? []).map((k) => byKey.get(k)).filter((m): m is Media => Boolean(m)),
    }));
}

function avg(nums: number[]) {
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
}

export function phaseStats(tweets: BenchmarkTweet[]): PhaseStats {
  const original = tweets.filter((t) => t.kind === "post" || t.kind === "quote");
  const times = tweets.map((t) => new Date(t.created_at!).getTime());
  const spanDays = times.length > 1 ? Math.max(1, (Math.max(...times) - Math.min(...times)) / DAY) : 1;
  const tags = new Map<string, number>();
  const hours = new Map<number, number>();
  for (const t of tweets) {
    for (const h of t.entities?.hashtags ?? []) tags.set(h.tag, (tags.get(h.tag) ?? 0) + 1);
    const hour = new Date(t.created_at!).getUTCHours();
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  return {
    count: tweets.length,
    originalCount: original.length,
    replyCount: tweets.filter((t) => t.kind === "reply").length,
    retweetCount: tweets.filter((t) => t.kind === "retweet").length,
    spanDays: Math.round(spanDays),
    postsPerDay: Math.round((tweets.length / spanDays) * 10) / 10,
    avgLikes: avg(original.map((t) => t.public_metrics?.like_count ?? 0)),
    avgRetweets: avg(original.map((t) => t.public_metrics?.retweet_count ?? 0)),
    avgReplies: avg(original.map((t) => t.public_metrics?.reply_count ?? 0)),
    avgLength: avg(original.map((t) => t.text.length)),
    mediaRatio: original.length
      ? Math.round((original.filter((t) => t.media.length > 0).length / original.length) * 100)
      : 0,
    hashtags: [...tags.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    bestHours: [...hours.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
  };
}

export function buildPhases(tweets: BenchmarkTweet[], userCreatedAt: string, topN = 10): PhaseData[] {
  return PHASES.map(({ id }) => {
    const inPhase = tweets.filter((t) => classify(userCreatedAt, t.created_at!) === id);
    const original = inPhase.filter((t) => t.kind !== "retweet");
    return {
      id,
      stats: phaseStats(inPhase),
      top: [...original].sort((a, b) => engagement(b) - engagement(a)).slice(0, topN),
      images: original.flatMap((t) =>
        t.media
          .map((m) => ({ url: m.url ?? m.preview_image_url ?? "", tweetId: t.id, username: t.username, type: m.type }))
          .filter((m) => m.url),
      ),
    };
  });
}

export function buildBenchmark(user: XUser, tweets: Tweet[], media: Media[], truncated: boolean): BenchmarkResult {
  const enriched = enrich(user, tweets, media);
  const oldest = enriched.reduce<string | null>(
    (acc, t) => (!acc || t.created_at! < acc ? t.created_at! : acc),
    null,
  );
  const createdAt = user.created_at ?? oldest ?? new Date().toISOString();
  const reachedDay1 = oldest ? classify(createdAt, oldest) === "day1" : false;
  const reachedEarly = oldest ? classify(createdAt, oldest) !== "late" : false;
  return {
    user,
    fetchedTweets: enriched.length,
    truncated,
    oldestFetched: oldest,
    coverage: { day1: reachedDay1, early: reachedEarly, late: true },
    phases: buildPhases(enriched, createdAt),
  };
}
