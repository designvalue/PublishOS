import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

async function _post(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected an image upload" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a PNG, JPEG, WebP, or GIF image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 413 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const storageKey = `avatars/${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const storage = await getStorage();
  if (storage.mkdir) await storage.mkdir(`avatars/${session.user.id}`);

  // Best-effort: remove the previous avatar blob so we don't leak storage.
  const [prev] = await db
    .select({ avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  await storage.put(storageKey, buffer, file.type);

  if (prev?.avatarKey) {
    await storage.delete(prev.avatarKey).catch(() => undefined);
  }

  const updatedAt = new Date();
  await db
    .update(users)
    .set({
      avatarKey: storageKey,
      avatarUpdatedAt: updatedAt,
      image: `/api/account/avatar/${session.user.id}?v=${updatedAt.getTime()}`,
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({
    avatarUrl: `/api/account/avatar/${session.user.id}?v=${updatedAt.getTime()}`,
  });
}

async function _delete() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [prev] = await db
    .select({ avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (prev?.avatarKey) {
    const storage = await getStorage();
    await storage.delete(prev.avatarKey).catch(() => undefined);
  }

  await db
    .update(users)
    .set({ avatarKey: null, avatarUpdatedAt: null, image: null })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}

export const POST = withLogging(_post);
export const DELETE = withLogging(_delete);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
