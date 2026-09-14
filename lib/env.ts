export const env = {
  bearerToken: process.env.X_BEARER_TOKEN ?? "",
  clientId: process.env.X_CLIENT_ID ?? "",
  clientSecret: process.env.X_CLIENT_SECRET ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.X_CLIENT_SECRET ?? "",
};

export function appUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function configStatus() {
  return {
    bearerToken: Boolean(env.bearerToken),
    oauth: Boolean(env.clientId && env.clientSecret),
    sessionSecret: Boolean(env.sessionSecret),
  };
}
