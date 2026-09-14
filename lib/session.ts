import { cookies } from "next/headers";
import { env } from "./env";

export const SESSION_COOKIE = "x_session";
export const PKCE_COOKIE = "x_pkce";

export type Session = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

async function key(): Promise<CryptoKey> {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET (or X_CLIENT_SECRET) is not configured");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(env.sessionSecret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  return Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const b = Buffer.from(s, "base64url");
  const out = new Uint8Array(new ArrayBuffer(b.byteLength));
  out.set(b);
  return out;
}

export async function seal(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(JSON.stringify(value)));
  return `${toB64(iv)}.${toB64(ct)}`;
}

export async function unseal<T>(token: string): Promise<T | null> {
  try {
    const [iv, ct] = token.split(".");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await key(), fromB64(ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSession(session: Session) {
  (await cookies()).set(SESSION_COOKIE, await seal(session), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? unseal<Session>(raw) : null;
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setPkce(data: { state: string; verifier: string }) {
  (await cookies()).set(PKCE_COOKIE, await seal(data), { ...cookieOpts, maxAge: 600 });
}

export async function takePkce(): Promise<{ state: string; verifier: string } | null> {
  const store = await cookies();
  const raw = store.get(PKCE_COOKIE)?.value;
  store.delete(PKCE_COOKIE);
  return raw ? unseal(raw) : null;
}
