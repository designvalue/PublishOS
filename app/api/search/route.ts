import { NextResponse } from "next/server";
import { and, like, isNull, or, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { folders, files, folderMembers } from "@/lib/db/schema";
import { withLogging } from "@/lib/logged-handler";

async function _get(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const userId = session.user.id;

  if (!q) {
    const recent = await db
      .select({ id: folders.id, name: folders.name, slug: folders.slug })
      .from(folders)
      .where(and(eq(folders.ownerId, userId), isNull(folders.archivedAt)))
      .orderBy(desc(folders.modifiedAt))
      .limit(8);
    return NextResponse.json({ folders: recent, files: [] });
  }

  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const folderHits = await db
    .selectDistinct({
      id: folders.id,
      name: folders.name,
      slug: folders.slug,
    })
    .from(folders)
    .leftJoin(folderMembers, and(eq(folderMembers.folderId, folders.id), eq(folderMembers.userId, userId)))
    .where(
      and(
        like(folders.name, pattern),
        or(eq(folders.ownerId, userId), eq(folderMembers.userId, userId)),
        isNull(folders.archivedAt),
      ),
    )
    .limit(20);

  const fileHits = await db
    .select({
      id: files.id,
      name: files.name,
      folderId: files.folderId,
      mime: files.mime,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .leftJoin(folderMembers, and(eq(folderMembers.folderId, folders.id), eq(folderMembers.userId, userId)))
    .where(
      and(
        like(files.name, pattern),
        or(eq(folders.ownerId, userId), eq(folderMembers.userId, userId)),
        // Exclude items in the recycle bin (parent folder OR the file itself).
        isNull(folders.archivedAt),
        isNull(files.archivedAt),
      ),
    )
    .limit(20);

  return NextResponse.json({ folders: folderHits, files: fileHits });
}

export const GET = withLogging(_get);
