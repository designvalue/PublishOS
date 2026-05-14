import "server-only";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, folders, folderMembers } from "@/lib/db/schema";

export type UserRow = typeof users.$inferSelect;
export type WorkspaceRole = UserRow["workspaceRole"];

export type UserListEntry = {
  id: string;
  name: string | null;
  email: string;
  workspaceRole: WorkspaceRole;
  lastActiveAt: Date | null;
  createdAt: Date;
  mustChangePassword: boolean;
  folderCount: number;
};

export async function listAllUsers(): Promise<UserListEntry[]> {
  // Three small queries instead of a correlated subquery — correlated SQL
  // templates were silently resolving to 0 across all users in dev, so we
  // do the aggregation explicitly and join in memory.
  const [userRows, ownedRows, memberRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        workspaceRole: users.workspaceRole,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    db
      .select({
        ownerId: folders.ownerId,
        n: sql<number>`count(*)`,
      })
      .from(folders)
      .where(isNull(folders.archivedAt))
      .groupBy(folders.ownerId),
    db
      .select({
        userId: folderMembers.userId,
        n: sql<number>`count(*)`,
      })
      .from(folderMembers)
      .groupBy(folderMembers.userId),
  ]);

  const ownedBy = new Map(ownedRows.map((r) => [r.ownerId, Number(r.n)]));
  const memberOf = new Map(memberRows.map((r) => [r.userId, Number(r.n)]));

  return userRows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    workspaceRole: r.workspaceRole,
    lastActiveAt: r.lastActiveAt,
    createdAt: r.createdAt,
    mustChangePassword: r.mustChangePassword,
    folderCount: (ownedBy.get(r.id) ?? 0) + (memberOf.get(r.id) ?? 0),
  }));
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(users);
  return Number(row?.n ?? 0);
}

export async function countOwners(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.workspaceRole, "owner"));
  return Number(row?.n ?? 0);
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** Fire-and-forget: bump lastActiveAt for the current user. */
export async function touchLastActive(userId: string): Promise<void> {
  try {
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));
  } catch (err) {
    console.error("touchLastActive failed:", err);
  }
}

export async function setWorkspaceRole(userId: string, role: WorkspaceRole): Promise<UserRow | null> {
  const [updated] = await db.update(users).set({ workspaceRole: role }).where(eq(users.id, userId)).returning();
  return updated ?? null;
}

export async function setPasswordHash(userId: string, passwordHash: string, mustChange: boolean): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: mustChange })
    .where(eq(users.id, userId));
}

export async function removeUser(userId: string): Promise<void> {
  // The cascade rules on related tables will clean up.
  await db.delete(users).where(eq(users.id, userId));
}
