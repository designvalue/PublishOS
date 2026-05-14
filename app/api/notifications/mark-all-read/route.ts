import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { markAllRead } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * POST /api/notifications/mark-all-read → `{ ok: true, updated: number }`
 *
 * Used by the "Mark all read" link in the bell drawer.
 */
async function _post() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const updated = await markAllRead(me.id);
  return NextResponse.json({ ok: true, updated });
}

export const POST = withLogging(_post);
