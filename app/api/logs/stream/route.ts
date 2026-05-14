import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { accessLogEvents, type AccessLogRow } from "@/lib/access-log";

export async function GET(req: Request) {
  const me = await requireSessionUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          /* stream closed */
        }
      };

      // Initial hello so the client knows the stream is open.
      send(`: connected\n\n`);

      const onLog = (row: AccessLogRow) => {
        send(`event: log\ndata: ${JSON.stringify(row)}\n\n`);
      };
      accessLogEvents.on("log", onLog);

      // Keep-alive ping every 25s (defeats proxies that close idle connections).
      const ping = setInterval(() => send(`: ping\n\n`), 25_000);

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        accessLogEvents.off("log", onLog);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
