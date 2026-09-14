import { configStatus } from "@/lib/env";
import { XClient } from "./x-client";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : null;
  const authMsg = authError
    ? `ログインに失敗しました: ${authError}`
    : params.auth === "ok"
      ? "ログインしました"
      : null;
  return <XClient config={configStatus()} authMsg={authMsg} />;
}
