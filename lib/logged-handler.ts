import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAccess } from "@/lib/access-log";

export type LogOpts = {
  source?: "api" | "private" | "public";
};

const SKIP_PATHS = ["/api/logs/stream"];

function clientInfo(req: Request) {
  const ua = req.headers.get("user-agent") ?? null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const country =
    req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
  return { ua, ip, country };
}

/**
 * Wrap a Next.js route handler so every invocation is appended to access_logs.
 * Logging never blocks the response; failures are swallowed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withLogging<H extends (...args: any[]) => Promise<Response> | Response>(
  handler: H,
  opts: LogOpts = {},
): H {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = async (...args: any[]) => {
    const req = args[0] as Request;
    const started = Date.now();
    let response: Response;

    try {
      response = await handler(...args);
    } catch (err) {
      console.error("withLogging caught error in handler:", err);
      response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
      void recordAccess(req, response, started, opts.source);
      // Do not rethrow: Next would replace this JSON with an HTML error page,
      // which breaks Auth.js clients that expect JSON from `/api/auth/*`.
      return response;
    }

    void recordAccess(req, response, started, opts.source);
    return response;
  };

  return wrapped as H;
}

async function recordAccess(req: Request, response: Response, started: number, source?: LogOpts["source"]) {
  try {
    const url = new URL(req.url);
    if (SKIP_PATHS.some((p) => url.pathname.startsWith(p))) return;

    const { ua, ip, country } = clientInfo(req);
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id ?? null;
    } catch {
      /* unauthenticated routes — leave userId null */
    }

    const bytes = Number(response.headers.get("content-length") ?? 0);
    await logAccess({
      method: req.method,
      path: url.pathname + (url.search || ""),
      status: response.status,
      durationMs: Date.now() - started,
      bytes: Number.isFinite(bytes) ? bytes : 0,
      ip,
      country,
      userAgent: ua,
      userId,
      source: source ?? "api",
    });
  } catch (err) {
    console.error("recordAccess failed:", err);
  }
}
