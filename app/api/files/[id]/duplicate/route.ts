import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { folderStorageKey } from "@/lib/data/folders";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

/**
 * Duplicate a file. Streams the source object out of storage, gives the copy
 * a new name + storage key, and writes it back. Keeps publishing OFF on the
 * copy regardless of the source's state — duplicating shouldn't accidentally
 * re-publish content at a new URL.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const [row] = await db
    .select({ file: files, folder: folders })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(eq(files.id, id), eq(folders.ownerId, userId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Compute a fresh name "<base> (copy)<.ext>" that doesn't collide inside the folder.
  const dot = row.file.name.lastIndexOf(".");
  const base = dot > 0 ? row.file.name.slice(0, dot) : row.file.name;
  const ext = dot > 0 ? row.file.name.slice(dot) : "";
  let candidate = `${base} (copy)${ext}`;
  for (let n = 2; n < 100; n++) {
    const [hit] = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.folderId, row.file.folderId), eq(files.name, candidate)))
      .limit(1);
    if (!hit) break;
    candidate = `${base} (copy ${n})${ext}`;
  }

  // Copy bytes through the storage adapter.
  const storage = await getStorage();
  const src = await storage.get(row.file.storageKey);
  if (!src) return NextResponse.json({ error: "Source object missing" }, { status: 502 });

  const nodeStream = Readable.fromWeb(src.stream as never);
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) chunks.push(chunk as Buffer);
  const bytes = Buffer.concat(chunks);

  const baseKey = await folderStorageKey(row.folder);
  const newKey = `${baseKey}/${candidate}`;
  await storage.put(newKey, new Uint8Array(bytes), row.file.mime);

  const [created] = await db
    .insert(files)
    .values({
      folderId: row.file.folderId,
      name: candidate,
      path: candidate,
      mime: row.file.mime,
      sizeBytes: bytes.byteLength,
      storageKey: newKey,
    })
    .returning();

  return NextResponse.json({ file: created }, { status: 201 });
}

export const POST = withLogging(_post);
export const runtime = "nodejs";
