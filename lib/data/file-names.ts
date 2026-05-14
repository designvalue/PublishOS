import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";

/**
 * Unique file `name` within a folder (live rows only), matching upload behaviour:
 * `base`, `base (2)`, … then `stem-<timestamp>.ext` after many collisions.
 */
export async function uniqueLiveFileNameInFolder(folderId: string, baseName: string): Promise<string> {
  const safeBase = baseName.trim() || "untitled";
  const [hit] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.folderId, folderId), eq(files.name, safeBase)))
    .limit(1);
  if (!hit) return safeBase;

  const dot = safeBase.lastIndexOf(".");
  const stem = dot > 0 ? safeBase.slice(0, dot) : safeBase;
  const ext = dot > 0 ? safeBase.slice(dot) : "";
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

/**
 * Names for duplicated files: `base (copy).ext`, `base (copy 2).ext`, …;
 * then `base (copy-<timestamp>).ext` if needed.
 */
export async function uniqueFileCopyNameInFolder(folderId: string, originalFileName: string): Promise<string> {
  const dot = originalFileName.lastIndexOf(".");
  const base = dot > 0 ? originalFileName.slice(0, dot) : originalFileName;
  const ext = dot > 0 ? originalFileName.slice(dot) : "";
  let candidate = `${base} (copy)${ext}`;
  let n = 2;
  while (true) {
    const [hit] = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.folderId, folderId), eq(files.name, candidate)))
      .limit(1);
    if (!hit) return candidate;
    if (n > 200) return `${base} (copy ${Date.now()})${ext}`;
    candidate = `${base} (copy ${n})${ext}`;
    n += 1;
  }
}
