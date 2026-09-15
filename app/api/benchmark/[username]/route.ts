import { errorResponse } from "@/lib/api";
import { buildBenchmark } from "@/lib/benchmark";
import { getAllUserTweets, getUserByUsername } from "@/lib/x";

const MAX_PAGES = Number(process.env.BENCHMARK_MAX_PAGES ?? 8);

export async function GET(request: Request, { params }: RouteContext<"/api/benchmark/[username]">) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const pages = Math.min(Math.max(Number(searchParams.get("pages") ?? MAX_PAGES), 1), 32);
  try {
    const user = await getUserByUsername(username.replace(/^@/, ""));
    if (!user.data) return Response.json({ error: "User not found" }, { status: 404 });
    const { tweets, media, truncated } = await getAllUserTweets(user.data.id, pages);
    return Response.json(buildBenchmark(user.data, tweets, media, truncated), {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
