import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";

const BulkRestore = z.object({
  folders: z.array(z.string().uuid()).default([]),
  files: z.array(z.string().uuid()).default([]),
});

/**
 * Restore many trash items in one shot. Each id is independently auth-checked:
 *   - User must own the folder (or its parent for files), OR
 *   - Be an Admin / Super Admin.
 * Items that fail the auth check are silently skipped — the response reports
 * how many of each kind were actually restored.
 */
async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BulkRestore.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { folders: folderIds, files: fileIds } = parsed.data;
  const seeAll = isAdmin(me.workspaceRole);

  let restoredFolders = 0;
  let restoredFiles = 0;

  if (folderIds.length > 0) {
    // Pull each candidate, filter by ownership.
    const rows = await db
      .select({ id: folders.id, ownerId: folders.ownerId })
      .from(folders)
      .where(inArray(folders.id, folderIds));
    const allowedIds = rows
      .filter((r) => seeAll || r.ownerId === me.id)
      .map((r) => r.id);
    if (allowedIds.length > 0) {
      await db
        .update(folders)
        .set({ archivedAt: null, modifiedAt: new Date() })
        .where(inArray(folders.id, allowedIds));
      restoredFolders = allowedIds.length;
    }
  }

  if (fileIds.length > 0) {
    // Files inherit ownership from their parent folder. Refuse to restore a
    // file whose parent folder is still archived (would orphan it).
    const rows = await db
      .select({
        id: files.id,
        ownerId: folders.ownerId,
        parentArchived: folders.archivedAt,
      })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .where(inArray(files.id, fileIds));
    const allowedIds = rows
      .filter((r) => (seeAll || r.ownerId === me.id) && !r.parentArchived)
      .map((r) => r.id);
    if (allowedIds.length > 0) {
      await db
        .update(files)
        .set({ archivedAt: null, modifiedAt: new Date() })
        .where(and(inArray(files.id, allowedIds)));
      restoredFiles = allowedIds.length;
    }
  }

  return NextResponse.json({ ok: true, restoredFolders, restoredFiles });
}

export const POST = withLogging(_post);

// suppress unused import lint
void isNull;
