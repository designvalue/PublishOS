import "server-only";
import { and, countDistinct, desc, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accessLogs, files, folders, notifications } from "@/lib/db/schema";

/**
 * "Live status" feed — a rotating ticker on the home page that surfaces
 * honest, useful facts about the workspace instead of placeholder marketing
 * copy. Each call returns a freshly computed array of items; the client
 * rotates through them every few seconds and re-polls periodically.
 *
 * Item kinds are purely a hint for the icon/color; the text is the payload.
 */

export type LiveFeedKind =
  | "files"
  | "storage"
  | "activity"
  | "visitors"
  | "notifications"
  | "today"
  | "welcome";

export type LiveFeedItem = {
  kind: LiveFeedKind;
  text: string;
  /** Optional in-app link the user can click on to drill in. */
  link?: string;
};

const REALTIME_WINDOW_MS = 5 * 60 * 1000;
const TODAY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

/**
 * Compute the live feed for a given user. Filters out facts with no signal
 * (e.g. "0 visitors", "0 unread") so the rotation only surfaces interesting
 * data points.
 */
export async function getLiveFeed(userId: string): Promise<LiveFeedItem[]> {
  const items: LiveFeedItem[] = [];

  // -------------------- File + publish counts --------------------
  const [fileTotals] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      published: sql<number>`SUM(CASE WHEN ${files.publishMode} != 'off' THEN 1 ELSE 0 END)`,
      password: sql<number>`SUM(CASE WHEN ${files.publishMode} = 'password' THEN 1 ELSE 0 END)`,
      bytes: sql<number>`COALESCE(SUM(${files.sizeBytes}), 0)`,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(isNull(files.archivedAt), isNull(folders.archivedAt)));

  const total = Number(fileTotals?.total ?? 0);
  const published = Number(fileTotals?.published ?? 0);
  const password = Number(fileTotals?.password ?? 0);
  const totalBytes = Number(fileTotals?.bytes ?? 0);

  if (total === 0) {
    // Brand-new empty workspace — soft welcome instead of a wall of zeros.
    items.push({
      kind: "welcome",
      text: "Drop your first file to begin — every upload gets a public URL on request.",
    });
    return items;
  }

  if (published > 0) {
    const pwTail =
      password > 0
        ? ` · ${password} password-protected`
        : "";
    items.push({
      kind: "files",
      text: `${published.toLocaleString()} file${published === 1 ? "" : "s"} live${pwTail}`,
      link: "/stats",
    });
  }

  // -------------------- Storage usage --------------------
  if (totalBytes > 0) {
    // Distinct contributors = distinct folder owners with at least one file.
    const [contribRow] = await db
      .select({ c: countDistinct(folders.ownerId) })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .where(and(isNull(files.archivedAt), isNull(folders.archivedAt)));
    const contributors = Number(contribRow?.c ?? 0);
    if (contributors > 0) {
      items.push({
        kind: "storage",
        text: `${formatBytes(totalBytes)} stored by ${contributors} contributor${contributors === 1 ? "" : "s"}`,
        link: "/settings",
      });
    } else {
      items.push({
        kind: "storage",
        text: `${formatBytes(totalBytes)} stored`,
        link: "/settings",
      });
    }
  }

  // -------------------- Last upload --------------------
  const [latest] = await db
    .select({
      name: files.name,
      folderName: folders.name,
      createdAt: files.createdAt,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(isNull(files.archivedAt), isNull(folders.archivedAt)))
    .orderBy(desc(files.createdAt))
    .limit(1);
  if (latest) {
    items.push({
      kind: "activity",
      text: `Last upload: ${latest.name} in ${latest.folderName} · ${relativeTime(latest.createdAt)}`,
    });
  }

  // -------------------- Realtime public visitors --------------------
  const realtimeCutoff = new Date(Date.now() - REALTIME_WINDOW_MS);
  const [realtimeRow] = await db
    .select({ c: countDistinct(accessLogs.ip) })
    .from(accessLogs)
    .where(
      and(
        eq(accessLogs.source, "public"),
        gte(accessLogs.occurredAt, realtimeCutoff),
        // Only successful hits — 4xx/5xx don't count as "viewing".
        sql`${accessLogs.status} < 400`,
      ),
    );
  const realtime = Number(realtimeRow?.c ?? 0);
  if (realtime > 0) {
    items.push({
      kind: "visitors",
      text: `${realtime} ${realtime === 1 ? "person is" : "people are"} viewing public files right now`,
      link: "/stats",
    });
  }

  // -------------------- Today's publishes --------------------
  const todayCutoff = new Date(Date.now() - TODAY_LOOKBACK_MS);
  const [todayRow] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(files)
    .where(
      and(
        isNull(files.archivedAt),
        gte(files.createdAt, todayCutoff),
      ),
    );
  const todayCount = Number(todayRow?.c ?? 0);
  if (todayCount > 0) {
    items.push({
      kind: "today",
      text: `${todayCount} file${todayCount === 1 ? "" : "s"} added in the last 24 hours`,
    });
  }

  // -------------------- Personal unread notifications --------------------
  const [unreadRow] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  const unread = Number(unreadRow?.c ?? 0);
  if (unread > 0) {
    items.push({
      kind: "notifications",
      text: `${unread} unread notification${unread === 1 ? "" : "s"} waiting`,
      link: "/notifications",
    });
  }

  // suppress unused-import lint when SQL branches above happen not to use them
  void ne;
  void or;

  return items;
}
