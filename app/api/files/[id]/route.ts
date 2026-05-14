import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin, requireSessionUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { files, folders, folderMembers } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid().optional(),
});

async function _get(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = me.id;

  // `?from=trash` lets the user download / preview an archived file from the
  // recycle bin without restoring it first. Access is still gated: the caller
  // must own the parent folder, or be an Admin / Super Admin.
  const fromTrash = new URL(req.url).searchParams.get("from") === "trash";
  const seeAll = isAdmin(me.workspaceRole);

  const [row] = await db
    .select({ file: files, folder: folders })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .leftJoin(folderMembers, and(eq(folderMembers.folderId, folders.id), eq(folderMembers.userId, userId)))
    .where(
      fromTrash
        ? and(
            eq(files.id, id),
            // Trash download: skip the live-only `isNull(archivedAt)` guard.
            // Membership grants don't carry into trash, so we require ownership
            // unless the caller is an Admin / Super Admin.
            seeAll ? eq(files.id, id) : eq(folders.ownerId, userId),
          )
        : and(
            eq(files.id, id),
            isNull(files.archivedAt),
            or(eq(folders.ownerId, userId), eq(folderMembers.userId, userId)),
          ),
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storage = await getStorage();
  const obj = await storage.get(row.file.storageKey);
  if (!obj) return NextResponse.json({ error: "Object missing" }, { status: 404 });

  return new Response(obj.stream, {
    headers: {
      "Content-Type": obj.contentType ?? row.file.mime,
      "Content-Length": String(obj.size || row.file.sizeBytes),
      "Content-Disposition": `inline; filename="${row.file.name.replace(/"/g, "\\\"")}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

async function _patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Verify the file is owned through its current folder.
  const [row] = await db
    .select({ file: files })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(eq(files.id, id), eq(folders.ownerId, userId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If moving, validate the destination folder is owned by the same user.
  if (parsed.data.folderId) {
    const [dest] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, parsed.data.folderId), eq(folders.ownerId, userId)))
      .limit(1);
    if (!dest) return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(files)
    .set({ ...parsed.data, modifiedAt: new Date() })
    .where(eq(files.id, id))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ file: updated });
}

async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Soft delete: send to the recycle bin. The file's row + storage object stay
  // intact so it can be restored. Permanent deletion happens via /purge.
  const [row] = await db
    .select({ id: files.id })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(eq(files.id, id), eq(folders.ownerId, session.user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(files)
    .set({ archivedAt: new Date(), publicSlug: null })
    .where(eq(files.id, id));

  return NextResponse.json({ ok: true, restoreUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000) });
}

export const GET = withLogging(_get, { source: "private" });
export const PATCH = withLogging(_patch, { source: "private" });
export const DELETE = withLogging(_delete, { source: "private" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
