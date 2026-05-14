import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

/**
 * Permanently delete a file (bytes + row). Caller must own the parent folder,
 * or be an Admin / Super Admin. File must already be in the recycle bin.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [row] = await db
    .select({ file: files, owner: folders.ownerId })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(eq(files.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.owner !== me.id && !isAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!row.file.archivedAt) {
    return NextResponse.json(
      { error: "File must be in the recycle bin before it can be permanently deleted." },
      { status: 409 },
    );
  }

  const storage = await getStorage();
  await storage.delete(row.file.storageKey).catch(() => undefined);
  await db.delete(files).where(eq(files.id, id));

  return NextResponse.json({ ok: true });
}

export const POST = withLogging(_post);
export const runtime = "nodejs";
