import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
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

  // Find a fresh "<name> (copy)" name that doesn't clash with siblings.
  const baseName = `${source.name} (copy)`;
  let name = baseName;
  for (let n = 2; n < 50; n++) {
    const conditions = source.parentId
      ? and(eq(folders.ownerId, userId), eq(folders.parentId, source.parentId), eq(folders.name, name))
      : and(eq(folders.ownerId, userId), isNull(folders.parentId), eq(folders.name, name));
    const [hit] = await db.select({ id: folders.id }).from(folders).where(conditions).limit(1);
    if (!hit) break;
    name = `${source.name} (copy ${n})`;
  }

  // Compute a unique slug within the same parent scope.
  let slug = slugify(name);
  for (let n = 2; n < 50; n++) {
    const conditions = source.parentId
      ? and(eq(folders.ownerId, userId), eq(folders.parentId, source.parentId), eq(folders.slug, slug))
      : and(eq(folders.ownerId, userId), isNull(folders.parentId), eq(folders.slug, slug));
    const [hit] = await db.select({ id: folders.id }).from(folders).where(conditions).limit(1);
    if (!hit) break;
    slug = `${slugify(name)}-${n}`;
  }

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

  return NextResponse.json({ folder: created }, { status: 201 });
}

export const POST = withLogging(_post);
