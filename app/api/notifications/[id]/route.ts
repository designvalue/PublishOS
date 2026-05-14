import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { dismissNotification, markRead } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * POST   /api/notifications/[id]  → mark a single notification as read
 * DELETE /api/notifications/[id]  → dismiss (delete) a notification
 *
 * Both 404 if the notification doesn't belong to the current user, so other
 * users' notification ids can't be probed.
 */
async function _post(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await markRead(me.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

async function _delete(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await dismissNotification(me.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const POST = withLogging(_post);
export const DELETE = withLogging(_delete);
