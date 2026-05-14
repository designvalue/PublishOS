import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { uniqueFolderCopyName, uniqueFolderSlug } from "@/lib/data/folders";
import { slugify } from "@/lib/format";
import { withLogging } from "@/lib/logged-handler";

/**
 * Shallow folder duplicate — clones the folder row itself with a new name and
 * slug. Children (subfolders, files) are not copied. Keeps the endpoint cheap
 * and predictable; users can move things into the duplicate if needed.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const [source] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, userId)))
    .limit(1);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = await uniqueFolderCopyName(userId, source.parentId, source.name);
  const slug = await uniqueFolderSlug(userId, source.parentId, slugify(name));

  const [created] = await db
    .insert(folders)
    .values({
      name,
      slug,
      parentId: source.parentId,
      ownerId: userId,
      visibility: source.visibility,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: "Could not duplicate the folder." }, { status: 500 });
  }

  return NextResponse.json({ folder: created }, { status: 201 });
}

export const POST = withLogging(_post);
