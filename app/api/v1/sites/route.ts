import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull, ne } from "drizzle-orm";
import { canCreate } from "@/lib/auth-helpers";
import { requireApiUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import { folderStorageKey } from "@/lib/data/folders";
import { getStorage } from "@/lib/storage";
import { slugify } from "@/lib/format";
import { hashPassword } from "@/lib/password";
import { notify } from "@/lib/data/notifications";
import { getApiAccessEnabled } from "@/lib/data/settings";
import { withLogging } from "@/lib/logged-handler";

/**
 * POST /api/v1/sites
 *
 * Programmatic ingestion endpoint. Authenticated via a Bearer API token
 * (Authorization: Bearer pos_…). Designed for AI tools to push a generated
 * HTML site (or single HTML file) directly into the workspace as a brand
 * new folder + file(s), optionally published in one shot.
 *
 * Request body (one of):
 *
 *   Single file:
 *     {
 *       "name": "Optional folder name",
 *       "html": "<!doctype html>...",
 *       "publish": "off" | "public" | "password",  // default: "public"
 *       "password": "...",                          // required if publish=password
 *       "slug":     "custom-slug"                   // optional, applies to index.html
 *     }
 *
 *   Multi-file:
 *     {
 *       "name": "Folder name",
 *       "files": [
 *         { "path": "index.html", "content": "..." },
 *         { "path": "styles.css", "content": "..." },
 *         { "path": "hero.png",   "content": "<base64>", "encoding": "base64" }
 *       ],
 *       "publish": "public",
 *       "slug":    "custom-slug"
 *     }
 *
 * Behaviour:
 *  - Creates a brand new folder under the workspace root for each call. We
 *    never mutate an existing folder — keeps the contract idempotent-ish
 *    and avoids surprise overwrites.
 *  - If `name` is omitted, tries to extract from <title> of the html, else
 *    falls back to "Generated site".
 *  - The first HTML file (by convention: `index.html`, else first `.html`)
 *    receives the optional `slug` + `publish` settings.
 *  - Other files in a multi-file site are inserted as workspace files in
 *    the same folder, MIME-inferred from extension.
 *
 * Authorization:
 *  - Token must belong to a user with `canCreate` permission (Owner /
 *    Admin / Editor). Viewers get 403.
 */

const PublishMode = z.enum(["off", "public", "password"]);

const SingleBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  html: z.string().min(1).max(20 * 1024 * 1024), // 20 MB cap on a single HTML file
  publish: PublishMode.default("public"),
  password: z.string().min(8).max(200).optional(),
  slug: z.string().trim().toLowerCase().min(3).max(64).optional(),
});

const MultiBody = z.object({
  name: z.string().trim().min(1).max(120),
  files: z
    .array(
      z.object({
        path: z.string().trim().min(1).max(256),
        content: z.string().max(20 * 1024 * 1024),
        encoding: z.enum(["utf8", "base64"]).default("utf8").optional(),
      }),
    )
    .min(1)
    .max(200),
  publish: PublishMode.default("public"),
  password: z.string().min(8).max(200).optional(),
  slug: z.string().trim().toLowerCase().min(3).max(64).optional(),
});

const Body = z.union([SingleBody, MultiBody]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "settings", "login", "register", "logout",
  "invite", "dashboard", "help", "support", "docs", "status",
  "people", "teams", "logs", "stats", "home", "new", "c", "p",
]);

const MIME_TABLE: Record<string, string> = {
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
};
function inferMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return MIME_TABLE[ext] ?? "application/octet-stream";
}

function extractTitleFromHtml(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const t = m[1].trim();
  return t.length > 0 ? t.slice(0, 120) : null;
}

function normaliseSafePath(raw: string): string | null {
  const p = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p) return null;
  const parts = p.split("/").filter(Boolean);
  if (parts.some((s) => s === ".." || s === ".")) return null;
  if (parts.length > 16) return null;
  return parts.join("/");
}

function basenameOf(path: string): string {
  return path.split("/").pop() || path;
}

async function _post(req: Request) {
  // Workspace-wide kill switch — flipped from /settings by the Super Admin.
  // Check BEFORE auth so an attacker can't even probe whether tokens exist.
  if (!(await getApiAccessEnabled())) {
    return NextResponse.json(
      {
        error: "API access is currently disabled for this workspace.",
        docs: "Ask the workspace owner to re-enable it under Settings → API access.",
      },
      { status: 503 },
    );
  }
  const me = await requireApiUser(req);
  if (!me) {
    return NextResponse.json(
      {
        error: "Missing or invalid API token. Pass it as `Authorization: Bearer pos_…`.",
        docs: "/profile#api",
      },
      { status: 401 },
    );
  }
  if (!canCreate(me.workspaceRole)) {
    return NextResponse.json(
      { error: "This account doesn't have permission to publish (Viewer role)." },
      { status: 403 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const body = parsed.data;

  // -------------------- Resolve folder name --------------------
  let folderName: string;
  if ("html" in body) {
    folderName =
      body.name?.trim() ||
      extractTitleFromHtml(body.html) ||
      "Generated site";
  } else {
    folderName = body.name.trim();
  }
  folderName = folderName.slice(0, 120);

  // -------------------- Resolve slug for folder --------------------
  const baseSlug = slugify(folderName) || "site";
  let finalSlug = baseSlug;
  let attempt = baseSlug;
  let n = 1;
  while (n < 50) {
    const [clash] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.ownerId, me.id), isNull(folders.parentId), eq(folders.slug, attempt)))
      .limit(1);
    if (!clash) {
      finalSlug = attempt;
      break;
    }
    n += 1;
    attempt = `${baseSlug}-${n}`;
  }

  // -------------------- Validate optional file slug (publish slug) --------------------
  let filePublicSlug: string | null = null;
  if (body.slug) {
    if (!SLUG_RE.test(body.slug)) {
      return NextResponse.json(
        { error: "Invalid slug — use 3–64 lowercase letters, numbers, hyphens." },
        { status: 400 },
      );
    }
    if (RESERVED_SLUGS.has(body.slug)) {
      return NextResponse.json({ error: `"${body.slug}" is reserved.` }, { status: 400 });
    }
    const [clashFile] = await db
      .select({ id: files.id })
      .from(files)
      .where(and(eq(files.publicSlug, body.slug), ne(files.id, "__never__")))
      .limit(1);
    if (clashFile) {
      return NextResponse.json({ error: `Slug "${body.slug}" is already taken.` }, { status: 409 });
    }
    filePublicSlug = body.slug;
  }

  // -------------------- Password validation --------------------
  if (body.publish === "password" && !body.password) {
    return NextResponse.json(
      { error: "publish=password requires a `password` field (≥ 8 chars)." },
      { status: 400 },
    );
  }
  const passwordHash =
    body.publish === "password" && body.password ? await hashPassword(body.password) : null;

  // -------------------- Create the folder --------------------
  const [folder] = await db
    .insert(folders)
    .values({
      name: folderName,
      slug: finalSlug,
      parentId: null,
      ownerId: me.id,
      visibility: "private",
    })
    .returning();

  const storage = await getStorage();
  if (storage.mkdir) {
    const key = await folderStorageKey(folder);
    await storage.mkdir(key).catch(() => undefined);
  }

  // -------------------- Build list of file inputs --------------------
  type FileInput = { path: string; content: Buffer; mime: string };
  const inputs: FileInput[] = [];

  if ("html" in body) {
    inputs.push({
      path: "index.html",
      content: Buffer.from(body.html, "utf8"),
      mime: "text/html",
    });
  } else {
    for (const f of body.files) {
      const cleaned = normaliseSafePath(f.path);
      if (!cleaned) continue;
      const buf =
        f.encoding === "base64"
          ? Buffer.from(f.content, "base64")
          : Buffer.from(f.content, "utf8");
      inputs.push({
        path: cleaned,
        content: buf,
        mime: inferMime(cleaned),
      });
    }
  }

  if (inputs.length === 0) {
    return NextResponse.json({ error: "No valid files in payload." }, { status: 400 });
  }

  // -------------------- Identify the index file (publish target) --------------------
  const indexInput =
    inputs.find((f) => f.path.toLowerCase() === "index.html") ??
    inputs.find((f) => f.path.toLowerCase().endsWith(".html")) ??
    inputs[0];

  // -------------------- Persist files --------------------
  const folderKey = await folderStorageKey(folder);
  const created: Array<{ id: string; name: string; isIndex: boolean; publicSlug: string | null }> = [];

  let folderHasIndexHtml = false;

  for (const input of inputs) {
    const baseName = basenameOf(input.path);
    const safeName = baseName.replace(/[^A-Za-z0-9._\-() ]/g, "_") || "file";
    // For multi-file sites we preserve the full sub-path so JS/CSS imports
    // line up if the user references `./styles.css` from index.html.
    const storageKey = `${folderKey}/${input.path.replace(/[^A-Za-z0-9._/\-() ]/g, "_")}`;

    const isIndex = input === indexInput;
    const publish = isIndex ? body.publish : "off";
    const slug = isIndex ? filePublicSlug : null;

    const result = await storage.put(storageKey, new Uint8Array(input.content), input.mime);
    const [row] = await db
      .insert(files)
      .values({
        folderId: folder.id,
        name: safeName,
        path: input.path,
        mime: input.mime,
        sizeBytes: result.size,
        storageKey: result.key,
        storageEtag: result.etag,
        publishMode: publish,
        publishPasswordHash: publish === "password" ? passwordHash : null,
        publicSlug: slug,
        indexable: false,
      })
      .returning({ id: files.id, name: files.name, publicSlug: files.publicSlug });

    if (input.mime === "text/html" || safeName.toLowerCase().endsWith("index.html")) {
      folderHasIndexHtml = true;
    }

    created.push({ id: row.id, name: row.name, isIndex, publicSlug: row.publicSlug });
  }

  if (folderHasIndexHtml) {
    await db.update(folders).set({ hasIndexHtml: true, modifiedAt: new Date() }).where(eq(folders.id, folder.id));
  }

  // -------------------- Compute public URL --------------------
  const origin = new URL(req.url).origin;
  const indexFile = created.find((c) => c.isIndex);
  const publicUrl =
    body.publish !== "off" && indexFile
      ? `${origin}/c/${indexFile.publicSlug ?? indexFile.id}`
      : null;

  // -------------------- Notify the workspace owner --------------------
  void notify({
    userId: me.id,
    kind: "success",
    event: "site.ingested",
    title: `Published “${folder.name}” via API`,
    body: `${created.length} file${created.length === 1 ? "" : "s"} pushed from ${req.headers.get("user-agent")?.slice(0, 40) ?? "an API client"}.`,
    link: `/folders/${folder.id}`,
    data: { folderId: folder.id, count: created.length, tokenId: me.tokenId },
  });

  return NextResponse.json({
    ok: true,
    folder: { id: folder.id, name: folder.name, slug: folder.slug },
    files: created.map((c) => ({ id: c.id, name: c.name, isIndex: c.isIndex })),
    publish: body.publish,
    publicUrl,
  }, { status: 201 });
}

export const POST = withLogging(_post, { source: "api" });
export const runtime = "nodejs";
