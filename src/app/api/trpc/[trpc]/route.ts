import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") || "";
  // Next can normalize req.url to localhost even when the browser used 127.0.0.1.
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host) || (origin && origin !== `http://${host}`)) return new Response("Origin rejected", { status: 403 });
  return fetchRequestHandler({ endpoint: "/api/trpc", req, router: appRouter, createContext: () => ({}) });
}
