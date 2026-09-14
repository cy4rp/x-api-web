import { env } from "./env";

const API = "https://api.x.com/2";

export class XApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`X API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function xFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new XApiError(res.status, body);
  return body as T;
}

const TWEET_FIELDS = "created_at,public_metrics,author_id,lang";
const USER_FIELDS = "profile_image_url,description,public_metrics,verified,created_at";

export type Tweet = {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  lang?: string;
  public_metrics?: { retweet_count: number; reply_count: number; like_count: number; quote_count: number };
};

export type XUser = {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  verified?: boolean;
  created_at?: string;
  public_metrics?: { followers_count: number; following_count: number; tweet_count: number };
};

export type SearchResponse = {
  data?: Tweet[];
  includes?: { users?: XUser[] };
  meta?: { result_count: number; next_token?: string };
};

function requireBearer(): string {
  if (!env.bearerToken) throw new XApiError(503, { error: "X_BEARER_TOKEN is not configured" });
  return env.bearerToken;
}

export function searchRecent(query: string, maxResults = 20, nextToken?: string) {
  const params = new URLSearchParams({
    query,
    max_results: String(Math.min(Math.max(maxResults, 10), 100)),
    "tweet.fields": TWEET_FIELDS,
    expansions: "author_id",
    "user.fields": USER_FIELDS,
  });
  if (nextToken) params.set("next_token", nextToken);
  return xFetch<SearchResponse>(`/tweets/search/recent?${params}`, requireBearer());
}

export function getUserByUsername(username: string) {
  const params = new URLSearchParams({ "user.fields": USER_FIELDS });
  return xFetch<{ data?: XUser }>(`/users/by/username/${encodeURIComponent(username)}?${params}`, requireBearer());
}

export function getUserTweets(userId: string, maxResults = 20) {
  const params = new URLSearchParams({
    max_results: String(Math.min(Math.max(maxResults, 5), 100)),
    "tweet.fields": TWEET_FIELDS,
  });
  return xFetch<SearchResponse>(`/users/${userId}/tweets?${params}`, requireBearer());
}

export function getMe(accessToken: string) {
  const params = new URLSearchParams({ "user.fields": USER_FIELDS });
  return xFetch<{ data?: XUser }>(`/users/me?${params}`, accessToken);
}

export function postTweet(accessToken: string, text: string) {
  return xFetch<{ data?: { id: string; text: string } }>("/tweets", accessToken, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
