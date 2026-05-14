import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-helpers";
import { listNotifications, maybePruneNotifications } from "@/lib/data/notifications";
import { withLogging } from "@/lib/logged-handler";

/**
 * GET /api/notifications?limit=25&before=<iso>
 *
 * Returns the user's notification feed plus their current unread + total
 * counts. The `before` cursor is the `createdAt` of the last item the client
 * already has — used for "load more" pagination.
 */
async function _get(req: Request) {
  const me = await requireSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 100)) : 25;
  const beforeRaw = url.searchParams.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  const beforeValid = before && !Number.isNaN(before.getTime()) ? before : undefined;

  // Opportunistic retention sweep — throttled to once per hour internally.
  void maybePruneNotifications();

  const result = await listNotifications(me.id, { limit, before: beforeValid });
  return NextResponse.json(result);
}

export const GET = withLogging(_get);
