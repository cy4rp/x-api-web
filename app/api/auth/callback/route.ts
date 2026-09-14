import { appUrl } from "@/lib/env";
import { exchangeCode } from "@/lib/oauth";
import { setSession, takePkce } from "@/lib/session";

export async function GET(request: Request) {
  const base = appUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const pkce = await takePkce();

  if (error) return Response.redirect(`${base}/?auth_error=${encodeURIComponent(error)}`, 302);
  if (!code || !state || !pkce || pkce.state !== state) {
    return Response.redirect(`${base}/?auth_error=invalid_state`, 302);
  }
  try {
    await setSession(await exchangeCode(code, pkce.verifier, base));
    return Response.redirect(`${base}/?auth=ok`, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : "token_exchange_failed";
    return Response.redirect(`${base}/?auth_error=${encodeURIComponent(message)}`, 302);
  }
}
