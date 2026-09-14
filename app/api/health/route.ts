import { configStatus } from "@/lib/env";

export async function GET() {
  return Response.json({ ok: true, config: configStatus() });
}
