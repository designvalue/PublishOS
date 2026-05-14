import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accessLogs, files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";
import { parseUA } from "@/lib/ua";

/**
 * Per-file analytics for a single published file.
 *
 *   ?window=7|30|90      preset window (default 30)
 *   ?from=ISO&to=ISO     custom date range (overrides window)
 *
 * Owner-only (or Admin / Super Admin) so private files don't leak traffic.
 *
 * Returns the same shape as the workspace rollup, scoped to one file:
 *  - file: metadata
 *  - window: { days, from, to, label }
 *  - totals: visitors, pageViews, bounceRate, realtimeVisitors
 *  - trend: page-view delta vs the previous same-length window
 *  - daily: zero-filled [{ day, pageViews, visitors }]
 *  - statusBuckets
 *  - byBrowser / byOS / byDevice / byCountry: ranked breakdowns
 *  - recent: 25 most recent visit events
 */
async function _get(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Authorize.
  const [row] = await db
    .select({ file: files, ownerId: folders.ownerId, folderName: folders.name })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(eq(files.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== me.id && !isAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Window resolution — same vocabulary as /api/stats/published-files.
  const sp = new URL(req.url).searchParams;
  const now = Date.now();
  const fromParam = sp.get("from");
  const toParam = sp.get("to");

  let fromMs: number;
  let toMs: number;
  let windowDays: number;
  let label: string;

  if (fromParam) {
    const fromDate = new Date(fromParam);
    const toDate = toParam ? new Date(toParam) : new Date(now);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);
    fromMs = fromDate.getTime();
    toMs = toDate.getTime();
    windowDays = Math.max(1, Math.ceil((toMs - fromMs) / (24 * 3600 * 1000)));
    label = "custom";
  } else {
    const raw = Number(sp.get("window") ?? 30);
    windowDays = [7, 30, 90].includes(raw) ? raw : 30;
    toMs = now;
    fromMs = now - windowDays * 24 * 3600 * 1000;
    label = `${windowDays}d`;
  }

  const fromDate = new Date(fromMs);
  const toDate = new Date(toMs);
  const prevFromDate = new Date(fromMs - (toMs - fromMs));

  const fileFilter = and(eq(accessLogs.fileId, id), eq(accessLogs.source, "public"));
  const inWindow = and(
    fileFilter,
    gte(accessLogs.occurredAt, fromDate),
    sql`${accessLogs.occurredAt} <= ${toMs}`,
  );
  const inPrevWindow = and(
    fileFilter,
    gte(accessLogs.occurredAt, prevFromDate),
    sql`${accessLogs.occurredAt} < ${fromMs}`,
  );

  // ---- Counts ----
  const [pv] = await db
    .select({ n: sql<number>`count(*)` })
    .from(accessLogs)
    .where(inWindow);
  const pageViews = Number(pv?.n ?? 0);

  const [pvPrev] = await db
    .select({ n: sql<number>`count(*)` })
    .from(accessLogs)
    .where(inPrevWindow);
  const pageViewsPrev = Number(pvPrev?.n ?? 0);

  const [vs] = await db
    .select({ n: sql<number>`count(distinct ${accessLogs.ip})` })
    .from(accessLogs)
    .where(inWindow);
  const visitors = Number(vs?.n ?? 0);

  // Bounce: sessions = (ip, day), bounce = sessions with exactly 1 hit.
  const sessions = await db
    .select({
      ip: accessLogs.ip,
      day: sql<string>`strftime('%Y-%m-%d', ${accessLogs.occurredAt} / 1000, 'unixepoch')`,
      n: sql<number>`count(*)`,
    })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(accessLogs.ip, sql`strftime('%Y-%m-%d', ${accessLogs.occurredAt} / 1000, 'unixepoch')`);
  const totalSessions = sessions.length;
  const bouncedSessions = sessions.filter((s) => Number(s.n) === 1).length;
  const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

  // Realtime — last 5 minutes.
  const [rt] = await db
    .select({ n: sql<number>`count(distinct ${accessLogs.ip})` })
    .from(accessLogs)
    .where(and(fileFilter, gte(accessLogs.occurredAt, new Date(now - 5 * 60 * 1000))));
  const realtimeVisitors = Number(rt?.n ?? 0);

  // Daily series.
  const dailyRaw = await db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', ${accessLogs.occurredAt} / 1000, 'unixepoch')`,
      pv: sql<number>`count(*)`,
      vs: sql<number>`count(distinct ${accessLogs.ip})`,
    })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(sql`strftime('%Y-%m-%d', ${accessLogs.occurredAt} / 1000, 'unixepoch')`);
  const pvMap = new Map(dailyRaw.map((r) => [r.day, Number(r.pv)]));
  const vsMap = new Map(dailyRaw.map((r) => [r.day, Number(r.vs)]));
  const daily = zeroFilledDaily(fromDate, toDate).map((d) => ({
    day: d,
    pageViews: pvMap.get(d) ?? 0,
    visitors: vsMap.get(d) ?? 0,
  }));

  // Status buckets.
  const statusRows = await db
    .select({
      bucket: sql<string>`(${accessLogs.status} / 100) || 'xx'`,
      n: sql<number>`count(*)`,
    })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(sql`${accessLogs.status} / 100`);
  const statusBuckets = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 } as Record<string, number>;
  for (const r of statusRows) {
    if (r.bucket in statusBuckets) statusBuckets[r.bucket] = Number(r.n);
  }

  // Country breakdown.
  const countryRows = await db
    .select({
      country: sql<string>`coalesce(${accessLogs.country}, 'Unknown')`,
      n: sql<number>`count(*)`,
    })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(sql`coalesce(${accessLogs.country}, 'Unknown')`)
    .orderBy(sql`count(*) desc`)
    .limit(10);
  const byCountry = countryRows.map((r) => ({ key: r.country || "Unknown", count: Number(r.n) }));

  // UA breakdowns — pull (ua, count) groups then bucket in JS.
  const uaGroups = await db
    .select({
      ua: accessLogs.userAgent,
      n: sql<number>`count(*)`,
    })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(accessLogs.userAgent);

  const browserMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  for (const g of uaGroups) {
    const { browser, os, device } = parseUA(g.ua);
    browserMap.set(browser, (browserMap.get(browser) ?? 0) + Number(g.n));
    osMap.set(os, (osMap.get(os) ?? 0) + Number(g.n));
    deviceMap.set(device, (deviceMap.get(device) ?? 0) + Number(g.n));
  }
  const toBreakdown = (m: Map<string, number>): { key: string; count: number }[] =>
    [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  // Recent events.
  const recent = await db
    .select({
      id: accessLogs.id,
      occurredAt: accessLogs.occurredAt,
      status: accessLogs.status,
      ip: accessLogs.ip,
      userAgent: accessLogs.userAgent,
    })
    .from(accessLogs)
    .where(fileFilter)
    .orderBy(desc(accessLogs.occurredAt))
    .limit(25);

  const deltaPct =
    pageViewsPrev === 0
      ? pageViews > 0
        ? null
        : 0
      : ((pageViews - pageViewsPrev) / pageViewsPrev) * 100;

  return NextResponse.json({
    file: {
      id: row.file.id,
      name: row.file.name,
      folderId: row.file.folderId,
      folderName: row.folderName,
      mime: row.file.mime,
      sizeBytes: row.file.sizeBytes,
      publishMode: row.file.publishMode,
      publicSlug: row.file.publicSlug,
    },
    window: {
      days: windowDays,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      label,
    },
    totals: {
      visitors,
      pageViews,
      bounceRate,
      realtimeVisitors,
    },
    trend: { pageViews: { current: pageViews, prev: pageViewsPrev, deltaPct } },
    daily,
    statusBuckets,
    byBrowser: toBreakdown(browserMap),
    byOS: toBreakdown(osMap),
    byDevice: toBreakdown(deviceMap),
    byCountry,
    recent: recent.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt,
      status: r.status,
      ip: r.ip,
      userAgent: r.userAgent,
    })),
  });
}

function zeroFilledDaily(from: Date, to: Date): string[] {
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export const GET = withLogging(_get, { source: "private" });
