import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { and, eq, isNull } from "drizzle-orm";
import { canCreate, requireSessionUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { folderStorageKey, uniqueFolderSlug } from "@/lib/data/folders";
import { getStorage } from "@/lib/storage";
import { slugify } from "@/lib/format";
import { withLogging } from "@/lib/logged-handler";
import { notify } from "@/lib/data/notifications";

/**
 * POST /api/files/[id]/extract
 *
 * Extracts a zip file (owned by the caller) into a new subfolder in the same
 * parent folder. The new subfolder is named after the zip's basename (with
 * the .zip extension stripped). Nested directories inside the zip become
 * subfolders in the workspace; nested files become file rows + storage objects.
 *
 * Safety:
 *  - Zip bomb: hard cap on total uncompressed bytes and entry count.
 *  - Path traversal: any entry whose normalised path contains `..` or starts
 *    with `/` is skipped.
 *  - macOS junk (`__MACOSX/`, `.DS_Store`) is skipped silently.
 *  - Encrypted entries are skipped with a warning (JSZip can't decrypt).
 */

// Limits — generous for normal use, strict enough to prevent abuse.
const MAX_TOTAL_UNCOMPRESSED = 2 * 1024 * 1024 * 1024; // 2 GB total
const MAX_ENTRIES = 5_000;
const MAX_DEPTH = 16;

function looksLikeZip(name: string, mime: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return true;
  if (mime === "application/zip") return true;
  if (mime === "application/x-zip-compressed") return true;
  return false;
}

function isJunk(path: string): boolean {
  if (path.startsWith("__MACOSX/")) return true;
  const base = path.split("/").pop() ?? "";
  if (base === ".DS_Store") return true;
  if (base === "Thumbs.db") return true;
  if (base.startsWith("._")) return true; // macOS resource forks
  return false;
}

function normalisePath(raw: string): string | null {
  // Strip leading slashes; collapse runs; reject traversal.
  let p = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p) return null;
  const parts = p.split("/").filter(Boolean);
  if (parts.some((seg) => seg === ".." || seg === ".")) return null;
  if (parts.length > MAX_DEPTH) return null;
  p = parts.join("/");
  return p || null;
}

async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canCreate(me.workspaceRole)) {
    return NextResponse.json(
      { error: "Viewers can't extract archives. Ask a Super Admin or Admin for Editor access." },
      { status: 403 },
    );
  }

  const { id } = await params;

  // Load the zip file row + owner-check via its parent folder.
  const [file] = await db
    .select({
      id: files.id,
      name: files.name,
      mime: files.mime,
      sizeBytes: files.sizeBytes,
      storageKey: files.storageKey,
      folderId: files.folderId,
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(
      and(
        eq(files.id, id),
        eq(folders.ownerId, me.id),
        isNull(files.archivedAt),
      ),
    )
    .limit(1);

  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  if (!looksLikeZip(file.name, file.mime)) {
    return NextResponse.json(
      { error: "This file isn't a zip archive." },
      { status: 400 },
    );
  }

  // Load the parent folder (we'll create the destination subfolder inside it).
  const [parentFolder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, file.folderId))
    .limit(1);
  if (!parentFolder) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });

  const storage = await getStorage();

  // Slurp the zip bytes into memory. JSZip needs a buffer.
  const obj = await storage.get(file.storageKey);
  if (!obj) {
    return NextResponse.json(
      {
        error:
          "The zip file is no longer on disk (e.g. different server instance or storage cleared). Re-upload the archive, or configure durable S3 storage.",
      },
      { status: 404 },
    );
  }

  let buffer: Buffer;
  try {
    const nodeStream = Readable.fromWeb(obj.stream as never);
    const chunks: Buffer[] = [];
    for await (const chunk of nodeStream) chunks.push(chunk as Buffer);
    buffer = Buffer.concat(chunks);
  } catch {
    return NextResponse.json({ error: "Could not read the zip file from storage." }, { status: 502 });
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not read the archive — file may be corrupted." },
      { status: 422 },
    );
  }

  // Plan: enumerate entries, classify into folders/files, enforce limits.
  type PlannedFile = { path: string; entry: JSZip.JSZipObject };
  const folderPaths = new Set<string>(); // unix-style joined with "/"
  const plannedFiles: PlannedFile[] = [];
  let entryCount = 0;
  let encryptedSkipped = 0;

  zip.forEach((relativePath, entry) => {
    if (isJunk(relativePath)) return;
    const cleaned = normalisePath(relativePath);
    if (!cleaned) return;
    entryCount++;
    if (entryCount > MAX_ENTRIES) return; // will short-circuit below
    if (entry.dir) {
      folderPaths.add(cleaned);
      return;
    }
    // JSZip exposes encryption flag indirectly — guard by trying later.
    plannedFiles.push({ path: cleaned, entry });
    // Pre-compute parent folder chain so we can create them even for files
    // whose explicit dir entries are missing from the zip.
    const parts = cleaned.split("/");
    parts.pop();
    for (let i = 0; i < parts.length; i++) {
      folderPaths.add(parts.slice(0, i + 1).join("/"));
    }
  });

  if (entryCount > MAX_ENTRIES) {
    return NextResponse.json(
      { error: `Archive has too many entries (${entryCount}+). Max is ${MAX_ENTRIES}.` },
      { status: 413 },
    );
  }
  if (entryCount === 0) {
    return NextResponse.json({ error: "Archive is empty." }, { status: 422 });
  }

  // Destination subfolder name = zip basename minus .zip, deduped per parent.
  const baseName = file.name.replace(/\.zip$/i, "") || "extracted";
  const rootSlug = slugify(baseName);

  const rootSlugFinal = await uniqueFolderSlug(me.id, parentFolder.id, rootSlug);

  // Create the root extract folder.
  const [rootFolder] = await db
    .insert(folders)
    .values({
      name: baseName,
      slug: rootSlugFinal,
      parentId: parentFolder.id,
      ownerId: me.id,
      visibility: parentFolder.visibility,
    })
    .returning();

  if (!rootFolder) {
    return NextResponse.json(
      { error: "Could not create the destination folder. Try again." },
      { status: 500 },
    );
  }

  // Map of zip-path → DB folder id. The root's "" maps to the root folder.
  const folderByPath = new Map<string, typeof rootFolder>();
  folderByPath.set("", rootFolder);

  // Create folder rows top-down so each child sees its parent.
  const sortedPaths = Array.from(folderPaths).sort(
    (a, b) => a.split("/").length - b.split("/").length,
  );
  for (const p of sortedPaths) {
    const parts = p.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parent = folderByPath.get(parentPath);
    if (!parent) continue; // parent failed to create, skip subtree
    const slug = slugify(name) || "folder";
    const attemptSlug = await uniqueFolderSlug(me.id, parent.id, slug);
    const [created] = await db
      .insert(folders)
      .values({
        name,
        slug: attemptSlug,
        parentId: parent.id,
        ownerId: me.id,
        visibility: parentFolder.visibility,
      })
      .returning();
    if (!created) {
      return NextResponse.json(
        { error: "Could not create a subfolder while extracting. Try a smaller archive or retry." },
        { status: 500 },
      );
    }
    folderByPath.set(p, created);

    // Mirror on disk for local backend.
    if (storage.mkdir) {
      const key = await folderStorageKey(created);
      await storage.mkdir(key).catch(() => undefined);
    }
  }

  // Now extract each file, streaming sizes and writing to storage.
  let extractedCount = 0;
  let extractedBytes = 0;
  const seenNamesPerFolder = new Map<string, Set<string>>();

  for (const { path: zipPath, entry } of plannedFiles) {
    const parts = zipPath.split("/");
    const name = parts.pop()!;
    const parentPath = parts.join("/");
    const targetFolder = folderByPath.get(parentPath);
    if (!targetFolder) continue;

    // Read the entry. JSZip throws on encrypted entries.
    let data: Uint8Array;
    try {
      data = await entry.async("uint8array");
    } catch {
      encryptedSkipped++;
      continue;
    }

    // Enforce total-uncompressed cap.
    if (extractedBytes + data.byteLength > MAX_TOTAL_UNCOMPRESSED) {
      return NextResponse.json(
        {
          error: `Extraction exceeds ${MAX_TOTAL_UNCOMPRESSED / (1024 * 1024 * 1024)} GB total uncompressed size.`,
          extracted: extractedCount,
        },
        { status: 413 },
      );
    }

    // Disambiguate name within the target folder. We track in-memory to avoid
    // DB round-trips per entry — collisions across DB pre-existing files in
    // this newly-created folder aren't possible because we just created it.
    let nameSet = seenNamesPerFolder.get(targetFolder.id);
    if (!nameSet) {
      nameSet = new Set();
      seenNamesPerFolder.set(targetFolder.id, nameSet);
    }
    let finalName = name || "file";
    if (nameSet.has(finalName.toLowerCase())) {
      const dot = finalName.lastIndexOf(".");
      const stem = dot > 0 ? finalName.slice(0, dot) : finalName;
      const ext = dot > 0 ? finalName.slice(dot) : "";
      let n = 2;
      while (nameSet.has(`${stem} (${n})${ext}`.toLowerCase()) && n < 1000) n++;
      finalName = `${stem} (${n})${ext}`;
      if (nameSet.has(finalName.toLowerCase())) {
        finalName = `${stem}-${Date.now()}${ext}`;
      }
    }
    nameSet.add(finalName.toLowerCase());

    const safeName = finalName.replace(/[^A-Za-z0-9._\-() ]/g, "_");
    const folderKey = await folderStorageKey(targetFolder);
    const storageKey = `${folderKey}/${safeName}`;
    const contentType = inferMime(finalName);

    const result = await storage.put(storageKey, data, contentType);
    const isHtml = finalName.toLowerCase().endsWith("index.html") || contentType === "text/html";

    await db.insert(files).values({
      folderId: targetFolder.id,
      name: finalName,
      path: finalName,
      mime: contentType,
      sizeBytes: result.size,
      storageKey: result.key,
      storageEtag: result.etag,
    });

    if (isHtml) {
      await db
        .update(folders)
        .set({ hasIndexHtml: true })
        .where(eq(folders.id, targetFolder.id));
    }

    extractedCount++;
    extractedBytes += data.byteLength;
  }

  // Best-effort: mark the destination folder's modifiedAt so it sorts to the top.
  await db
    .update(folders)
    .set({ modifiedAt: new Date() })
    .where(eq(folders.id, rootFolder.id));

  void notify({
    userId: me.id,
    kind: "success",
    event: "file.extracted",
    title: `Extracted “${file.name}”`,
    body: `${extractedCount} file${extractedCount === 1 ? "" : "s"} unpacked into “${rootFolder.name}”.${
      encryptedSkipped > 0 ? ` ${encryptedSkipped} encrypted entr${encryptedSkipped === 1 ? "y" : "ies"} skipped.` : ""
    }`,
    link: `/folders/${rootFolder.id}`,
    data: { sourceFileId: file.id, destFolderId: rootFolder.id, count: extractedCount, bytes: extractedBytes },
  });

  return NextResponse.json({
    ok: true,
    folderId: rootFolder.id,
    folderName: rootFolder.name,
    extracted: extractedCount,
    bytes: extractedBytes,
    encryptedSkipped,
  });
}

/* Very small MIME guesser — falls back to octet-stream. */
function inferMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const table: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    zip: "application/zip",
  };
  return table[ext] ?? "application/octet-stream";
}

export const POST = withLogging(_post);
export const runtime = "nodejs";
