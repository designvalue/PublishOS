import { NextResponse } from "next/server";
import { isSuperAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { listAccessLogs, maybePrune, type StatusBucket } from "@/lib/access-log";
import { withLogging } from "@/lib/logged-handler";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function _get(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(me.workspaceRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await maybePrune();

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  const before = parseDate(url.searchParams.get("before"));
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const query = url.searchParams.get("q") ?? undefined;

  const statusParam = url.searchParams.get("status");
  const buckets = statusParam
    ? (statusParam.split(",").filter((b) => ["2xx", "3xx", "4xx", "5xx"].includes(b)) as StatusBucket[])
    : undefined;

  const rows = await listAccessLogs({ limit, before, from, to, buckets, query });
  return NextResponse.json({ logs: rows });
}

export const GET = withLogging(_get);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
