import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { withLogging } from "@/lib/logged-handler";

/**
 * Restore an archived folder. The caller must own it, or be an Admin /
 * Super Admin.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [folder] = await db
    .select({ id: folders.id, ownerId: folders.ownerId })
    .from(folders)
    .where(and(eq(folders.id, id), isNotNull(folders.archivedAt)))
    .limit(1);

  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.ownerId !== me.id && !isAdmin(me.workspaceRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [restored] = await db
    .update(folders)
    .set({ archivedAt: null, modifiedAt: new Date() })
    .where(eq(folders.id, id))
    .returning();

  return NextResponse.json({ folder: restored });
}

export const POST = withLogging(_post);
