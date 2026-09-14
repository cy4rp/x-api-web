import { errorResponse } from "@/lib/api";
import { getValidAccessToken } from "@/lib/oauth";
import { getMe } from "@/lib/x";

export async function GET() {
  try {
    const token = await getValidAccessToken();
    if (!token) return Response.json({ user: null });
    const me = await getMe(token);
    return Response.json({ user: me.data ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
