import "server-only";
import { EventEmitter } from "node:events";
import { and, desc, eq, gt, gte, inArray, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { accessLogs, files, folders, users } from "@/lib/db/schema";

export type AccessLogRow = typeof accessLogs.$inferSelect;
export type EnrichedAccessLog = AccessLogRow & {
  userName: string | null;
  userEmail: string | null;
  fileName: string | null;
  folderName: string | null;
  folderSlug: string | null;
};
export type AccessLogInput = {
  method: string;
  path: string;
  status: number;
  durationMs?: number;
  bytes?: number;
  ip?: string | null;
  country?: string | null;
  userAgent?: string | null;
  fileId?: string | null;
  folderId?: string | null;
  userId?: string | null;
  source?: "api" | "private" | "public";
};

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PRUNE_THROTTLE_MS = 60 * 60 * 1000; // run at most once per hour

// Stash the EventEmitter on globalThis so HMR / multiple module-graph copies
// share the same instance during development.
declare global {
  var __accessLogEvents: EventEmitter | undefined;
  var __accessLogLastPrune: number | undefined;
}

export const accessLogEvents: EventEmitter =
  globalThis.__accessLogEvents ?? (globalThis.__accessLogEvents = new EventEmitter().setMaxListeners(100));

export async function logAccess(input: AccessLogInput): Promise<AccessLogRow> {
  const [row] = await db
    .insert(accessLogs)
    .values({
      method: input.method,
      path: input.path,
      status: input.status,
      durationMs: input.durationMs ?? 0,
      bytes: input.bytes ?? 0,
      ip: input.ip ?? null,
      country: input.country ?? null,
      userAgent: input.userAgent ?? null,
      fileId: input.fileId ?? null,
      folderId: input.folderId ?? null,
      userId: input.userId ?? null,
      source: input.source ?? "api",
    })
    .returning();

  // Resolve linked names so the SSE feed carries the same context as the table.
  void enrichAndEmit(row);
  void maybePrune();
  return row;
}

async function enrichAndEmit(row: AccessLogRow): Promise<void> {
  try {
    let userName: string | null = null;
    let userEmail: string | null = null;
    let fileName: string | null = null;
    let folderName: string | null = null;
    let folderSlug: string | null = null;

    if (row.userId) {
      const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, row.userId)).limit(1);
      if (u) { userName = u.name; userEmail = u.email; }
    }
    if (row.fileId) {
      const [f] = await db.select({ name: files.name }).from(files).where(eq(files.id, row.fileId)).limit(1);
      if (f) fileName = f.name;
    }
    if (row.folderId) {
      const [f] = await db.select({ name: folders.name, slug: folders.slug }).from(folders).where(eq(folders.id, row.folderId)).limit(1);
      if (f) { folderName = f.name; folderSlug = f.slug; }
    }

    const enriched: EnrichedAccessLog = { ...row, userName, userEmail, fileName, folderName, folderSlug };
    accessLogEvents.emit("log", enriched);
  } catch (err) {
    console.error("enrichAndEmit failed:", err);
    accessLogEvents.emit("log", row);
  }
}

/** Removes rows older than the 90-day retention window. Throttled to once per hour. */
export async function maybePrune(): Promise<number> {
  const last = globalThis.__accessLogLastPrune ?? 0;
  if (Date.now() - last < PRUNE_THROTTLE_MS) return 0;
  globalThis.__accessLogLastPrune = Date.now();

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const deleted = await db.delete(accessLogs).where(lt(accessLogs.occurredAt, cutoff));
  // better-sqlite3 reports rowsAffected via `changes` on the raw statement; Drizzle
  // wraps it inconsistently across versions. We don't depend on the return value.
  return deleted ? 0 : 0;
}

export type StatusBucket = "2xx" | "3xx" | "4xx" | "5xx";

const STATUS_RANGES: Record<StatusBucket, [number, number]> = {
  "2xx": [200, 299],
  "3xx": [300, 399],
  "4xx": [400, 499],
  "5xx": [500, 599],
};

export async function listAccessLogs(opts: {
  limit?: number;
  before?: Date;
  from?: Date;
  to?: Date;
  buckets?: StatusBucket[];
  query?: string;
} = {}): Promise<EnrichedAccessLog[]> {
  const conds: SQL[] = [];
  if (opts.before) conds.push(lt(accessLogs.occurredAt, opts.before));
  if (opts.from) conds.push(gte(accessLogs.occurredAt, opts.from));
  if (opts.to) conds.push(lte(accessLogs.occurredAt, opts.to));
  if (opts.buckets && opts.buckets.length > 0) {
    const allowed: number[] = [];
    for (const b of opts.buckets) {
      const [lo, hi] = STATUS_RANGES[b];
      for (let n = lo; n <= hi; n++) allowed.push(n);
    }
    conds.push(inArray(accessLogs.status, allowed));
  }
  if (opts.query && opts.query.trim().length > 0) {
    const pattern = `%${opts.query.trim().replace(/[%_]/g, "\\$&")}%`;
    const qExpr = or(
      like(accessLogs.path, pattern),
      like(accessLogs.ip, pattern),
      like(accessLogs.userAgent, pattern),
      like(accessLogs.method, pattern),
      like(users.name, pattern),
      like(users.email, pattern),
      like(files.name, pattern),
      like(folders.name, pattern),
      like(folders.slug, pattern),
    );
    if (qExpr) conds.push(qExpr);
  }
  const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      log: accessLogs,
      userName: users.name,
      userEmail: users.email,
      fileName: files.name,
      folderName: folders.name,
      folderSlug: folders.slug,
    })
    .from(accessLogs)
    .leftJoin(users, eq(users.id, accessLogs.userId))
    .leftJoin(files, eq(files.id, accessLogs.fileId))
    .leftJoin(folders, eq(folders.id, accessLogs.folderId))
    .where(where as never)
    .orderBy(desc(accessLogs.occurredAt))
    .limit(opts.limit ?? 100);

  return rows.map((r) => ({
    ...r.log,
    userName: r.userName,
    userEmail: r.userEmail,
    fileName: r.fileName,
    folderName: r.folderName,
    folderSlug: r.folderSlug,
  }));
}

export async function getRequestsLastMinute(): Promise<number> {
  const since = new Date(Date.now() - 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(accessLogs)
    .where(gt(accessLogs.occurredAt, since));
  return Number(row?.n ?? 0);
}
