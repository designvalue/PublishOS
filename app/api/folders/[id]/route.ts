import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { folders } from "@/lib/db/schema";
import { ancestorChain, getFolderById } from "@/lib/data/folders";
import { withLogging } from "@/lib/logged-handler";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  visibility: z.enum(["private", "shared"]).optional(),
  parentId: z.string().uuid().nullable().optional(),
  color: z
    .enum(["red", "coral", "orange", "amber", "yellow", "green", "teal", "blue", "indigo", "violet", "pink", "gray"])
    .nullable()
    .optional(),
});

async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await getFolderById(id, session.user.id);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ folder });
}

async function _patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Patch.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // If moving (parentId in payload), validate the new parent is owned by the user
  // and is not a descendant of the folder being moved (would create a cycle).
  if (parsed.data.parentId !== undefined) {
    if (parsed.data.parentId === id) {
      return NextResponse.json({ error: "A folder can't be its own parent" }, { status: 400 });
    }
    if (parsed.data.parentId) {
      const [newParent] = await db
        .select({ id: folders.id, ownerId: folders.ownerId })
        .from(folders)
        .where(eq(folders.id, parsed.data.parentId))
        .limit(1);
      if (!newParent || newParent.ownerId !== session.user.id) {
        return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
      }
      // Walk up the new parent's chain — none of its ancestors should be the moved folder.
      const chain = await ancestorChain(parsed.data.parentId);
      if (chain.some((f) => f.id === id)) {
        return NextResponse.json(
          { error: "Can't move a folder into one of its own subfolders" },
          { status: 400 },
        );
      }
    }
  }

  const [updated] = await db
    .update(folders)
    .set({ ...parsed.data, modifiedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.ownerId, session.user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ folder: updated });
}

async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Releasing the publicSlug on archive lets the owner reuse it on another folder
  // without bumping into the DB-level UNIQUE index on public_slug.
  const [archived] = await db
    .update(folders)
    .set({ archivedAt: new Date(), publicSlug: null })
    .where(and(eq(folders.id, id), eq(folders.ownerId, session.user.id)))
    .returning();

  if (!archived) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, restoreUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000) });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
export const DELETE = withLogging(_delete);
