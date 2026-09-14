import { XApiError } from "./x";

export function errorResponse(e: unknown): Response {
  if (e instanceof XApiError) {
    return Response.json({ error: "X API request failed", status: e.status, details: e.body }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Unknown error";
  return Response.json({ error: message }, { status: 500 });
}
