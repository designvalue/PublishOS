import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";
import { notify } from "@/lib/data/notifications";

const BulkPurge = z.object({
  folders: z.array(z.string().uuid()).default([]),
  files: z.array(z.string().uuid()).default([]),
});

/**
 * Permanently delete many trash items at once. Each id is ownership-checked.
 * Folders permanently take their entire subtree (subfolders + files +
 * storage bytes) with them.
 */
async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BulkPurge.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { folders: folderIds, files: fileIds } = parsed.data;
  const seeAll = isAdmin(me.workspaceRole);
  const storage = await getStorage();

  let purgedFolders = 0;
  let purgedFiles = 0;

  // --- Files first ----------------------------------------------------------
  if (fileIds.length > 0) {
    const rows = await db
      .select({
        id: files.id,
        storageKey: files.storageKey,
        ownerId: folders.ownerId,
        archived: files.archivedAt,
      })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .where(inArray(files.id, fileIds));
    const allowed = rows.filter((r) => (seeAll || r.ownerId === me.id) && r.archived);
    for (const f of allowed) {
      await storage.delete(f.storageKey).catch(() => undefined);
    }
    if (allowed.length > 0) {
      await db.delete(files).where(inArray(files.id, allowed.map((r) => r.id)));
      purgedFiles = allowed.length;
    }
  }

  // --- Folders --------------------------------------------------------------
  if (folderIds.length > 0) {
    const roots = await db
      .select({ id: folders.id, ownerId: folders.ownerId, archived: folders.archivedAt })
      .from(folders)
      .where(inArray(folders.id, folderIds));
    const allowedRoots = roots.filter((r) => (seeAll || r.ownerId === me.id) && r.archived);

    for (const root of allowedRoots) {
      const collected: string[] = [root.id];
      let frontier = [root.id];
      for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
        const children = await db
          .select({ id: folders.id })
          .from(folders)
          .where(inArray(folders.parentId, frontier));
        if (children.length === 0) break;
        const next: string[] = [];
        for (const c of children) {
          collected.push(c.id);
          next.push(c.id);
        }
        frontier = next;
      }

      const fileRows = await db
        .select({ id: files.id, storageKey: files.storageKey })
        .from(files)
        .where(inArray(files.folderId, collected));
      for (const f of fileRows) await storage.delete(f.storageKey).catch(() => undefined);
      if (fileRows.length > 0) {
        await db.delete(files).where(inArray(files.id, fileRows.map((f) => f.id)));
      }
      for (const fid of [...collected].reverse()) {
        await db.delete(folders).where(eq(folders.id, fid));
      }
      purgedFolders += 1;
    }
  }

  if (purgedFolders > 0 || purgedFiles > 0) {
    const parts: string[] = [];
    if (purgedFolders > 0) parts.push(`${purgedFolders} folder${purgedFolders === 1 ? "" : "s"}`);
    if (purgedFiles > 0) parts.push(`${purgedFiles} file${purgedFiles === 1 ? "" : "s"}`);
    void notify({
      userId: me.id,
      kind: "warning",
      event: "trash.purged",
      title: `Permanently deleted ${parts.join(" and ")}`,
      body: "These items can no longer be recovered.",
      link: "/trash",
      data: { purgedFolders, purgedFiles },
    });
  }

  return NextResponse.json({ ok: true, purgedFolders, purgedFiles });
}

export const POST = withLogging(_post);
export const runtime = "nodejs";

// suppress unused lint
void isNotNull;
