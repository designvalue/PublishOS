import { NextResponse } from "next/server";
import { aliasedTable, and, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders, users } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";

/**
 * List the TOP LEVEL of the recycle bin:
 *  - Archived folders whose parent (if any) is NOT itself archived. Folders
 *    that landed in trash because their archived ancestor was bulk-deleted
 *    are exposed via the drill-down endpoint instead.
 *  - Archived files whose parent folder is NOT archived. (Files inside a
 *    trashed folder are shown via drill-down.)
 *
 * Regular users see only their own items. Admins / Super Admins see all.
 */
async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const seeEverything = isAdmin(me.workspaceRole);

  // Self-join on folders so we can filter by parent's archive state.
  const parent = aliasedTable(folders, "parent");

  const folderRows = await db
    .select({
      id: folders.id,
      name: folders.name,
      parentId: folders.parentId,
      color: folders.color,
      ownerId: folders.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      archivedAt: folders.archivedAt,
    })
    .from(folders)
    .innerJoin(users, eq(users.id, folders.ownerId))
    .leftJoin(parent, eq(parent.id, folders.parentId))
    .where(
      and(
        isNotNull(folders.archivedAt),
        // Parent either doesn't exist (top-level) or is itself live.
        or(isNull(folders.parentId), isNull(parent.archivedAt)),
        seeEverything ? undefined : eq(folders.ownerId, me.id),
      ),
    )
    .orderBy(desc(folders.archivedAt));

  const fileRows = await db
    .select({
      id: files.id,
      name: files.name,
      folderId: files.folderId,
      folderName: folders.name,
      ownerId: folders.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      mime: files.mime,
      sizeBytes: files.sizeBytes,
      archivedAt: files.archivedAt,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .innerJoin(users, eq(users.id, folders.ownerId))
    .where(
      and(
        isNotNull(files.archivedAt),
        // File's parent folder must still be live — otherwise it's inside an
        // archived folder and surfaces via drill-down.
        isNull(folders.archivedAt),
        seeEverything ? undefined : eq(folders.ownerId, me.id),
      ),
    )
    .orderBy(desc(files.archivedAt));

  return NextResponse.json({
    canSeeAll: seeEverything,
    folders: folderRows,
    files: fileRows,
  });
}

export const GET = withLogging(_get);

// suppress unused
void ne;
