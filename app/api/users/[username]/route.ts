import { errorResponse } from "@/lib/api";
import { getUserByUsername, getUserTweets } from "@/lib/x";

export async function GET(request: Request, { params }: RouteContext<"/api/users/[username]">) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const withTweets = searchParams.get("tweets") !== "0";
  try {
    const user = await getUserByUsername(username.replace(/^@/, ""));
    if (!user.data) return Response.json({ error: "User not found" }, { status: 404 });
    const tweets = withTweets ? await getUserTweets(user.data.id, Number(searchParams.get("max") ?? 20)) : undefined;
    return Response.json({ user: user.data, tweets: tweets?.data ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
