import { NextResponse } from "next/server";
import { and, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accessLogs, files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";
import { parseUA } from "@/lib/ua";

/**
 * Workspace-wide analytics rollup across the chosen window.
 *
 *   ?window=7|30|90      preset window (default 30)
 *   ?from=ISO&to=ISO     custom date range (overrides window)
 *
 * Owner-scoped by default; Admin/Super Admin see every file in the workspace.
 *
 * Returns:
 *  - window: { days, from, to, label }
 *  - totals: { visitors, pageViews, bounceRate, files, byMode, realtimeVisitors }
 *  - trend: { pageViews: { current, prev, deltaPct } }
 *  - daily: [{ day, pageViews, visitors }, ...] (zero-filled)
 *  - statusBuckets: { '2xx', '3xx', '4xx', '5xx' }
 *  - byBrowser / byOS / byDevice / byCountry: [{ key, count }, ...]
 *  - topFiles: [...top 5 by visits...]
 *  - files: [...full list with visit count for the window...]
 */
async function _get(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const seeAll = isAdmin(me.workspaceRole);
  const params = new URL(req.url).searchParams;

  const now = Date.now();
  const fromParam = params.get("from");
  const toParam = params.get("to");

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
    // Snap from to UTC midnight, to to end of UTC day so the inclusive range
    // matches calendar days the user picked.
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);
    fromMs = fromDate.getTime();
    toMs = toDate.getTime();
    windowDays = Math.max(1, Math.ceil((toMs - fromMs) / (24 * 3600 * 1000)));
    label = "custom";
  } else {
    const rawWindow = Number(params.get("window") ?? 30);
    windowDays = [7, 30, 90].includes(rawWindow) ? rawWindow : 30;
    toMs = now;
    fromMs = now - windowDays * 24 * 3600 * 1000;
    label = `${windowDays}d`;
  }

  const fromDate = new Date(fromMs);
  const toDate = new Date(toMs);
  const prevFromDate = new Date(fromMs - (toMs - fromMs));

  // ---- Files the caller can see ---------------------------------------------
  const fileRows = await db
    .select({
      id: files.id,
      name: files.name,
      folderId: files.folderId,
      folderName: folders.name,
      mime: files.mime,
      sizeBytes: files.sizeBytes,
      publishMode: files.publishMode,
      publicSlug: files.publicSlug,
      ownerId: folders.ownerId,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(
      and(
        ne(files.publishMode, "off"),
        isNull(files.archivedAt),
        isNull(folders.archivedAt),
        seeAll ? undefined : eq(folders.ownerId, me.id),
      ),
    );

  if (fileRows.length === 0) {
    return NextResponse.json(emptyPayload({ fromDate, toDate, windowDays, label }));
  }

  const fileIds = fileRows.map((r) => r.id);
  const baseFilter = and(
    eq(accessLogs.source, "public"),
    inArray(accessLogs.fileId, fileIds),
  );
  const inWindow = and(
    baseFilter,
    gte(accessLogs.occurredAt, fromDate),
    sql`${accessLogs.occurredAt} <= ${toMs}`,
  );
  const inPrevWindow = and(
    baseFilter,
    gte(accessLogs.occurredAt, prevFromDate),
    sql`${accessLogs.occurredAt} < ${fromMs}`,
  );

  // ---- Page views (count) + Visitors (distinct IP) --------------------------
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

  // ---- Bounce rate: visitors (by ip+day) who only had 1 page view -----------
  // A "session" = (ip, day). Bounce = sessions with exactly 1 view / total sessions.
  const sessionRows = await db
    .select({
      ip: accessLogs.ip,
      day: sql<string>`strftime('%Y-%m-%d', ${accessLogs.occurredAt} / 1000, 'unixepoch')`,
      n: sql<number>`count(*)`,
    })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(accessLogs.ip, sql`strftime('%Y-%m-%d', ${accessLogs.occurredAt} / 1000, 'unixepoch')`);
  const totalSessions = sessionRows.length;
  const bouncedSessions = sessionRows.filter((r) => Number(r.n) === 1).length;
  const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

  // ---- Realtime: visits in the last 5 minutes -------------------------------
  const [rt] = await db
    .select({ n: sql<number>`count(distinct ${accessLogs.ip})` })
    .from(accessLogs)
    .where(and(baseFilter, gte(accessLogs.occurredAt, new Date(now - 5 * 60 * 1000))));
  const realtimeVisitors = Number(rt?.n ?? 0);

  // ---- Daily series (page views + visitors per day) -------------------------
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

  // ---- Status buckets -------------------------------------------------------
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

  // ---- Per-file visit counts ------------------------------------------------
  const fileCounts = await db
    .select({ fileId: accessLogs.fileId, n: sql<number>`count(*)` })
    .from(accessLogs)
    .where(inWindow)
    .groupBy(accessLogs.fileId);
  const fileCountMap = new Map(fileCounts.map((r) => [r.fileId, Number(r.n)]));

  // ---- Country breakdown (server-side groupby; many rows have NULL) ---------
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

  // ---- Browser / OS / Device — parse UA in app code -------------------------
  // Pull just (user_agent, count) groups, then bucket in JS.
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

  // ---- Enriched file list + top files ---------------------------------------
  const enriched = fileRows
    .map((r) => ({ ...r, visits: fileCountMap.get(r.id) ?? 0 }))
    .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));

  const byMode = enriched.reduce(
    (acc, r) => {
      if (r.publishMode === "public") acc.public += 1;
      else if (r.publishMode === "password") acc.password += 1;
      return acc;
    },
    { public: 0, password: 0 },
  );

  const deltaPct =
    pageViewsPrev === 0
      ? pageViews > 0
        ? null
        : 0
      : ((pageViews - pageViewsPrev) / pageViewsPrev) * 100;

  return NextResponse.json({
    window: {
      days: windowDays,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      label,
    },
    totals: {
      visitors,
      pageViews,
      bounceRate, // percent (0–100)
      files: enriched.length,
      byMode,
      realtimeVisitors,
    },
    trend: {
      pageViews: {
        current: pageViews,
        prev: pageViewsPrev,
        deltaPct, // null means "no previous baseline"
      },
    },
    daily,
    statusBuckets,
    byBrowser: toBreakdown(browserMap),
    byOS: toBreakdown(osMap),
    byDevice: toBreakdown(deviceMap),
    byCountry,
    topFiles: enriched.slice(0, 5).map((f) => ({
      id: f.id,
      name: f.name,
      folderId: f.folderId,
      folderName: f.folderName,
      visits: f.visits,
      publishMode: f.publishMode,
    })),
    files: enriched,
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

function emptyPayload(w: { fromDate: Date; toDate: Date; windowDays: number; label: string }) {
  return {
    window: {
      days: w.windowDays,
      from: w.fromDate.toISOString(),
      to: w.toDate.toISOString(),
      label: w.label,
    },
    totals: { visitors: 0, pageViews: 0, bounceRate: 0, files: 0, byMode: { public: 0, password: 0 }, realtimeVisitors: 0 },
    trend: { pageViews: { current: 0, prev: 0, deltaPct: 0 } },
    daily: zeroFilledDaily(w.fromDate, w.toDate).map((d) => ({ day: d, pageViews: 0, visitors: 0 })),
    statusBuckets: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
    byBrowser: [],
    byOS: [],
    byDevice: [],
    byCountry: [],
    topFiles: [],
    files: [],
  };
}

export const GET = withLogging(_get, { source: "private" });
