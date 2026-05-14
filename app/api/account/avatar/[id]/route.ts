import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { withLogging } from "@/lib/logged-handler";

async function _get(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Avatars are visible to any signed-in workspace user.
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [user] = await db
    .select({ avatarKey: users.avatarKey, avatarUpdatedAt: users.avatarUpdatedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user || !user.avatarKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storage = await getStorage();
  const obj = await storage.get(user.avatarKey);
  if (!obj) return NextResponse.json({ error: "Object missing" }, { status: 404 });

  const ext = user.avatarKey.toLowerCase().split(".").pop() ?? "";
  const inferred =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    ext === "gif" ? "image/gif" :
    "image/jpeg";

  return new Response(obj.stream, {
    headers: {
      "Content-Type": obj.contentType ?? inferred,
      "Content-Length": String(obj.size),
      "Cache-Control": "private, max-age=300",
    },
  });
}

export const GET = withLogging(_get);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
