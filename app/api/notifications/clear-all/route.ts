import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { clearAll } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * POST /api/notifications/clear-all → `{ ok: true, removed: number }`
 *
 * Permanently deletes every notification for the current user.
 */
async function _post() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const removed = await clearAll(me.id);
  return NextResponse.json({ ok: true, removed });
}

export const POST = withLogging(_post);
