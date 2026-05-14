import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";

/**
 * Drill down into an archived folder to inspect / restore individual items.
 *
 * Returns:
 *  - folder: the archived folder itself
 *  - ancestors: the chain of (archived) ancestors back to the trashed root
 *  - subfolders: direct child folders (archived or live; the parent being
 *    archived effectively hides them from the live tree)
 *  - files: direct child files (archived or live)
 *
 * Access:
 *  - The caller must own the folder, or be an Admin / Super Admin.
 *  - The folder must be archived itself (we never expose live folder contents
 *    via this endpoint — use the regular folder routes for that).
 */
async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [folder] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.ownerId !== me.id && !isAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Walk up to find the trash root. The folder either:
  //   (a) is itself archived → it's a top-level trash entry, OR
  //   (b) has an archived ancestor → it's effectively in the trash because a
  //       parent was deleted.
  // If neither, refuse — this endpoint never exposes live folder contents.
  const ancestors: { id: string; name: string }[] = [];
  let cursor: string | null = folder.parentId;
  let trashRoot = !!folder.archivedAt;
  while (cursor) {
    const [parent] = await db
      .select({ id: folders.id, name: folders.name, parentId: folders.parentId, archivedAt: folders.archivedAt })
      .from(folders)
      .where(eq(folders.id, cursor))
      .limit(1);
    if (!parent) break;
    if (parent.archivedAt) trashRoot = true;
    ancestors.unshift({ id: parent.id, name: parent.name });
    cursor = parent.parentId;
  }
  if (!trashRoot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const subfolders = await db
    .select({
      id: folders.id,
      name: folders.name,
      color: folders.color,
      archivedAt: folders.archivedAt,
    })
    .from(folders)
    .where(eq(folders.parentId, id))
    .orderBy(folders.name);

  const childFiles = await db
    .select({
      id: files.id,
      name: files.name,
      mime: files.mime,
      sizeBytes: files.sizeBytes,
      archivedAt: files.archivedAt,
      modifiedAt: files.modifiedAt,
    })
    .from(files)
    .where(eq(files.folderId, id))
    .orderBy(desc(files.modifiedAt));

  return NextResponse.json({
    folder: { id: folder.id, name: folder.name, color: folder.color, archivedAt: folder.archivedAt },
    ancestors,
    subfolders,
    files: childFiles,
  });
}

export const GET = withLogging(_get);
