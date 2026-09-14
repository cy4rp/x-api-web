import { errorResponse } from "@/lib/api";
import { searchRecent } from "@/lib/x";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "q is required" }, { status: 400 });
  const max = Number(searchParams.get("max") ?? 20);
  const nextToken = searchParams.get("next_token") ?? undefined;
  try {
    return Response.json(await searchRecent(q, max, nextToken));
  } catch (e) {
    return errorResponse(e);
  }
}
