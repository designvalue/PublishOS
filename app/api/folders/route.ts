import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canCreate, requireSessionUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { folderStorageKey, listAllAccessibleFolders, listVisibleFolders } from "@/lib/data/folders";
import { slugify } from "@/lib/format";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

// Finder-style tag colours. The token is stored, CSS resolves the palette.
const FOLDER_COLORS = [
  "red", "coral", "orange", "amber", "yellow", "green",
  "teal", "blue", "indigo", "violet", "pink", "gray",
] as const;
const FolderColor = z.enum(FOLDER_COLORS);

const NewFolder = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["private", "shared"]).default("private"),
  color: FolderColor.nullable().optional(),
});

async function get(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?scope=all returns the full tree (any depth) the user can see — used by
  // the Move modal so it can render every possible destination.
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const rows =
    scope === "all"
      ? await listAllAccessibleFolders(session.user.id)
      : await listVisibleFolders(session.user.id);
  return NextResponse.json({ folders: rows });
}

async function post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canCreate(me.workspaceRole)) {
    return NextResponse.json(
      { error: "Viewers can't create folders. Ask a Super Admin or Admin for an Editor role." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = NewFolder.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { name, parentId = null, visibility, color = null } = parsed.data;
  const slug = slugify(name);

  // If parentId provided, ensure the user owns or has access to it.
  if (parentId) {
    const [parent] = await db
      .select({ id: folders.id, ownerId: folders.ownerId })
      .from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.ownerId, me.id)))
      .limit(1);
    if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
  }

  // Disambiguate slug under (owner, parent)
  const finalSlug = await uniqueSlug(slug, me.id, parentId);

  const [created] = await db
    .insert(folders)
    .values({
      name,
      slug: finalSlug,
      parentId,
      ownerId: me.id,
      visibility,
      color,
    })
    .returning();

  // Mirror on disk for local backend (no-op for S3-compatible).
  try {
    const storage = await getStorage();
    if (storage.mkdir) {
      const key = await folderStorageKey(created);
      await storage.mkdir(key);
    }
  } catch (err) {
    console.error("Failed to create folder on storage:", err);
  }

  return NextResponse.json({ folder: created }, { status: 201 });
}

export const GET = withLogging(get);
export const POST = withLogging(post);
export const runtime = "nodejs";

async function uniqueSlug(base: string, ownerId: string, parentId: string | null): Promise<string> {
  let attempt = base;
  let n = 1;
  while (true) {
    const conditions = parentId
      ? and(eq(folders.ownerId, ownerId), eq(folders.parentId, parentId), eq(folders.slug, attempt))
      : and(eq(folders.ownerId, ownerId), isNull(folders.parentId), eq(folders.slug, attempt));
    const [hit] = await db.select({ id: folders.id }).from(folders).where(conditions).limit(1);
    if (!hit) return attempt;
    n += 1;
    attempt = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}
