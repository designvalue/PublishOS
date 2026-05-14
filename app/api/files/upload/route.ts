import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { canCreate, requireSessionUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { folderStorageKey } from "@/lib/data/folders";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

async function _post(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canCreate(me.workspaceRole)) {
    return NextResponse.json(
      { error: "Viewers can't upload files." },
      { status: 403 },
    );
  }
  const session = { user: { id: me.id } };

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const folderIdRaw = form.get("folderId");
  const file = form.get("file");
  if (typeof folderIdRaw !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing folderId or file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 1 GB" }, { status: 413 });
  }

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderIdRaw), eq(folders.ownerId, session.user.id)))
    .limit(1);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  // Resolve a unique filename within the folder (e.g. "logo.svg" → "logo (2).svg" on collision).
  const finalName = await uniqueFileName(folder.id, file.name || "untitled");

  const safeName = finalName.replace(/[^A-Za-z0-9._\-() ]/g, "_");
  const folderKey = await folderStorageKey(folder);
  const storageKey = `${folderKey}/${safeName}`;
  const contentType = file.type || "application/octet-stream";

  const storage = await getStorage();
  // Make sure the folder dir exists on disk for the local backend.
  if (storage.mkdir) {
    await storage.mkdir(folderKey);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await storage.put(storageKey, buffer, contentType);

  const isHtml = finalName.toLowerCase().endsWith("index.html") || contentType === "text/html";

  const [created] = await db
    .insert(files)
    .values({
      folderId: folder.id,
      name: finalName,
      path: finalName,
      mime: contentType,
      sizeBytes: result.size,
      storageKey: result.key,
      storageEtag: result.etag,
    })
    .returning();

  await db
    .update(folders)
    .set({
      modifiedAt: new Date(),
      ...(isHtml ? { hasIndexHtml: true } : {}),
    })
    .where(eq(folders.id, folder.id));

  return NextResponse.json({ file: created });
}

async function uniqueFileName(folderId: string, baseName: string): Promise<string> {
  const [hit] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.folderId, folderId), eq(files.name, baseName)))
    .limit(1);
  if (!hit) return baseName;

  const dot = baseName.lastIndexOf(".");
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : "";
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} (${n})${ext}`;
    const [h] = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.folderId, folderId), eq(files.name, candidate)))
      .limit(1);
    if (!h) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

export const POST = withLogging(_post);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
