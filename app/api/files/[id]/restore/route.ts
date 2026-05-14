import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";

/**
 * Restore an archived file. The caller must own its folder, or be an Admin /
 * Super Admin. Refuses if the parent folder is still archived — caller has to
 * restore the folder first.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [row] = await db
    .select({
      file: files,
      folder: { id: folders.id, ownerId: folders.ownerId, archivedAt: folders.archivedAt },
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(eq(files.id, id), isNotNull(files.archivedAt)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.folder.ownerId !== me.id && !isAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.folder.archivedAt) {
    return NextResponse.json(
      { error: "Parent folder is in the recycle bin. Restore it first." },
      { status: 409 },
    );
  }

  const [restored] = await db
    .update(files)
    .set({ archivedAt: null, modifiedAt: new Date() })
    .where(eq(files.id, id))
    .returning();

  return NextResponse.json({ file: restored });
}

export const POST = withLogging(_post);
