import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

/**
 * Permanently delete a folder + everything inside it (subfolders + files +
 * stored objects). Caller must own it, or be an Admin / Super Admin.
 *
 * The folder must already be archived — we never bypass the recycle bin.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [folder] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.ownerId !== me.id && !isAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!folder.archivedAt) {
    return NextResponse.json(
      { error: "Folder must be in the recycle bin before it can be permanently deleted." },
      { status: 409 },
    );
  }

  // Walk every descendant folder via BFS, collecting their ids so we can
  // delete every file within the subtree, then the folder rows themselves.
  const folderIds: string[] = [folder.id];
  let frontier: string[] = [folder.id];
  for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
    const children = await db
      .select({ id: folders.id })
      .from(folders)
      .where(inArray(folders.parentId, frontier));
    if (children.length === 0) break;
    const next: string[] = [];
    for (const c of children) {
      folderIds.push(c.id);
      next.push(c.id);
    }
    frontier = next;
  }

  // Pull every file storage key in the subtree, delete the bytes, then the rows.
  const fileRows = await db
    .select({ id: files.id, storageKey: files.storageKey })
    .from(files)
    .where(inArray(files.folderId, folderIds));

  const storage = await getStorage();
  for (const f of fileRows) {
    await storage.delete(f.storageKey).catch(() => undefined);
  }
  if (fileRows.length > 0) {
    await db.delete(files).where(inArray(files.id, fileRows.map((f) => f.id)));
  }

  // Delete deepest folders first by reversing the BFS order — child rows
  // would otherwise hold foreign-key references to their parents.
  for (const fid of [...folderIds].reverse()) {
    await db.delete(folders).where(eq(folders.id, fid));
  }

  return NextResponse.json({ ok: true, removed: { folders: folderIds.length, files: fileRows.length } });
}

export const POST = withLogging(_post);
export const runtime = "nodejs";
