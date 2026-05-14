import "server-only";
import { promises as fs, createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageBackend, PutResult, GetResult } from "./types";

function safe(key: string): string {
  // Reject path traversal. Keys are constructed server-side so this is defence-in-depth.
  if (key.includes("..") || path.isAbsolute(key)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return key;
}

export function createLocalBackend(rootDir: string): StorageBackend {
  const absRoot = path.isAbsolute(rootDir) ? rootDir : path.join(process.cwd(), rootDir);

  async function ensureParent(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  return {
    kind: "local",

    async put(key, body): Promise<PutResult> {
      const k = safe(key);
      const filePath = path.join(absRoot, k);
      await ensureParent(filePath);

      if (body instanceof Uint8Array) {
        await fs.writeFile(filePath, body);
        return { key: k, size: body.byteLength };
      }
      // ReadableStream → Node stream → file
      const nodeStream = Readable.fromWeb(body as never);
      const chunks: Buffer[] = [];
      for await (const chunk of nodeStream) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(filePath, buffer);
      return { key: k, size: buffer.byteLength };
    },

    async get(key): Promise<GetResult | null> {
      const k = safe(key);
      const filePath = path.join(absRoot, k);
      try {
        const stats = statSync(filePath);
        const nodeStream = createReadStream(filePath);
        const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
        return { stream, size: stats.size };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async delete(key) {
      const k = safe(key);
      const filePath = path.join(absRoot, k);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    },

    async mkdir(key) {
      const dir = path.join(absRoot, safe(key));
      await fs.mkdir(dir, { recursive: true });
    },
  };
}
