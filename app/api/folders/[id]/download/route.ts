import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import JSZip from "jszip";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { getFolderById } from "@/lib/data/folders";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await getFolderById(id, session.user.id);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const descendants = await collectDescendants(id);
  const folderIds = [id, ...descendants.map((d) => d.id)];
  const fileRows = await db.select().from(files).where(inArray(files.folderId, folderIds));

  const folderById = new Map<string, { id: string; name: string; parentId: string | null }>();
  folderById.set(id, { id: folder.id, name: folder.name, parentId: null });
  for (const d of descendants) folderById.set(d.id, d);

  function relativePath(folderId: string, leaf: string): string {
    const parts: string[] = [leaf];
    let cursor = folderById.get(folderId);
    while (cursor && cursor.parentId !== null) {
      parts.unshift(cursor.name);
      cursor = cursor.parentId ? folderById.get(cursor.parentId) : undefined;
    }
    return parts.join("/");
  }

  const zip = new JSZip();
  const storage = await getStorage();

  for (const f of fileRows) {
    const obj = await storage.get(f.storageKey);
    if (!obj) continue;
    // Read the streamed object into a buffer (jszip needs a buffer/uint8 in node).
    const nodeStream = Readable.fromWeb(obj.stream as never);
    const chunks: Buffer[] = [];
    for await (const chunk of nodeStream) {
      chunks.push(chunk as Buffer);
    }
    zip.file(relativePath(f.folderId, f.name), Buffer.concat(chunks));
  }

  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = folder.name.replace(/[^A-Za-z0-9._-]/g, "_") + ".zip";

  // Detach into a fresh ArrayBuffer so the Response BodyInit type accepts it cleanly.
  const ab = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);

  return new Response(ab as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(archive.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function collectDescendants(rootId: string): Promise<{ id: string; name: string; parentId: string | null }[]> {
  const out: { id: string; name: string; parentId: string | null }[] = [];
  const queue: string[] = [rootId];
  for (let depth = 0; depth < 32 && queue.length > 0; depth++) {
    const next = await db
      .select({ id: folders.id, name: folders.name, parentId: folders.parentId })
      .from(folders)
      .where(inArray(folders.parentId, queue));
    if (next.length === 0) break;
    out.push(...next);
    queue.length = 0;
    for (const n of next) queue.push(n.id);
  }
  return out;
}

export const GET = withLogging(_get);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
