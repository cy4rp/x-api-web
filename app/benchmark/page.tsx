import type { Metadata } from "next";
import { configStatus } from "@/lib/env";
import { BenchmarkClient } from "./benchmark-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "X アカウントマーケティング教科書 | X API Web" };

export default function BenchmarkPage() {
  return <BenchmarkClient hasBearer={configStatus().bearerToken} />;
}
