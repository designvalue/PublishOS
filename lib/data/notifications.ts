import "server-only";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";

/**
 * In-app notification feed. Surfaced via the bell in the top bar.
 *
 * Callers should use `notify()` (single user) or `notifyMany()` (broadcast).
 * Failures here never throw to callers — notifications are best-effort
 * side-effects that must not break the primary action that triggered them.
 */

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — matches the UI copy.
const PRUNE_THROTTLE_MS = 60 * 60 * 1000; // run at most once per hour
const PER_USER_CAP = 500; // hard cap; keeps the table bounded even on chatty workspaces

declare global {
  var __notificationsLastPrune: number | undefined;
}

export type NotificationKind = "info" | "success" | "warning" | "danger";

export type NotificationRow = typeof notifications.$inferSelect;

export type NotificationCreate = {
  userId: string;
  kind?: NotificationKind;
  event: string;
  title: string;
  body?: string | null;
  link?: string | null;
  data?: Record<string, unknown> | null;
};

/** Insert a single notification. Never throws. */
export async function notify(input: NotificationCreate): Promise<NotificationRow | null> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        kind: input.kind ?? "info",
        event: input.event,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        data: input.data ? JSON.stringify(input.data) : null,
      })
      .returning();
    // Opportunistic per-user cap + global retention sweep. Both are best-effort.
    void enforcePerUserCap(input.userId);
    void maybePruneNotifications();
    return row ?? null;
  } catch (err) {
    console.warn("[notify] failed", err);
    return null;
  }
}

/**
 * Delete notifications older than the retention window. Throttled so we don't
 * pay the cost on every write — once per hour per process is plenty.
 *
 * Mirrors the `maybePrune` pattern from `lib/access-log.ts`.
 */
export async function maybePruneNotifications(): Promise<number> {
  const last = globalThis.__notificationsLastPrune ?? 0;
  if (Date.now() - last < PRUNE_THROTTLE_MS) return 0;
  globalThis.__notificationsLastPrune = Date.now();
  try {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    await db.delete(notifications).where(lt(notifications.createdAt, cutoff));
    return 0;
  } catch (err) {
    console.warn("[notifications] prune failed", err);
    return 0;
  }
}

/**
 * Enforce a hard per-user cap so a single noisy account can't fill the table.
 * When over the cap, deletes the oldest rows past the cap. Best-effort.
 */
async function enforcePerUserCap(userId: string): Promise<void> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    const total = row?.c ?? 0;
    if (total <= PER_USER_CAP) return;

    // Find the cutoff createdAt = the createdAt of the row at position `PER_USER_CAP`
    // when ordered desc. Anything strictly older than that goes.
    const offsetRows = await db
      .select({ createdAt: notifications.createdAt })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(1)
      .offset(PER_USER_CAP - 1);
    const cutoff = offsetRows[0]?.createdAt;
    if (!cutoff) return;

    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), lt(notifications.createdAt, cutoff)));
  } catch (err) {
    console.warn("[notifications] enforcePerUserCap failed", err);
  }
}

/**
 * Insert the same notification for every user matching a workspace-role
 * predicate. Used for admin/super-admin broadcasts.
 */
export async function notifyByRole(
  roles: Array<"owner" | "admin" | "editor" | "viewer">,
  input: Omit<NotificationCreate, "userId">,
): Promise<number> {
  if (roles.length === 0) return 0;
  try {
    const targets = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.workspaceRole, roles));
    if (targets.length === 0) return 0;
    await db.insert(notifications).values(
      targets.map((t) => ({
        userId: t.id,
        kind: input.kind ?? "info",
        event: input.event,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        data: input.data ? JSON.stringify(input.data) : null,
      })),
    );
    void maybePruneNotifications();
    return targets.length;
  } catch (err) {
    console.warn("[notifyByRole] failed", err);
    return 0;
  }
}

/** Insert one notification per user id. */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotificationCreate, "userId">,
): Promise<number> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return 0;
  try {
    await db.insert(notifications).values(
      unique.map((userId) => ({
        userId,
        kind: input.kind ?? "info",
        event: input.event,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        data: input.data ? JSON.stringify(input.data) : null,
      })),
    );
    void maybePruneNotifications();
    return unique.length;
  } catch (err) {
    console.warn("[notifyMany] failed", err);
    return 0;
  }
}

export type NotificationListItem = Omit<NotificationRow, "data"> & {
  data: Record<string, unknown> | null;
};
export type NotificationListResult = {
  items: NotificationListItem[];
  unread: number;
  total: number;
};

/** Page-style list for the bell drawer. */
export async function listNotifications(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<NotificationListResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const where = opts.before
    ? and(eq(notifications.userId, userId), lt(notifications.createdAt, opts.before))
    : eq(notifications.userId, userId);

  const [rows, unreadRow, totalRow] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ c: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db
      .select({ c: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
  ]);

  return {
    items: rows.map((r) => ({
      ...r,
      data: r.data ? safeParse(r.data) : null,
    })),
    unread: unreadRow[0]?.c ?? 0,
    total: totalRow[0]?.c ?? 0,
  };
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Just the unread count — used by polling clients. */
export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.c ?? 0;
}

/** Mark one notification as read. Returns true if the row belonged to the user. */
export async function markRead(userId: string, id: string): Promise<boolean> {
  const res = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return res.length > 0;
}

/** Mark every unread notification as read for this user. Returns count touched. */
export async function markAllRead(userId: string): Promise<number> {
  const res = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return res.length;
}

/** Delete one notification (dismiss). */
export async function dismissNotification(userId: string, id: string): Promise<boolean> {
  const res = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return res.length > 0;
}

/** Delete every notification for a user. */
export async function clearAll(userId: string): Promise<number> {
  const res = await db
    .delete(notifications)
    .where(eq(notifications.userId, userId))
    .returning({ id: notifications.id });
  return res.length;
}
