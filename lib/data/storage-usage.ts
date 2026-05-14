import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders, users } from "@/lib/db/schema";

/**
 * Workspace storage usage — aggregated bytes and file counts, per user.
 *
 * Files are owned via their folder (folders own users). Archived files and
 * archived folders are excluded so the numbers match the visible workspace.
 */

export type StorageUsageRow = {
  userId: string;
  name: string | null;
  email: string;
  bytes: number;
  files: number;
};

export type StorageUsage = {
  total: { bytes: number; files: number; users: number };
  byUser: StorageUsageRow[];
};

export async function getStorageUsage(): Promise<StorageUsage> {
  const rows = await db
    .select({
      userId: folders.ownerId,
      name: users.name,
      email: users.email,
      bytes: sql<number>`COALESCE(SUM(${files.sizeBytes}), 0)`,
      files: sql<number>`COUNT(${files.id})`,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .innerJoin(users, eq(users.id, folders.ownerId))
    .where(and(isNull(files.archivedAt), isNull(folders.archivedAt)))
    .groupBy(folders.ownerId, users.name, users.email)
    .orderBy(desc(sql`SUM(${files.sizeBytes})`));

  const byUser: StorageUsageRow[] = rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    bytes: Number(r.bytes ?? 0),
    files: Number(r.files ?? 0),
  }));

  const total = byUser.reduce(
    (acc, r) => ({
      bytes: acc.bytes + r.bytes,
      files: acc.files + r.files,
      users: acc.users + (r.bytes > 0 ? 1 : 0),
    }),
    { bytes: 0, files: 0, users: 0 },
  );

  return { total, byUser };
}
