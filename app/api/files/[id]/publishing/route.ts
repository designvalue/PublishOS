import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { files, folders, folderMembers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { withLogging } from "@/lib/logged-handler";
import { notify } from "@/lib/data/notifications";

// Custom URL slug — same vocabulary as folders previously used. Globally
// unique within the workspace so URLs can be served from /c/<slug>.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "settings", "login", "register", "logout",
  "invite", "dashboard", "help", "support", "docs", "status",
  "people", "teams", "logs", "stats", "home", "new", "c", "p",
]);

const SetPublishing = z.object({
  mode: z.enum(["off", "public", "password"]),
  password: z.string().min(8).optional(),
  indexable: z.boolean(),
  publicSlug: z.string().trim().toLowerCase().min(3).max(64).nullable().optional(),
});

async function loadFile(fileId: string, userId: string) {
  const [row] = await db
    .select({
      id: files.id,
      name: files.name,
      mime: files.mime,
      publishMode: files.publishMode,
      publishPasswordHash: files.publishPasswordHash,
      indexable: files.indexable,
      publicSlug: files.publicSlug,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .leftJoin(folderMembers, and(eq(folderMembers.folderId, folders.id), eq(folderMembers.userId, userId)))
    .where(and(eq(files.id, fileId), or(eq(folders.ownerId, userId), eq(folderMembers.userId, userId))))
    .limit(1);
  return row ?? null;
}

async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const file = await loadFile(id, session.user.id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ file });
}

async function _patch(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = SetPublishing.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { mode, password, indexable, publicSlug } = parsed.data;

  const existing = await loadFile(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (mode === "password" && !password && !existing.publishPasswordHash) {
    return NextResponse.json({ error: "Password is required for password-protected publishing" }, { status: 400 });
  }

  // Validate + normalise publicSlug.
  let nextSlug: string | null | undefined;
  if (publicSlug === undefined) {
    nextSlug = undefined;
  } else if (publicSlug === null || publicSlug === "") {
    nextSlug = null;
  } else {
    if (!SLUG_RE.test(publicSlug)) {
      return NextResponse.json(
        { error: "Slug must be 3–64 characters, lowercase letters, numbers, or hyphens (not at the edges)." },
        { status: 400 },
      );
    }
    if (RESERVED_SLUGS.has(publicSlug)) {
      return NextResponse.json({ error: `"${publicSlug}" is reserved. Try another.` }, { status: 400 });
    }
    if (publicSlug !== existing.publicSlug) {
      const [clash] = await db
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.publicSlug, publicSlug), ne(files.id, id)))
        .limit(1);
      if (clash) {
        return NextResponse.json({ error: `"${publicSlug}" is already taken.` }, { status: 409 });
      }
      // Also check legacy folder slugs to avoid collisions across the /c/ namespace.
      const [folderClash] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.publicSlug, publicSlug), isNull(folders.archivedAt)))
        .limit(1);
      if (folderClash) {
        return NextResponse.json({ error: `"${publicSlug}" is already taken.` }, { status: 409 });
      }
    }
    nextSlug = publicSlug;
  }

  const passwordHash =
    mode === "off" ? null : mode === "password" && password ? await hashPassword(password) : undefined;

  const [updated] = await db
    .update(files)
    .set({
      publishMode: mode,
      indexable,
      ...(passwordHash !== undefined ? { publishPasswordHash: passwordHash } : {}),
      ...(nextSlug !== undefined ? { publicSlug: nextSlug } : {}),
      modifiedAt: new Date(),
    })
    .where(eq(files.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort notification — never block the response.
  if (existing.publishMode !== mode) {
    const prettyName = updated.name || "Untitled";
    const link = updated.publicSlug ? `/c/${updated.publicSlug}` : `/files/${updated.id}`;
    if (mode === "public") {
      void notify({
        userId: session.user.id,
        kind: "success",
        event: "file.published",
        title: `“${prettyName}” is now public`,
        body: "Anyone with the link can view it.",
        link,
        data: { fileId: updated.id, slug: updated.publicSlug },
      });
    } else if (mode === "password") {
      void notify({
        userId: session.user.id,
        kind: "success",
        event: "file.published.password",
        title: `“${prettyName}” is password-protected`,
        body: "Visitors will be asked for the password before viewing.",
        link,
        data: { fileId: updated.id, slug: updated.publicSlug },
      });
    } else {
      void notify({
        userId: session.user.id,
        kind: "info",
        event: "file.unpublished",
        title: `“${prettyName}” is now private`,
        body: "The public link no longer resolves.",
        link: `/files/${updated.id}`,
        data: { fileId: updated.id },
      });
    }
  }

  return NextResponse.json({ file: updated });
}

export const GET = withLogging(_get);
export const PATCH = withLogging(_patch);
