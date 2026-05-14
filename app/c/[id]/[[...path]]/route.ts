import { NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { logAccess } from "@/lib/access-log";
import { verifyPassword } from "@/lib/password";
import { publishCookieName, signPublishToken, verifyPublishToken } from "@/lib/publish-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; path?: string[] }> };

function clientIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "\"" ? "&quot;" : "&#39;",
  );
}

function unlockPage(fileId: string, fileName: string, opts: { error?: string } = {}): Response {
  const error = opts.error
    ? `<p class="err">${htmlEscape(opts.error)}</p>`
    : "";
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>Enter password — ${htmlEscape(fileName)} · PublishOS by Design Value</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    background: #FBFAF6; color: #14130F; padding: 24px; }
  .card { width: 380px; max-width: calc(100vw - 32px); background: #fff;
    border: 1px solid #EAE9E3; border-radius: 14px; padding: 28px 26px 22px;
    box-shadow: 0 12px 36px rgba(20,19,15,0.08); }
  .brand { display: flex; align-items: center; justify-content: center;
    margin: 0 0 22px; }
  .brand-wordmark { height: 44px; width: auto; user-select: none; }
  h1 { font-size: 17px; margin: 0 0 4px; letter-spacing: -0.012em; line-height: 1.3;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 13px; color: #6B6962; margin-bottom: 16px; line-height: 1.45; }
  .err { color: #C0533F; font-size: 12.5px; margin: 0 0 12px;
    background: #FBE5E5; border: 1px solid #F2C9C5; padding: 7px 10px; border-radius: 8px; }
  label { display: block; font-size: 12px; color: #6B6962; margin-bottom: 6px; font-weight: 500; }
  .input-row { position: relative; }
  input { width: 100%; box-sizing: border-box; padding: 10px 42px 10px 12px; border: 1px solid #EAE9E3;
    border-radius: 9px; font-size: 13px; outline: 0; font-family: inherit;
    transition: border-color .12s ease, box-shadow .12s ease; }
  input:focus { border-color: #7E4FCC; box-shadow: 0 0 0 3px rgba(126,79,204,0.18); }
  .eye { position: absolute; top: 50%; right: 4px; transform: translateY(-50%);
    width: 32px; height: 32px; border: 0; background: transparent; color: #6B6962;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 6px; transition: color .12s ease, background .12s ease; padding: 0; }
  .eye:hover { color: #14130F; background: #F2F0EA; }
  .eye:focus-visible { color: #14130F; outline: 2px solid #7E4FCC; outline-offset: -2px; }
  .eye svg { display: block; }
  .eye .ico-hide { display: none; }
  .eye[aria-pressed="true"] .ico-show { display: none; }
  .eye[aria-pressed="true"] .ico-hide { display: block; }
  button[type="submit"] { width: 100%; margin-top: 12px; padding: 10px 12px; border-radius: 9px;
    background: #14130F; color: #fff; font-size: 13px; font-weight: 500; border: 0; cursor: pointer;
    transition: opacity .12s ease; }
  button[type="submit"]:hover { opacity: 0.92; }
  .footer { margin-top: 16px; font-size: 11.5px; color: #ACAAA2; text-align: center; }
</style>
</head>
<body>
<form class="card" method="post" autocomplete="off">
  <div class="brand">
    <img src="/brand/publishos-wordmark.svg" alt="PublishOS — by Design Value" class="brand-wordmark" draggable="false" />
  </div>
  <h1>${htmlEscape(fileName)}</h1>
  <div class="sub">This file is protected. Enter the password to view.</div>
  ${error}
  <label for="p">Password</label>
  <div class="input-row">
    <input id="p" name="password" type="password" autofocus required />
    <button type="button" class="eye" id="eye" aria-label="Show password" aria-pressed="false" tabindex="-1">
      <svg class="ico-show" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8s2-4.5 6-4.5S14 8 14 8s-2 4.5-6 4.5S2 8 2 8z" stroke="currentColor" stroke-width="1.4" />
        <circle cx="8" cy="8" r="1.8" stroke="currentColor" stroke-width="1.4" />
      </svg>
      <svg class="ico-hide" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 8s2-4.5 6-4.5S14 8 14 8s-2 4.5-6 4.5S2 8 2 8z" stroke="currentColor" stroke-width="1.4" />
        <circle cx="8" cy="8" r="1.8" stroke="currentColor" stroke-width="1.4" />
        <path d="M2.5 2.5l11 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    </button>
  </div>
  <button type="submit">Unlock</button>
  <div class="footer">Powered by PublishOS</div>
</form>
<script>
(function () {
  var btn = document.getElementById('eye');
  var input = document.getElementById('p');
  if (!btn || !input) return;
  btn.addEventListener('click', function () {
    var pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    btn.setAttribute('aria-label', pressed ? 'Show password' : 'Hide password');
    input.setAttribute('type', pressed ? 'password' : 'text');
    input.focus();
  });
})();
</script>
</body>
</html>`;
  void logAccess({
    method: "GET",
    path: `/c/${fileId}`,
    status: 401,
    source: "public",
    fileId,
  });
  return new Response(body, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function inferMime(name: string, fallback: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
  };
  return map[ext] || fallback || "application/octet-stream";
}

async function _serve(req: Request, ctx: Ctx, method: "GET" | "POST"): Promise<Response> {
  const started = Date.now();
  const { id } = await ctx.params;

  // Public routes resolve a single FILE — folders are never publicly accessible.
  // The route param can be either a file UUID or a custom publicSlug.
  const [file] = await db
    .select()
    .from(files)
    .where(and(
      or(eq(files.id, id), eq(files.publicSlug, id)),
      isNull(files.archivedAt),
    ))
    .limit(1);

  if (!file || file.publishMode === "off") {
    void logAccess({ method, path: `/c/${id}`, status: 404, source: "public" });
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  const fileId = file.id;

  // Password gate
  if (file.publishMode === "password") {
    const passwordHash = file.publishPasswordHash;
    if (!passwordHash) {
      return new Response("File is misconfigured (no password set).", { status: 503 });
    }

    if (method === "POST") {
      const form = await req.formData().catch(() => null);
      const submitted = form ? String(form.get("password") ?? "") : "";
      const ok = submitted ? await verifyPassword(submitted, passwordHash) : false;
      if (!ok) {
        return unlockPage(fileId, file.name, { error: "Incorrect password. Try again." });
      }
      const token = signPublishToken(fileId, passwordHash);
      const target = `/c/${id}`;
      const res = NextResponse.redirect(new URL(target, req.url), { status: 303 });
      res.cookies.set(publishCookieName(fileId), token, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.url.startsWith("https://"),
        path: target,
        maxAge: 6 * 60 * 60,
      });
      void logAccess({
        method: "POST",
        path: target,
        status: 303,
        source: "public",
        fileId,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return res;
    }

    // GET: validate cookie
    const cookieHeader = req.headers.get("cookie") ?? "";
    const want = publishCookieName(fileId) + "=";
    const found = cookieHeader.split(/;\s*/).find((c) => c.startsWith(want));
    const token = found ? decodeURIComponent(found.slice(want.length)) : null;
    if (!verifyPublishToken(fileId, passwordHash, token)) {
      return unlockPage(fileId, file.name);
    }
  }

  const storage = await getStorage();
  const obj = await storage.get(file.storageKey);
  if (!obj) {
    return new Response("Object missing in storage", { status: 502 });
  }

  const mime = inferMime(file.name, file.mime);
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "X-Robots-Tag": file.indexable ? "all" : "noindex, nofollow",
    "Cache-Control": "public, max-age=60",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (file.sizeBytes) headers["Content-Length"] = String(file.sizeBytes);

  void logAccess({
    method,
    path: `/c/${id}`,
    status: 200,
    durationMs: Date.now() - started,
    bytes: file.sizeBytes ?? 0,
    source: "public",
    fileId,
    folderId: file.folderId,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return new Response(obj.stream, { status: 200, headers });
}

export async function GET(req: Request, ctx: Ctx) {
  return _serve(req, ctx, "GET");
}

export async function POST(req: Request, ctx: Ctx) {
  return _serve(req, ctx, "POST");
}
