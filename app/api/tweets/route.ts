import { errorResponse } from "@/lib/api";
import { getValidAccessToken } from "@/lib/oauth";
import { postTweet } from "@/lib/x";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  if (text.length > 280) return Response.json({ error: "text exceeds 280 characters" }, { status: 400 });
  try {
    const token = await getValidAccessToken();
    if (!token) return Response.json({ error: "Not logged in" }, { status: 401 });
    return Response.json(await postTweet(token, text), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
