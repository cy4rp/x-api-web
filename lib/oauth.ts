import { env } from "./env";
import { getSession, setSession, type Session } from "./session";

const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

export function redirectUri(appUrl: string) {
  return `${appUrl}/api/auth/callback`;
}

function randomString(bytes = 32) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

export async function createPkce() {
  const verifier = randomString(48);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = Buffer.from(digest).toString("base64url");
  return { verifier, challenge, state: randomString(16) };
}

export function authorizeUrl(appUrl: string, state: string, challenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.clientId,
    redirect_uri: redirectUri(appUrl),
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

async function tokenRequest(body: URLSearchParams): Promise<Session> {
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
  const t = (await res.json()) as TokenResponse;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
  };
}

export function exchangeCode(code: string, verifier: string, appUrl: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(appUrl),
      client_id: env.clientId,
      code_verifier: verifier,
    }),
  );
}

export async function getValidAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (Date.now() < session.expiresAt - 60_000) return session.accessToken;
  if (!session.refreshToken) return null;
  const refreshed = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: env.clientId,
    }),
  );
  await setSession(refreshed);
  return refreshed.accessToken;
}
