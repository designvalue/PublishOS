import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { unreadCount } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET /api/notifications/unread → `{ unread: number }`
 *
 * Light-weight endpoint the bell polls every ~30s. Returns only the count
 * so we don't churn through the full feed for every tick.
 */
async function _get() {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const unread = await unreadCount(me.id);
  return NextResponse.json({ unread });
}

export const GET = withLogging(_get);
