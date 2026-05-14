import "server-only";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { folders, files, folderMembers } from "@/lib/db/schema";

export type FolderRow = typeof folders.$inferSelect;
export type FileRow = typeof files.$inferSelect;

/**
 * List folders the user can see at the workspace root level.
 * Includes folders they own + folders shared with them.
 */
export async function listVisibleFolders(userId: string): Promise<FolderRow[]> {
  const owned = db
    .select()
    .from(folders)
    .where(and(eq(folders.ownerId, userId), isNull(folders.parentId), isNull(folders.archivedAt)));

  const shared = db
    .selectDistinct({
      id: folders.id,
      name: folders.name,
      slug: folders.slug,
      parentId: folders.parentId,
      ownerId: folders.ownerId,
      visibility: folders.visibility,
      publishMode: folders.publishMode,
      publicSlug: folders.publicSlug,
      color: folders.color,
      customDomain: folders.customDomain,
      publishPasswordHash: folders.publishPasswordHash,
      indexable: folders.indexable,
      allowDownloads: folders.allowDownloads,
      hasIndexHtml: folders.hasIndexHtml,
      createdAt: folders.createdAt,
      modifiedAt: folders.modifiedAt,
      archivedAt: folders.archivedAt,
    })
    .from(folders)
    .innerJoin(folderMembers, eq(folderMembers.folderId, folders.id))
    .where(
      and(
        eq(folderMembers.userId, userId),
        isNull(folders.parentId),
        isNull(folders.archivedAt),
      ),
    );

  const [ownedRows, sharedRows] = await Promise.all([owned, shared]);
  // De-dupe by id
  const map = new Map<string, FolderRow>();
  for (const r of ownedRows) map.set(r.id, r);
  for (const r of sharedRows) map.set(r.id, r);
  return [...map.values()].sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

/**
 * All non-archived folders accessible to the user, flat. Includes every
 * folder the user owns (any depth) plus the full subtree of any root they
 * have explicit access to. The caller can build a tree client-side.
 */
export async function listAllAccessibleFolders(userId: string): Promise<FolderRow[]> {
  // 1. Every owned folder, any depth.
  const owned = await db
    .select()
    .from(folders)
    .where(and(eq(folders.ownerId, userId), isNull(folders.archivedAt)));

  // 2. Roots shared with this user.
  const sharedRoots = await db
    .selectDistinct({ id: folders.id })
    .from(folders)
    .innerJoin(folderMembers, eq(folderMembers.folderId, folders.id))
    .where(and(eq(folderMembers.userId, userId), isNull(folders.archivedAt)));

  const collected = new Map<string, FolderRow>();
  for (const r of owned) collected.set(r.id, r);

  // 3. Walk descendants of each shared root, in case the user doesn't own them.
  if (sharedRoots.length > 0) {
    let frontier = sharedRoots.map((r) => r.id);
    // Pull the root rows themselves
    const rootRows = await db
      .select()
      .from(folders)
      .where(and(
        // any of frontier ids
        or(...frontier.map((id) => eq(folders.id, id))),
        isNull(folders.archivedAt),
      ));
    for (const r of rootRows) collected.set(r.id, r);

    // BFS down. Cap depth to avoid pathological loops.
    for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
      const children = await db
        .select()
        .from(folders)
        .where(and(
          or(...frontier.map((id) => eq(folders.parentId, id))),
          isNull(folders.archivedAt),
        ));
      if (children.length === 0) break;
      const next: string[] = [];
      for (const c of children) {
        if (!collected.has(c.id)) {
          collected.set(c.id, c);
          next.push(c.id);
        }
      }
      frontier = next;
    }
  }

  return [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFolderById(folderId: string, userId: string): Promise<FolderRow | null> {
  const [row] = await db
    .select()
    .from(folders)
    .leftJoin(folderMembers, and(eq(folderMembers.folderId, folders.id), eq(folderMembers.userId, userId)))
    .where(
      and(
        eq(folders.id, folderId),
        isNull(folders.archivedAt),
        or(eq(folders.ownerId, userId), eq(folderMembers.userId, userId)),
      ),
    )
    .limit(1);

  return row?.folders ?? null;
}

export async function listChildren(folderId: string): Promise<FolderRow[]> {
  return db
    .select()
    .from(folders)
    .where(and(eq(folders.parentId, folderId), isNull(folders.archivedAt)))
    .orderBy(asc(folders.name));
}

export async function listFiles(folderId: string): Promise<FileRow[]> {
  return db
    .select()
    .from(files)
    .where(and(eq(files.folderId, folderId), isNull(files.archivedAt)))
    .orderBy(desc(files.modifiedAt));
}

/**
 * Storage key for the folder itself — used to mirror folders on disk for the
 * local backend, and as a human-readable prefix for S3-compatible buckets.
 * Format: `<ownerId>/<slug>/<slug>/...` (no leading or trailing slashes).
 */
export async function folderStorageKey(folder: FolderRow): Promise<string> {
  const chain = await ancestorChain(folder.id);
  const slugs = chain.map((f) => f.slug);
  return [folder.ownerId, ...slugs].join("/");
}

export async function ancestorChain(folderId: string): Promise<FolderRow[]> {
  // Walk up parent_id chain.
  const chain: FolderRow[] = [];
  let cursor: string | null = folderId;
  // cap at 32 to prevent runaway loops if data is corrupted
  for (let i = 0; i < 32 && cursor; i++) {
    const [row]: FolderRow[] = await db.select().from(folders).where(eq(folders.id, cursor)).limit(1);
    if (!row) break;
    chain.unshift(row);
    cursor = row.parentId;
  }
  return chain;
}

export async function countSubfoldersAndFiles(folderId: string): Promise<{ subfolders: number; files: number; bytes: number }> {
  const [sub] = await db
    .select({ n: sql<number>`count(*)` })
    .from(folders)
    .where(and(eq(folders.parentId, folderId), isNull(folders.archivedAt)));

  const [fl] = await db
    .select({
      n: sql<number>`count(*)`,
      bytes: sql<number>`coalesce(sum(${files.sizeBytes}), 0)`,
    })
    .from(files)
    .where(and(eq(files.folderId, folderId), isNull(files.archivedAt)));

  return { subfolders: sub?.n ?? 0, files: fl?.n ?? 0, bytes: Number(fl?.bytes ?? 0) };
}
