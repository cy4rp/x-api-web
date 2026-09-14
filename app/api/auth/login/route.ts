import { appUrl, env } from "@/lib/env";
import { authorizeUrl, createPkce } from "@/lib/oauth";
import { setPkce } from "@/lib/session";

export async function GET(request: Request) {
  if (!env.clientId || !env.clientSecret) {
    return Response.json({ error: "X_CLIENT_ID / X_CLIENT_SECRET are not configured" }, { status: 503 });
  }
  const { verifier, challenge, state } = await createPkce();
  await setPkce({ state, verifier });
  return Response.redirect(authorizeUrl(appUrl(request), state, challenge), 302);
}
